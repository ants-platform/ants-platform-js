/**
 * Entry point. Loads env, boots tracing FIRST, runs one Operations Copilot
 * task end-to-end, then flushes spans so the full trace reaches Ants Platform.
 *
 *   pnpm --filter @antsplatform/example-mature-agent start
 */
import "dotenv/config";
// Tracing must be set up before anything that creates spans is imported/run.
import { shutdownTracing } from "./instrumentation.js";
import { runCopilot } from "./agents/orchestrator.js";

async function main() {
  const outcome = await runCopilot({
    sessionId: `sess_${Date.now()}`,
    userId: "operator@helio.example",
    customerId: "cus_8841",
    complaint:
      "Our analytics dashboard has been crawling all evening. There's a big " +
      "thunderstorm over Berlin right now — could that be related, or is it on your side?",
    place: { name: "Berlin", lat: 52.52, lon: 13.405 },
  });

  console.log("\n=== Outcome ===");
  console.log("Trace ID     :", outcome.traceId);
  console.log(
    "Likely cause :",
    outcome.finding.likelyCause,
    `(${outcome.finding.confidence})`,
  );
  console.log(
    "Groundedness :",
    outcome.score.groundedness,
    " Helpfulness:",
    outcome.score.helpfulness,
  );
  console.log("Blocked      :", outcome.blocked);
  console.log("\n--- Draft reply ---\n" + outcome.reply + "\n");
}

main()
  .catch((err) => {
    console.error("Run failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Flush the batched spans before the process exits.
    await shutdownTracing();
    console.log("[traces flushed to Ants Platform]");
  });
