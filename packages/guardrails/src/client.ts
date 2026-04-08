/**
 * Guardrail checking client.
 *
 * Guardrails are only active when an `agentId` is provided AND the agent has
 * a guardrail policy configured on the platform. If no policy exists, the
 * client caches that fact and skips HTTP calls on subsequent requests.
 *
 * Platform tracing (OTEL spans in `default.traces`) is always recorded via
 * the provider wrappers regardless of guardrail state.
 */

import { parseGuardrailResult, type GuardrailResult } from "./types.js";

const DEFAULT_BASE_URL = "https://app.antsplatform.com";
const DEFAULT_TIMEOUT_MS = 30_000;

/** Returned when guardrails are disabled or no policy is configured. */
const PASS_RESULT: GuardrailResult = Object.freeze({
  result: "PASS" as const,
  riskScore: 0,
  riskLevel: "LOW" as const,
  sanitizedText: undefined,
  violations: [],
});

export interface AntsGuardrailsClientOptions {
  antsApiKey: string;
  baseUrl?: string;
  agentId?: string;
  guardrailServiceUrl?: string;
  timeoutMs?: number;
}

export class AntsGuardrailsClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  readonly agentId?: string;
  private readonly guardrailServiceUrl?: string;
  private readonly timeoutMs: number;

  /**
   * Cached policy-exists flag.
   *   - `undefined` → not yet checked
   *   - `true` → policy exists, run guardrail checks
   *   - `false` → no policy for this agent, skip all checks
   */
  private _policyExists: boolean | undefined;

  /** Whether guardrail checks are enabled (requires agentId). */
  get enabled(): boolean {
    return !!this.agentId;
  }

  constructor(opts: AntsGuardrailsClientOptions) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.agentId = opts.agentId;
    this.guardrailServiceUrl = opts.guardrailServiceUrl;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const [publicKey, secretKey] = opts.antsApiKey.split(":");
    if (!publicKey || !secretKey) {
      throw new Error(
        "Invalid antsApiKey format. Expected 'publicKey:secretKey'.",
      );
    }
    this.authHeader = `Basic ${btoa(`${publicKey}:${secretKey}`)}`;
  }

  async checkInput(text: string): Promise<GuardrailResult> {
    return this.check(text, "input");
  }

  async checkOutput(
    text: string,
    inputText?: string,
  ): Promise<GuardrailResult> {
    return this.check(text, "output", inputText);
  }

  private async check(
    text: string,
    direction: "input" | "output",
    inputText?: string,
  ): Promise<GuardrailResult> {
    // No agentId → no guardrail configured → skip
    if (!this.agentId) return PASS_RESULT;

    // Cached: we already know there's no policy for this agent
    if (this._policyExists === false) return PASS_RESULT;

    const body: Record<string, unknown> = {
      text,
      direction,
      agentId: this.agentId,
    };
    if (direction === "output" && inputText) {
      body.inputText = inputText;
    }

    const url = this.guardrailServiceUrl
      ? `${this.guardrailServiceUrl}/api/v1/guardrail-check`
      : `${this.baseUrl}/api/public/v1/guardrails/ml-check`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.authHeader,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "Unknown error");
        throw new Error(
          `ANTS guardrails check failed (${res.status}): ${errBody}`,
        );
      }

      const data = (await res.json()) as Record<string, unknown>;
      const result = parseGuardrailResult(data);

      // If the response has no guardrailAction, it means no policy was found.
      // Cache this to skip future HTTP calls for this agent.
      if (!data.guardrailAction) {
        this._policyExists = false;
        return PASS_RESULT;
      }

      this._policyExists = true;
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }
}
