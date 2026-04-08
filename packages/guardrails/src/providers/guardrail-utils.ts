import type { GuardrailResult } from "../types.js";

export function overallGuardrailResult(
  guardrailActive: boolean,
  inputCheck?: GuardrailResult,
  outputCheck?: GuardrailResult,
): "PASS" | "SANITIZED" | "NOT_CONFIGURED" {
  if (!guardrailActive) {
    return "NOT_CONFIGURED";
  }
  if (inputCheck?.result === "SANITIZED" || outputCheck?.result === "SANITIZED") {
    return "SANITIZED";
  }
  return "PASS";
}

export function effectiveText(originalText: string, check?: GuardrailResult): string {
  if (check?.result === "SANITIZED" && check.sanitizedText !== undefined) {
    return check.sanitizedText;
  }
  return originalText;
}
