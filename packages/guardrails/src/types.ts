export interface Violation {
  scanner: string;
  details: string | null;
  action: string | null;
}

export interface GuardrailResult {
  result: "PASS" | "BLOCKED" | "SANITIZED";
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  sanitizedText?: string;
  violations: Violation[];
  guardrailAction?: string;
  blockedMessage?: string;
}

export function parseGuardrailResult(data: Record<string, unknown>): GuardrailResult {
  const violations: Violation[] = Array.isArray(data.violations)
    ? data.violations.map((v: Record<string, unknown>) => ({
        scanner: String(v.scanner ?? ""),
        details: v.details != null ? String(v.details) : null,
        action: v.action != null ? String(v.action) : null,
      }))
    : [];

  return {
    result: (data.result as GuardrailResult["result"]) ?? "PASS",
    riskScore: Number(data.riskScore ?? 0),
    riskLevel: (data.riskLevel as GuardrailResult["riskLevel"]) ?? "LOW",
    sanitizedText: data.sanitizedText != null ? String(data.sanitizedText) : undefined,
    violations,
    guardrailAction: data.guardrailAction != null ? String(data.guardrailAction) : undefined,
    blockedMessage: data.blockedMessage != null ? String(data.blockedMessage) : undefined,
  };
}
