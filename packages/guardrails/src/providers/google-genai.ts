/**
 * Google Generative AI client wrapper with guardrail enforcement.
 *
 * @example
 * ```ts
 * import { AntsGoogleGenAI } from "@antsplatform/guardrails/providers/google-genai";
 *
 * const client = new AntsGoogleGenAI({
 *   apiKey: "AIza...",
 *   antsApiKey: "pk:sk",
 *   agentId: "agent_123",
 * });
 *
 * const model = client.getGenerativeModel({ model: "gemini-pro" });
 * const response = await model.generateContent("Hello");
 * ```
 */

import { AntsGuardrailsClient } from "../client.js";
import { GuardrailViolationError } from "../errors.js";
import { sendTraceViaIngestion } from "../ingestion-fallback.js";
import { effectiveText, overallGuardrailResult } from "./guardrail-utils.js";

// Optional OTEL tracing — auto-detected at runtime
let _tracing: typeof import("@antsplatform/tracing") | null = null;
try {
  _tracing = await import("@antsplatform/tracing");
} catch {
  // tracing package not installed — spans won't be created
}

export interface AntsGoogleGenAIOptions {
  apiKey: string;
  antsApiKey: string;
  antsBaseUrl?: string;
  agentId?: string;
  agentName?: string;
  guardrailServiceUrl?: string;
}

export class AntsGoogleGenAI {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly genai: any;
  private readonly guardrails: AntsGuardrailsClient;
  private readonly agentName?: string;

  private readonly antsApiKey: string;
  private readonly antsBaseUrl: string;

  constructor(opts: AntsGoogleGenAIOptions) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    this.genai = new GoogleGenerativeAI(opts.apiKey);
    this.agentName = opts.agentName;
    this.antsApiKey = opts.antsApiKey;
    this.antsBaseUrl = opts.antsBaseUrl ?? "https://app.antsplatform.com";
    this.guardrails = new AntsGuardrailsClient({
      antsApiKey: opts.antsApiKey,
      baseUrl: opts.antsBaseUrl,
      agentId: opts.agentId,
      guardrailServiceUrl: opts.guardrailServiceUrl,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getGenerativeModel(params: { model: string; [key: string]: any }): AntsGenerativeModel {
    const model = this.genai.getGenerativeModel(params);
    return new AntsGenerativeModel(model, this.guardrails, params.model, this.agentName, this.antsApiKey, this.antsBaseUrl);
  }
}

class AntsGenerativeModel {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly model: any,
    private readonly guardrails: AntsGuardrailsClient,
    private readonly modelName: string,
    private readonly agentName?: string,
    private readonly antsApiKey?: string,
    private readonly antsBaseUrl?: string,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async generateContent(request: string | any): Promise<any> {
    const inputText = typeof request === "string" ? request : JSON.stringify(request);

    const guardrailActive = this.guardrails.enabled;
    let inputCheck;
    let outputCheck;

    // STEP 1: Input guardrail check — no span yet
    let effectiveRequest = request;
    if (guardrailActive) {
      inputCheck = await this.guardrails.checkInput(inputText);
      if (inputCheck.result === "BLOCKED") {
        throw new GuardrailViolationError("input", inputCheck);
      }

      if (inputCheck.result === "SANITIZED" && inputCheck.sanitizedText !== undefined) {
        effectiveRequest = inputCheck.sanitizedText;
      }
    }
    const effectiveInputText = effectiveText(inputText, inputCheck);

    // STEP 2: LLM call — still no span (output might be blocked)
    const response = await this.model.generateContent(effectiveRequest);
    const outputText = response?.response?.text?.() ?? "";
    let effectiveOutputText = outputText;

    // STEP 3: Output guardrail check — still no span
    if (guardrailActive && outputText) {
      outputCheck = await this.guardrails.checkOutput(outputText, effectiveInputText);
      if (outputCheck.result === "BLOCKED") {
        throw new GuardrailViolationError("output", outputCheck);
      }
      effectiveOutputText = effectiveText(outputText, outputCheck);
    }
    applySanitizedOutput(response, effectiveOutputText);
    const guardrailResult = overallGuardrailResult(guardrailActive, inputCheck, outputCheck);

    // STEP 4: Both checks passed — NOW create and immediately end OTEL span
    const usageMetadata = response?.response?.usageMetadata;
    const span = _tracing?.startObservation(
      this.agentName ?? `gemini/${this.modelName}`,
      {
        model: this.modelName,
        input: { request: effectiveRequest },
        metadata: { provider: "gemini", agentId: this.guardrails["agentId"] ?? "", guardrailResult },
      },
      { asType: "generation" },
    );

    span?.update({
      output: { role: "assistant", content: effectiveOutputText },
      usageDetails: {
        input_tokens: usageMetadata?.promptTokenCount ?? 0,
        output_tokens: usageMetadata?.candidatesTokenCount ?? 0,
        total_tokens: usageMetadata?.totalTokenCount ?? 0,
      },
    });
    span?.end();

    // Send trace via ingestion API
    if (this.antsApiKey && this.antsBaseUrl) {
      sendTraceViaIngestion({
        antsApiKey: this.antsApiKey,
        baseUrl: this.antsBaseUrl,
        model: this.modelName,
        provider: "gemini",
        agentId: this.guardrails["agentId"],
        inputData: effectiveRequest,
        outputData: effectiveOutputText,
        usage: {
          input: usageMetadata?.promptTokenCount ?? 0,
          output: usageMetadata?.candidatesTokenCount ?? 0,
          total: usageMetadata?.totalTokenCount ?? 0,
        },
        latencyMs: undefined,
        guardrailResult,
      }).catch(() => {});
    }

    return response;
  }
}

function applySanitizedOutput(response: any, outputText: string): void {
  if (!response?.response) {
    return;
  }

  const rawResponse = response.response;
  if (typeof rawResponse.text === "function") {
    rawResponse.text = () => outputText;
  }

  let replaced = false;
  for (const candidate of rawResponse.candidates ?? []) {
    for (const part of candidate?.content?.parts ?? []) {
      if (!("text" in part)) {
        continue;
      }
      part.text = replaced ? "" : outputText;
      replaced = true;
    }
  }
}
