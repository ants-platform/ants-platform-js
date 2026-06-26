/**
 * A second, independent agent invoked by the orchestrator as a tool. It is
 * traced as its own nested `agent` observation, so the trace shows true
 * agent-to-agent delegation (and the researcher's own LLM generation nests
 * under it automatically via observeOpenAI).
 */
import { startActiveObservation } from "ants-platform";
import { chat, llm, REASONING_MODEL } from "../llm.js";

export interface ResearchInput {
  complaint: string;
  runbook: string;
  weather: string;
  pastIncidents: string;
}

export interface ResearchFinding {
  likelyCause: string;
  confidence: "low" | "medium" | "high";
  rationale: string;
}

/** Delegate root-cause analysis to the researcher sub-agent. */
export function research(input: ResearchInput): Promise<ResearchFinding> {
  return startActiveObservation(
    "agent:researcher",
    async (agent) => {
      agent.update({
        input,
        metadata: { role: "root-cause-analyst", model: REASONING_MODEL },
      });

      const raw = await chat(
        llm.research,
        REASONING_MODEL,
        "You are an SRE root-cause analyst. Given a customer complaint, the ops " +
          "runbook, current weather, and past incidents, identify the single most " +
          "likely cause. Respond as JSON: " +
          `{"likelyCause": string, "confidence": "low"|"medium"|"high", "rationale": string}.`,
        `Complaint: ${input.complaint}\n\nRunbook:\n${input.runbook}\n\n` +
          `Current weather: ${input.weather}\n\nPast incidents:\n${input.pastIncidents}`,
        { json: true, temperature: 0 },
      );

      const finding = JSON.parse(raw) as ResearchFinding;
      agent.update({ output: finding });
      return finding;
    },
    { asType: "agent" },
  );
}
