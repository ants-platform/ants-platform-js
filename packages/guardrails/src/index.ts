/**
 * ANTS Guardrails — LLM input/output policy enforcement.
 *
 * Works in two modes:
 *
 * **Mode 1: Standalone** (guardrails only, no platform tracing):
 * ```ts
 * import { AntsGuardrailsClient, GuardrailViolationError } from "@antsplatform/guardrails";
 *
 * const guardrails = new AntsGuardrailsClient({ antsApiKey: "pk:sk", agentId: "agent_123" });
 * const result = await guardrails.checkInput("My SSN is 123-45-6789");
 * if (result.result === "BLOCKED") throw new GuardrailViolationError("input", result);
 * ```
 *
 * **Mode 2: Platform-integrated** (auto-creates guardrail spans):
 * ```ts
 * import { AntsPlatformClient } from "@antsplatform/client";
 * import { AntsGuardrailsClient } from "@antsplatform/guardrails";
 *
 * const ants = new AntsPlatformClient({ publicKey: "pk", secretKey: "sk" });
 * const guardrails = new AntsGuardrailsClient({ antsApiKey: "pk:sk", agentId: "agent_123" });
 * // guardrail checks auto-create spans in active traces
 * ```
 *
 * **Provider wrappers** (drop-in replacements with guardrails built-in):
 * ```ts
 * import { AntsBedrock } from "@antsplatform/guardrails/providers/bedrock";
 * import { AntsAnthropic } from "@antsplatform/guardrails/providers/anthropic";
 * import { AntsOpenAI } from "@antsplatform/guardrails/providers/openai";
 * import { AntsGoogleGenAI } from "@antsplatform/guardrails/providers/google-genai";
 * import { AntsVertexAI } from "@antsplatform/guardrails/providers/vertex";
 * ```
 */

export {
  AntsGuardrailsClient,
  type AntsGuardrailsClientOptions,
} from "./client.js";
export { GuardrailViolationError } from "./errors.js";
export {
  type GuardrailResult,
  type Violation,
  parseGuardrailResult,
} from "./types.js";
