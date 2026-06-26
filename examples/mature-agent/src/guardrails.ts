/**
 * Input/output policy enforcement via `AntsGuardrailsClient`. When the
 * guardrails env vars are set the check is a real backend call; otherwise the
 * client short-circuits to PASS. Either way we record a `guardrail` observation
 * so the safety step is always visible in the trace.
 */
import { AntsGuardrailsClient, startActiveObservation } from "ants-platform";
import type { GuardrailResult } from "ants-platform";

const client = new AntsGuardrailsClient({
  antsApiKey:
    process.env.ANTS_GUARDRAILS_API_KEY ??
    `${process.env.ANTS_PLATFORM_PUBLIC_KEY}:${process.env.ANTS_PLATFORM_SECRET_KEY}`,
  agentId: process.env.ANTS_GUARDRAILS_AGENT_ID,
});

async function guard(
  name: string,
  text: string,
  check: (t: string) => Promise<GuardrailResult>,
): Promise<GuardrailResult> {
  return startActiveObservation(
    name,
    async (g) => {
      g.update({ input: { text }, metadata: { enabled: client.enabled } });
      const result = await check(text);
      g.update({
        output: result,
        level: result.result === "BLOCKED" ? "ERROR" : "DEFAULT",
      });
      return result;
    },
    { asType: "guardrail" },
  );
}

export const checkInput = (text: string) =>
  guard("guardrail:input", text, (t) => client.checkInput(t));

export const checkOutput = (text: string, inputText: string) =>
  guard("guardrail:output", text, (t) => client.checkOutput(t, inputText));
