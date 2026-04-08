import { describe, expect, it } from "vitest";

import type { GuardrailResult } from "../types.js";

import { effectiveText, overallGuardrailResult } from "./guardrail-utils.js";

const passResult: GuardrailResult = {
  result: "PASS",
  riskScore: 0,
  riskLevel: "LOW",
  violations: [],
};

describe("guardrail-utils", () => {
  it("marks disabled guardrails as not configured", () => {
    expect(overallGuardrailResult(false)).toBe("NOT_CONFIGURED");
  });

  it("marks sanitized input as sanitized", () => {
    expect(
      overallGuardrailResult(true, {
        ...passResult,
        result: "SANITIZED",
        sanitizedText: "[REDACTED]",
      }),
    ).toBe("SANITIZED");
  });

  it("marks sanitized output as sanitized", () => {
    expect(
      overallGuardrailResult(true, undefined, {
        ...passResult,
        result: "SANITIZED",
        sanitizedText: "[REDACTED]",
      }),
    ).toBe("SANITIZED");
  });

  it("uses sanitized text even when it is empty", () => {
    expect(
      effectiveText("secret", {
        ...passResult,
        result: "SANITIZED",
        sanitizedText: "",
      }),
    ).toBe("");
  });

  it("keeps the original text when there is no sanitization", () => {
    expect(effectiveText("safe", passResult)).toBe("safe");
  });
});
