/**
 * A real, standalone MCP server spoken over stdio JSON-RPC. The agent process
 * spawns this as a child and calls its `read_runbook` tool (see ./mcp.ts).
 *
 * This is deliberately a separate process talking the real Model Context
 * Protocol — not an in-process mock — so the trace reflects a genuine MCP hop.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const RUNBOOK = join(here, "..", "..", "data", "runbook.md");

const server = new Server(
  { name: "ops-runbook", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_runbook",
      description:
        "Return the ops runbook section for a topic (e.g. 'dashboard-slow').",
      inputSchema: {
        type: "object",
        properties: { topic: { type: "string" } },
        required: ["topic"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== "read_runbook") {
    throw new Error(`Unknown tool ${req.params.name}`);
  }
  const topic = String(
    (req.params.arguments as { topic?: string })?.topic ?? "",
  );
  const doc = await readFile(RUNBOOK, "utf8");

  // Extract just the "## <topic>" section.
  const sections = doc.split(/^## /m);
  const match = sections.find((s) =>
    s.toLowerCase().startsWith(topic.toLowerCase()),
  );
  const text = match
    ? `## ${match.trim()}`
    : `No runbook section for "${topic}".`;

  return { content: [{ type: "text", text }] };
});

await server.connect(new StdioServerTransport());
