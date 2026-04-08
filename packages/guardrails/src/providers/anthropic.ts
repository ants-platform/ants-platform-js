/**
 * Anthropic client wrapper with guardrail enforcement.
 *
 * @example
 * ```ts
 * import { AntsAnthropic } from "@antsplatform/guardrails/providers/anthropic";
 *
 * const client = new AntsAnthropic({
 *   apiKey: "sk-ant-...",
 *   antsApiKey: "pk:sk",
 *   agentId: "agent_123",
 * });
 *
 * const response = await client.messages.create({
 *   model: "claude-3-haiku-20240307",
 *   max_tokens: 1024,
 *   messages: [{ role: "user", content: "Hello" }],
 * });
 * ```
 */

import { AntsGuardrailsClient, type AntsGuardrailsClientOptions } from "../client.js";
import { GuardrailViolationError } from "../errors.js";
import { sendTraceViaIngestion } from "../ingestion-fallback.js";
import { effectiveText, overallGuardrailResult } from "./guardrail-utils.js";

import type Anthropic from "@anthropic-ai/sdk";
import type { ClientOptions } from "@anthropic-ai/sdk";

// Optional OTEL tracing — auto-detected at runtime
let _tracing: typeof import("@antsplatform/tracing") | null = null;
try {
  _tracing = await import("@antsplatform/tracing");
} catch {
  // tracing package not installed — spans won't be created
}

export interface AntsAnthropicOptions extends ClientOptions {
  antsApiKey: string;
  antsBaseUrl?: string;
  agentId?: string;
  agentName?: string;
  guardrailServiceUrl?: string;
}

export class AntsAnthropic {
  private readonly client: Anthropic;
  private readonly guardrails: AntsGuardrailsClient;
  private readonly agentName?: string;
  public readonly messages: AntsMessages;

  private readonly antsApiKey: string;
  private readonly antsBaseUrl: string;

  constructor(opts: AntsAnthropicOptions) {
    const { antsApiKey, antsBaseUrl, agentId, agentName, guardrailServiceUrl, ...anthropicOpts } = opts;
    this.agentName = agentName;
    this.antsApiKey = antsApiKey;
    this.antsBaseUrl = antsBaseUrl ?? "https://app.antsplatform.com";

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AnthropicSDK = require("@anthropic-ai/sdk").default;
    this.client = new AnthropicSDK(anthropicOpts);
    this.guardrails = new AntsGuardrailsClient({
      antsApiKey,
      baseUrl: antsBaseUrl,
      agentId,
      guardrailServiceUrl,
    });
    this.messages = new AntsMessages(this);
  }
}

class AntsMessages {
  constructor(private readonly parent: AntsAnthropic) {}

  async create(
    params: Anthropic.MessageCreateParams & { stream?: false },
  ): Promise<Anthropic.Message> {
    const inputText = params.messages
      .map((m) => {
        if (typeof m.content === "string") return m.content;
        if (Array.isArray(m.content)) {
          return m.content
            .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
            .map((b) => b.text)
            .join("\n");
        }
        return "";
      })
      .join("\n");

    const guardrails = this.parent["guardrails"] as AntsGuardrailsClient;
    const guardrailActive = guardrails.enabled;
    let inputCheck;
    let outputCheck;

    // STEP 1: Input guardrail check — no span yet
    let effectiveParams = params;
    if (guardrailActive) {
      inputCheck = await guardrails.checkInput(inputText);
      if (inputCheck.result === "BLOCKED") {
        throw new GuardrailViolationError("input", inputCheck);
      }

      if (inputCheck.result === "SANITIZED" && inputCheck.sanitizedText !== undefined) {
        effectiveParams = { ...params, messages: [{ role: "user" as const, content: inputCheck.sanitizedText }] };
      }
    }
    const effectiveMessages = effectiveParams.messages;
    const effectiveInputText = effectiveText(inputText, inputCheck);

    // STEP 2: LLM call — still no span (output might be blocked)
    const response = await this.parent["client"].messages.create(effectiveParams);

    const outputText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let effectiveOutputText = outputText;

    // STEP 3: Output guardrail check — still no span
    if (guardrailActive && outputText) {
      outputCheck = await guardrails.checkOutput(outputText, effectiveInputText);
      if (outputCheck.result === "BLOCKED") {
        throw new GuardrailViolationError("output", outputCheck);
      }
      effectiveOutputText = effectiveText(outputText, outputCheck);
    }
    const finalResponse = applySanitizedOutput(response, effectiveOutputText);
    const guardrailResult = overallGuardrailResult(guardrailActive, inputCheck, outputCheck);

    // STEP 4: Both checks passed — NOW create and immediately end OTEL span
    const parentAgentName = this.parent["agentName"];
    const span = _tracing?.startObservation(
      parentAgentName ?? `anthropic/${params.model}`,
      {
        model: params.model,
        input: { messages: effectiveMessages },
        metadata: { provider: "anthropic", agentId: guardrails["agentId"] ?? "", guardrailResult },
      },
      { asType: "generation" },
    );

    span?.update({
      output: { role: "assistant", content: effectiveOutputText },
      usageDetails: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
        total_tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      },
    });
    span?.end();

    // Send trace via ingestion API
    {
      sendTraceViaIngestion({
        antsApiKey: this.parent["antsApiKey"],
        baseUrl: this.parent["antsBaseUrl"],
        model: params.model,
        provider: "anthropic",
        agentId: guardrails["agentId"],
        inputData: effectiveMessages,
        outputData: effectiveOutputText,
        usage: {
          input: response.usage?.input_tokens ?? 0,
          output: response.usage?.output_tokens ?? 0,
          total: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
        },
        latencyMs: undefined,
        guardrailResult,
      }).catch(() => {});
    }

    return finalResponse;
  }
}

function applySanitizedOutput(
  response: Anthropic.Message,
  outputText: string,
): Anthropic.Message {
  let replaced = false;

  return {
    ...response,
    content: response.content.map((block) => {
      if (block.type !== "text") {
        return block;
      }

      const nextText = replaced ? "" : outputText;
      replaced = true;
      return {
        ...block,
        text: nextText,
      };
    }),
  };
}
