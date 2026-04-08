/**
 * Ingestion API fallback for when OTEL tracing is not configured.
 *
 * Sends trace + generation events via POST /api/public/ingestion so that
 * LLM calls still appear in the platform even without the @antsplatform/tracing
 * package installed.
 *
 * Fire-and-forget: callers should invoke with `.catch(() => {})`.
 */

function generateId(): string {
  return (
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
}

function buildAuthHeader(antsApiKey: string): string {
  const [publicKey, secretKey] = antsApiKey.split(":");
  return `Basic ${btoa(`${publicKey}:${secretKey}`)}`;
}

export interface IngestionFallbackParams {
  antsApiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
  agentId?: string;
  inputData: unknown;
  outputData: unknown;
  usage?: { input: number; output: number; total: number };
  latencyMs?: number;
  guardrailResult?: string;
  tags?: string[];
}

export async function sendTraceViaIngestion(
  params: IngestionFallbackParams,
): Promise<void> {
  const {
    antsApiKey,
    baseUrl,
    model,
    provider,
    agentId,
    inputData,
    outputData,
    usage,
    latencyMs,
    guardrailResult,
    tags,
  } = params;

  const traceId = generateId();
  const obsId = generateId();
  const now = new Date().toISOString();

  const inputTokens = usage?.input ?? 0;
  const outputTokens = usage?.output ?? 0;
  const totalTokens = usage?.total ?? 0;

  const allTags = [...(tags ?? []), "ants-sdk"];
  if (agentId) allTags.push(`agent:${agentId}`);

  const traceMetadata: Record<string, string> = {
    source: "ants-sdk",
    source_platform: provider,
    provider,
    model,
    status: "success",
    input_tokens: String(inputTokens),
    output_tokens: String(outputTokens),
    total_tokens: String(totalTokens),
  };

  if (agentId) traceMetadata.agent_id = agentId;
  if (latencyMs != null) traceMetadata.latency_ms = String(latencyMs);
  if (guardrailResult) traceMetadata.guardrail_result = guardrailResult;

  const batch = [
    {
      id: generateId(),
      type: "trace-create",
      timestamp: now,
      body: {
        id: traceId,
        timestamp: now,
        name: `${provider}/${model}`,
        input: inputData,
        output: outputData,
        tags: allTags,
        metadata: traceMetadata,
        agentId,
      },
    },
    {
      id: generateId(),
      type: "generation-create",
      timestamp: now,
      body: {
        id: obsId,
        traceId,
        name: model,
        startTime: now,
        endTime: now,
        model,
        input: inputData,
        output: outputData,
        usage: usage
          ? {
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              totalTokens: totalTokens,
            }
          : undefined,
        agentId,
        metadata: {
          source_platform: provider,
          provider,
          model,
          latency_ms: latencyMs != null ? String(latencyMs) : undefined,
          guardrail_result: guardrailResult,
        },
      },
    },
  ];

  const res = await fetch(`${baseUrl}/api/public/ingestion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: buildAuthHeader(antsApiKey),
    },
    body: JSON.stringify({ batch }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ingestion failed (${res.status}): ${body}`);
  }
}
