/**
 * MCP client. Spawns the runbook MCP server (./mcp-server.ts) over stdio and
 * calls its `read_runbook` tool. The call is wrapped in a `tool` observation so
 * the MCP round-trip is a first-class node in the trace.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startActiveObservation } from "ants-platform";

const here = dirname(fileURLToPath(import.meta.url));
const SERVER = join(here, "mcp-server.ts");

/** Read a runbook section via the MCP server, traced as a tool call. */
export function readRunbookViaMcp(topic: string): Promise<string> {
  return startActiveObservation(
    "mcp:read_runbook",
    async (tool) => {
      tool.update({
        input: { topic },
        metadata: {
          protocol: "mcp",
          transport: "stdio",
          server: "ops-runbook",
        },
      });

      // Real MCP: spawn the server as a subprocess and speak JSON-RPC to it.
      const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "tsx", SERVER],
      });
      const client = new Client(
        { name: "ops-copilot", version: "1.0.0" },
        { capabilities: {} },
      );

      try {
        await client.connect(transport);
        const tools = await client.listTools();
        tool.update({
          metadata: { availableTools: tools.tools.map((t) => t.name) },
        });

        const res = await client.callTool({
          name: "read_runbook",
          arguments: { topic },
        });
        const content = res.content as { type: string; text?: string }[];
        const text = content.map((c) => c.text ?? "").join("\n");

        tool.update({ output: text });
        return text;
      } finally {
        await client.close();
      }
    },
    { asType: "tool" },
  );
}
