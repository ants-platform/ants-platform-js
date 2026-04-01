/**
 * OpenAI client wrapper with guardrail enforcement.
 *
 * @example
 * ```ts
 * import { AntsOpenAI } from "@antsplatform/guardrails/providers/openai";
 *
 * const client = new AntsOpenAI({
 *   apiKey: "sk-...",
 *   antsApiKey: "pk:sk",
 *   agentId: "agent_123",
 * });
 *
 * const response = await client.chat.completions.create({
 *   model: "gpt-4",
 *   messages: [{ role: "user", content: "Hello" }],
 * });
 * ```
 */

import { AntsGuardrailsClient } from "../client.js";
import { GuardrailViolationError } from "../errors.js";
import { sendTraceViaIngestion } from "../ingestion-fallback.js";

import type OpenAI from "openai";
import type { ClientOptions } from "openai";

// Optional OTEL tracing — auto-detected at runtime
let _tracing: typeof import("@antsplatform/tracing") | null = null;
try {
  _tracing = await import("@antsplatform/tracing");
} catch {
  // tracing package not installed — spans won't be created
}

export interface AntsOpenAIOptions extends ClientOptions {
  antsApiKey: string;
  antsBaseUrl?: string;
  agentId?: string;
  agentName?: string;
  guardrailServiceUrl?: string;
}

export class AntsOpenAI {
  private client!: OpenAI;
  private readonly guardrails: AntsGuardrailsClient;
  private readonly agentName?: string;
  private readonly antsApiKey: string;
  private readonly antsBaseUrl: string;
  public readonly chat: AntsChatWrapper;
  /** @internal */
  _initPromise: Promise<void>;

  constructor(opts: AntsOpenAIOptions) {
    const { antsApiKey, antsBaseUrl, agentId, agentName, guardrailServiceUrl, ...openaiOpts } = opts;
    this.agentName = agentName;
    this.antsApiKey = antsApiKey;
    this.antsBaseUrl = antsBaseUrl ?? "https://app.antsplatform.com";

    this.guardrails = new AntsGuardrailsClient({
      antsApiKey,
      baseUrl: antsBaseUrl,
      agentId,
      guardrailServiceUrl,
    });

    this._initPromise = import("openai").then((mod) => {
      const OpenAISDK = mod.default;
      this.client = new OpenAISDK(openaiOpts);
    });

    this.chat = new AntsChatWrapper(this);
  }
}

class AntsChatWrapper {
  public readonly completions: AntsCompletions;

  constructor(parent: AntsOpenAI) {
    this.completions = new AntsCompletions(parent);
  }
}

class AntsCompletions {
  constructor(private readonly parent: AntsOpenAI) {}

  async create(
    params: OpenAI.ChatCompletionCreateParamsNonStreaming,
  ): Promise<OpenAI.ChatCompletion> {
    await this.parent._initPromise;

    const inputText = params.messages
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n");

    const guardrails = this.parent["guardrails"] as AntsGuardrailsClient;
    const guardrailActive = guardrails.enabled;

    // STEP 1: Input guardrail check — no span yet
    let effectiveParams = params;
    if (guardrailActive) {
      const inputCheck = await guardrails.checkInput(inputText);
      if (inputCheck.result === "BLOCKED") {
        throw new GuardrailViolationError("input", inputCheck);
      }

      if (inputCheck.result === "SANITIZED" && inputCheck.sanitizedText) {
        effectiveParams = { ...params, messages: [{ role: "user" as const, content: inputCheck.sanitizedText }] };
      }
    }

    // STEP 2: LLM call — still no span (output might be blocked)
    const response = await this.parent["client"].chat.completions.create(effectiveParams);

    const outputText = response.choices
      .map((c) => c.message?.content ?? "")
      .join("");

    // STEP 3: Output guardrail check — still no span
    if (guardrailActive && outputText) {
      const outputCheck = await guardrails.checkOutput(outputText, inputText);
      if (outputCheck.result === "BLOCKED") {
        throw new GuardrailViolationError("output", outputCheck);
      }
    }

    // STEP 4: Both checks passed — NOW create and immediately end OTEL span
    const parentAgentName = this.parent["agentName"];
    const span = _tracing?.startObservation(
      parentAgentName ?? `openai/${params.model}`,
      {
        model: params.model,
        input: { messages: params.messages },
        metadata: { provider: "openai", agentId: guardrails["agentId"] ?? "", guardrailResult: guardrailActive ? "PASS" : "NOT_CONFIGURED" },
      },
      { asType: "generation" },
    );

    span?.update({
      output: { role: "assistant", content: outputText },
      usageDetails: {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        total_tokens: response.usage?.total_tokens ?? 0,
      },
    });
    span?.end();

    // Send trace via ingestion API (always — OTEL spans are additional when configured)
    {
      sendTraceViaIngestion({
        antsApiKey: this.parent["antsApiKey"],
        baseUrl: this.parent["antsBaseUrl"],
        model: params.model,
        provider: "openai",
        agentId: guardrails["agentId"],
        inputData: params.messages,
        outputData: outputText,
        usage: {
          input: response.usage?.prompt_tokens ?? 0,
          output: response.usage?.completion_tokens ?? 0,
          total: response.usage?.total_tokens ?? 0,
        },
        latencyMs: undefined,
        guardrailResult: guardrailActive ? "PASS" : "NOT_CONFIGURED",
      }).catch(() => {});
    }

    return response;
  }
}
