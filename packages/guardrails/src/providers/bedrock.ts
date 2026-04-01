/**
 * AWS Bedrock client wrapper with guardrail enforcement.
 *
 * @example
 * ```ts
 * import { AntsBedrock } from "@antsplatform/guardrails/providers/bedrock";
 *
 * const client = new AntsBedrock({
 *   antsApiKey: "pk:sk",
 *   agentId: "agent_123",
 *   region: "us-east-1",
 * });
 *
 * const response = await client.converse({
 *   modelId: "anthropic.claude-3-haiku-20240307-v1:0",
 *   messages: [{ role: "user", content: [{ text: "Hello" }] }],
 * });
 * ```
 */

import { AntsGuardrailsClient, type AntsGuardrailsClientOptions } from "../client.js";
import { GuardrailViolationError } from "../errors.js";
import { sendTraceViaIngestion } from "../ingestion-fallback.js";

import type {
  BedrockRuntimeClient as BedrockClient,
  BedrockRuntimeClientConfig,
  ConverseCommandInput,
  ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";

// Optional OTEL tracing — auto-detected at runtime
let _tracing: typeof import("@antsplatform/tracing") | null = null;
try {
  _tracing = await import("@antsplatform/tracing");
} catch {
  // tracing package not installed — spans won't be created
}

export interface AntsBedrockOptions extends Omit<AntsGuardrailsClientOptions, "antsApiKey"> {
  antsApiKey: string;
  antsBaseUrl?: string;
  agentName?: string;
  region?: string;
  [key: string]: unknown;
}

export class AntsBedrock {
  private client!: BedrockClient;
  private readonly guardrails: AntsGuardrailsClient;
  private readonly agentName?: string;
  private readonly antsApiKey: string;
  private readonly antsBaseUrl: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _ConverseCommand: any;
  private _initPromise: Promise<void>;

  constructor(opts: AntsBedrockOptions) {
    const { antsApiKey, antsBaseUrl, agentId, agentName, guardrailServiceUrl, timeoutMs, region, ...bedrockOpts } = opts;
    this.agentName = agentName;
    this.antsApiKey = antsApiKey;
    this.antsBaseUrl = antsBaseUrl ?? "https://app.antsplatform.com";

    this.guardrails = new AntsGuardrailsClient({
      antsApiKey,
      baseUrl: antsBaseUrl,
      agentId,
      guardrailServiceUrl,
      timeoutMs,
    });

    // Async lazy import for ESM compatibility
    this._initPromise = import("@aws-sdk/client-bedrock-runtime").then((mod) => {
      this.client = new mod.BedrockRuntimeClient({ region, ...bedrockOpts } as BedrockRuntimeClientConfig);
      this._ConverseCommand = mod.ConverseCommand;
    });
  }

  async converse(params: ConverseCommandInput): Promise<ConverseCommandOutput> {
    await this._initPromise;
    const inputText = extractInputText(params);

    const guardrailActive = this.guardrails.enabled;

    // STEP 1: Input guardrail check — no span yet
    let effectiveParams = params;
    if (guardrailActive) {
      const inputCheck = await this.guardrails.checkInput(inputText);
      if (inputCheck.result === "BLOCKED") {
        throw new GuardrailViolationError("input", inputCheck);
      }

      if (inputCheck.result === "SANITIZED" && inputCheck.sanitizedText) {
        effectiveParams = {
          ...params,
          messages: [{ role: "user" as const, content: [{ text: inputCheck.sanitizedText }] }],
        };
      }
    }

    // STEP 2: LLM call — still no span (output might be blocked)
    const response: ConverseCommandOutput = await this.client.send(
      new this._ConverseCommand(effectiveParams),
    );

    const outputText = extractOutputText(response);

    // STEP 3: Output guardrail check — still no span
    if (guardrailActive && outputText) {
      const outputCheck = await this.guardrails.checkOutput(outputText, inputText);
      if (outputCheck.result === "BLOCKED") {
        throw new GuardrailViolationError("output", outputCheck);
      }
    }

    // STEP 4: Both checks passed — NOW create and immediately end OTEL span
    const span = _tracing?.startObservation(
      this.agentName ?? `bedrock/${params.modelId}`,
      {
        model: params.modelId,
        input: { messages: params.messages },
        metadata: { provider: "bedrock", agentId: this.guardrails["agentId"] ?? "", guardrailResult: guardrailActive ? "PASS" : "NOT_CONFIGURED" },
      },
      { asType: "generation" },
    );

    span?.update({
      output: { role: "assistant", content: outputText },
      usageDetails: {
        input_tokens: response.usage?.inputTokens ?? 0,
        output_tokens: response.usage?.outputTokens ?? 0,
        total_tokens: (response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0),
      },
    });
    span?.end();

    // Send trace via ingestion API
    {
      sendTraceViaIngestion({
        antsApiKey: this.antsApiKey,
        baseUrl: this.antsBaseUrl,
        model: params.modelId ?? "unknown",
        provider: "bedrock",
        agentId: this.guardrails["agentId"],
        inputData: params.messages,
        outputData: outputText,
        usage: {
          input: response.usage?.inputTokens ?? 0,
          output: response.usage?.outputTokens ?? 0,
          total: (response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0),
        },
        latencyMs: undefined,
        guardrailResult: guardrailActive ? "PASS" : "NOT_CONFIGURED",
      }).catch(() => {});
    }

    return response;
  }
}

function extractInputText(params: ConverseCommandInput): string {
  if (!params.messages) return "";
  return params.messages
    .map((m) =>
      m.content
        ?.map((block) => ("text" in block && block.text ? block.text : ""))
        .join("\n"),
    )
    .join("\n");
}

function extractOutputText(response: ConverseCommandOutput): string {
  const output = response.output;
  if (!output || !("message" in output) || !output.message?.content) return "";
  return output.message.content
    .map((block) => ("text" in block && block.text ? block.text : ""))
    .join("");
}
