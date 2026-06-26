/**
 * The Operations Copilot — the root agent. Everything it does runs inside a
 * single `startActiveObservation('ops-copilot', ..., { asType: 'agent' })`, so
 * the DB lookup, MCP call, weather call, researcher sub-agent, every LLM
 * generation, the guardrails, the evaluator, and the desktop notification all
 * nest under ONE trace that lands end-to-end on the Ants Platform backend.
 */
import {
  startActiveObservation,
  startObservation,
  updateActiveTrace,
} from "ants-platform";
import { chat, FAST_MODEL, llm, REASONING_MODEL } from "../llm.js";
import { lookupAccount } from "../db.js";
import { checkInput, checkOutput } from "../guardrails.js";
import { readRunbookViaMcp } from "../tools/mcp.js";
import { getWeather } from "../tools/weather.js";
import { notifyDesktop } from "../tools/desktop.js";
import { research } from "./researcher.js";
import { evaluate } from "../evaluator.js";

export interface Task {
  sessionId: string;
  userId: string;
  customerId: string;
  complaint: string;
  place: { name: string; lat: number; lon: number };
}

export interface Outcome {
  traceId: string;
  reply: string;
  blocked: boolean;
  finding: { likelyCause: string; confidence: string };
  score: { groundedness: number; helpfulness: number };
}

interface Plan {
  topic: string;
  needsWeather: boolean;
}

export function runCopilot(task: Task): Promise<Outcome> {
  return startActiveObservation(
    "ops-copilot",
    async (agent): Promise<Outcome> => {
      // Tag the whole trace so it's filterable in the Ants UI.
      updateActiveTrace({
        name: "ops-copilot-run",
        sessionId: task.sessionId,
        userId: task.userId,
        tags: ["example", "support"],
        input: { complaint: task.complaint, customerId: task.customerId },
      });
      agent.update({ input: task });
      const traceId = agent.traceId;

      // 1. Guardrail the inbound request.
      const inGuard = await checkInput(task.complaint);
      if (inGuard.result === "BLOCKED") {
        agent.update({ output: { blocked: true }, level: "WARNING" });
        return blockedOutcome(traceId);
      }

      // 2. Router (fast model) turns the complaint into a small plan.
      const planRaw = await chat(
        llm.router,
        FAST_MODEL,
        "Classify the support request. Respond as JSON " +
          `{"topic": "dashboard-slow"|"billing-discrepancy"|"other", "needsWeather": boolean}. ` +
          "Set needsWeather true only if the customer blames local network/weather.",
        task.complaint,
        { json: true, temperature: 0 },
      );
      const plan = JSON.parse(planRaw) as Plan;

      // 3. Retrieve account context from the DB, read the runbook over MCP, and
      //    (if relevant) hit the weather integration — independent I/O in parallel.
      const [account, runbook, weather] = await Promise.all([
        lookupAccount(task.customerId),
        readRunbookViaMcp(plan.topic),
        plan.needsWeather
          ? getWeather(task.place.name, task.place.lat, task.place.lon)
          : Promise.resolve(null),
      ]);

      const weatherStr = weather
        ? `${task.place.name}: ${weather.temperatureC}C, ${weather.windKph}kph wind, ${weather.description}`
        : "not relevant";
      const pastIncidentsStr = account.pastIncidents
        .map((i) => `- [${i.topic}] ${i.summary}`)
        .join("\n");

      // 4. Delegate root-cause analysis to the researcher SUB-AGENT (reasoning model).
      const finding = await research({
        complaint: task.complaint,
        runbook,
        weather: weatherStr,
        pastIncidents: pastIncidentsStr,
      });

      // 5. Synthesize the customer-facing reply (reasoning model).
      const evidence =
        `Customer: ${account.customer.name} (${account.customer.plan}, ${account.customer.region})\n` +
        `Likely cause: ${finding.likelyCause} (confidence ${finding.confidence})\n` +
        `Rationale: ${finding.rationale}\nWeather: ${weatherStr}\nRunbook:\n${runbook}`;
      const reply = await chat(
        llm.synthesis,
        REASONING_MODEL,
        "Write a concise, friendly support reply (max 120 words). Only state " +
          "things supported by the evidence. Do not invent metrics.",
        `Complaint: ${task.complaint}\n\nEvidence:\n${evidence}`,
        { temperature: 0.3 },
      );

      // 6. Guardrail the outbound reply.
      const outGuard = await checkOutput(reply, task.complaint);
      const finalReply =
        outGuard.result === "SANITIZED" && outGuard.sanitizedText
          ? outGuard.sanitizedText
          : reply;

      // 7. Score the reply with an evaluator (LLM-as-judge).
      const score = await evaluate(finalReply, evidence);

      // 8. Desktop tool: notify the human operator the draft is ready.
      await notifyDesktop(
        "Ops Copilot",
        `Draft ready for ${account.customer.name} — groundedness ${score.groundedness.toFixed(2)}`,
      );

      // 9. Point-in-time event marking completion (auto-ended).
      startObservation(
        "task-complete",
        { input: { customerId: task.customerId, topic: plan.topic } },
        { asType: "event" },
      );

      const outcome: Outcome = {
        traceId,
        reply: finalReply,
        blocked: outGuard.result === "BLOCKED",
        finding: {
          likelyCause: finding.likelyCause,
          confidence: finding.confidence,
        },
        score: {
          groundedness: score.groundedness,
          helpfulness: score.helpfulness,
        },
      };
      agent.update({ output: outcome });
      // Set the trace name LAST so it isn't overwritten by the generations'
      // own trace-name updates (observeOpenAI sets it per call).
      updateActiveTrace({
        name: "ops-copilot-run",
        output: { reply: finalReply },
      });
      return outcome;
    },
    { asType: "agent" },
  );
}

function blockedOutcome(traceId: string): Outcome {
  return {
    traceId,
    reply: "Request blocked by input guardrail.",
    blocked: true,
    finding: { likelyCause: "n/a", confidence: "n/a" },
    score: { groundedness: 0, helpfulness: 0 },
  };
}
