/**
 * OpenAI clients, wrapped with `observeOpenAI` so every chat completion becomes
 * a `generation` observation nested under whatever span is active when it runs —
 * with real model name, token usage, and cost captured automatically.
 *
 * Two model tiers, as a real agent would use:
 *   - `fast`      — cheap/low-latency model for routing + lookups.
 *   - `reasoning` — stronger model for the researcher sub-agent + synthesis.
 */
import OpenAI from "openai";
import { observeOpenAI } from "ants-platform";

export const FAST_MODEL = process.env.ANTS_FAST_MODEL ?? "gpt-4o-mini";
export const REASONING_MODEL = process.env.ANTS_REASONING_MODEL ?? "gpt-4o";

const raw = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Wrap once per logical use-site so the generation gets a meaningful name.
 * Pin `traceName` on every client: observeOpenAI sets the trace name per call,
 * so without a shared value the last generation's name would win the trace.
 */
function client(generationName: string, tags: string[]) {
  return observeOpenAI(raw, {
    generationName,
    tags,
    traceName: "ops-copilot-run",
  });
}

export const llm = {
  router: client("router", ["fast"]),
  research: client("researcher-llm", ["reasoning"]),
  synthesis: client("synthesis", ["reasoning"]),
  judge: client("evaluator-llm", ["fast"]),
};

/** Small helper: a single chat turn that returns the assistant text. */
export async function chat(
  c: OpenAI,
  model: string,
  system: string,
  user: string,
  opts: { json?: boolean; temperature?: number } = {},
): Promise<string> {
  const res = await c.chat.completions.create({
    model,
    temperature: opts.temperature ?? 0.2,
    response_format: opts.json ? { type: "json_object" } : undefined,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}
