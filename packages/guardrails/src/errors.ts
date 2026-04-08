import type { GuardrailResult } from "./types.js";

export class GuardrailViolationError extends Error {
  public readonly direction: "input" | "output";
  public readonly guardrailResult: GuardrailResult;

  constructor(direction: "input" | "output", result: GuardrailResult) {
    const blockedMessage = result.blockedMessage?.trim();
    if (blockedMessage) {
      super(blockedMessage);
    } else {
      const details = result.violations
        .map((v) => `${v.scanner}: ${v.details ?? "blocked"}`)
        .join("; ");
      super(
        `Guardrail violation on ${direction}: ${details || "Content blocked"}`,
      );
    }
    this.name = "GuardrailViolationError";
    this.direction = direction;
    this.guardrailResult = result;
  }
}
