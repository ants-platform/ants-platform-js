/**
 * LLM-as-judge scoring of the drafted reply, traced as an `evaluator`
 * observation. The numeric score is attached to the evaluator span so it shows
 * up alongside the generation it grades.
 */
import { startActiveObservation } from "ants-platform";
import { chat, FAST_MODEL, llm } from "./llm.js";

export interface Score {
  groundedness: number; // 0..1
  helpfulness: number; // 0..1
  comment: string;
}

/** Grade a draft reply against the evidence it was supposed to use. */
export function evaluate(draft: string, evidence: string): Promise<Score> {
  return startActiveObservation(
    "evaluator:reply-quality",
    async (ev) => {
      ev.update({
        input: { draft, evidence },
        metadata: { method: "llm-as-judge", model: FAST_MODEL },
      });

      const raw = await chat(
        llm.judge,
        FAST_MODEL,
        "You grade a support reply. Score groundedness (is every claim supported " +
          "by the evidence?) and helpfulness (does it address the customer?) each " +
          'from 0 to 1. Respond as JSON: {"groundedness": number, "helpfulness": number, "comment": string}.',
        `Evidence:\n${evidence}\n\nReply:\n${draft}`,
        { json: true, temperature: 0 },
      );

      const score = JSON.parse(raw) as Score;
      ev.update({
        output: score,
        metadata: {
          groundedness: score.groundedness,
          helpfulness: score.helpfulness,
        },
      });
      return score;
    },
    { asType: "evaluator" },
  );
}
