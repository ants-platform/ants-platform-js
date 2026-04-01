/**
 * Google Vertex AI client wrapper with guardrail enforcement.
 *
 * @example
 * ```ts
 * import { AntsVertexAI } from "@antsplatform/guardrails/providers/vertex";
 *
 * const client = new AntsVertexAI({
 *   project: "my-project",
 *   location: "us-central1",
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

// Optional OTEL tracing — auto-detected at runtime
let _tracing: typeof import("@antsplatform/tracing") | null = null;
try {
  _tracing = await import("@antsplatform/tracing");
} catch {
  // tracing package not installed — spans won't be created
}

export interface AntsVertexAIOptions {
  project: string;
  location: string;
  antsApiKey: string;
  antsBaseUrl?: string;
  agentId?: string;
  agentName?: string;
  guardrailServiceUrl?: string;
  [key: string]: unknown;
}

export class AntsVertexAI {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly vertex: any;
  private readonly guardrails: AntsGuardrailsClient;

  private readonly antsApiKey: string;
  private readonly antsBaseUrl: string;

  constructor(opts: AntsVertexAIOptions) {
    const { antsApiKey, antsBaseUrl, agentId, guardrailServiceUrl, project, location, ...vertexOpts } = opts;
    this.antsApiKey = antsApiKey;
    this.antsBaseUrl = antsBaseUrl ?? "https://app.antsplatform.com";

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { VertexAI } = require("@google-cloud/vertexai");
    this.vertex = new VertexAI({ project, location, ...vertexOpts });
    this.guardrails = new AntsGuardrailsClient({
      antsApiKey,
      baseUrl: antsBaseUrl,
      agentId,
      guardrailServiceUrl,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getGenerativeModel(params: { model: string; [key: string]: any }): AntsVertexModel {
    const model = this.vertex.getGenerativeModel(params);
    return new AntsVertexModel(model, this.guardrails, params.model, this.antsApiKey, this.antsBaseUrl);
  }
}

class AntsVertexModel {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly model: any,
    private readonly guardrails: AntsGuardrailsClient,
    private readonly modelName: string,
    private readonly antsApiKey?: string,
    private readonly antsBaseUrl?: string,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async generateContent(request: string | any): Promise<any> {
    const inputText = typeof request === "string" ? request : JSON.stringify(request);

    const guardrailActive = this.guardrails.enabled;

    // STEP 1: Input guardrail check — no span yet
    let effectiveRequest = request;
    if (guardrailActive) {
      const inputCheck = await this.guardrails.checkInput(inputText);
      if (inputCheck.result === "BLOCKED") {
        throw new GuardrailViolationError("input", inputCheck);
      }

      if (inputCheck.result === "SANITIZED" && inputCheck.sanitizedText) {
        effectiveRequest = inputCheck.sanitizedText;
      }
    }

    // STEP 2: LLM call — still no span (output might be blocked)
    const response = await this.model.generateContent(effectiveRequest);

    const outputText =
      response?.response?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";

    // STEP 3: Output guardrail check — still no span
    if (guardrailActive && outputText) {
      const outputCheck = await this.guardrails.checkOutput(outputText, inputText);
      if (outputCheck.result === "BLOCKED") {
        throw new GuardrailViolationError("output", outputCheck);
      }
    }

    // STEP 4: Both checks passed — NOW create and immediately end OTEL span
    const usageMetadata = response?.response?.usageMetadata;
    const span = _tracing?.startObservation(
      `vertex/${this.modelName}`,
      {
        model: this.modelName,
        input: { request },
        metadata: { provider: "vertex", agentId: this.guardrails["agentId"] ?? "", guardrailResult: guardrailActive ? "PASS" : "NOT_CONFIGURED" },
      },
      { asType: "generation" },
    );

    span?.update({
      output: { role: "assistant", content: outputText },
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
        provider: "vertex",
        agentId: this.guardrails["agentId"],
        inputData: request,
        outputData: outputText,
        usage: {
          input: usageMetadata?.promptTokenCount ?? 0,
          output: usageMetadata?.candidatesTokenCount ?? 0,
          total: usageMetadata?.totalTokenCount ?? 0,
        },
        latencyMs: undefined,
        guardrailResult: guardrailActive ? "PASS" : "NOT_CONFIGURED",
      }).catch(() => {});
    }

    return response;
  }
}
