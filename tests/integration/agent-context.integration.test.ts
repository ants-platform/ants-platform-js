import {
  startObservation,
  generateAgentId,
  validateAgentConfig,
  resolveAgentConfig,
  AntsPlatformOtelSpanAttributes,
} from "@ants-platform/tracing";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { SpanAssertions } from "./helpers/assertions.js";
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  waitForSpanExport,
  waitFor,
  type TestEnvironment,
} from "./helpers/testSetup.js";

// Mock project ID for testing - this bypasses the API fetch
const MOCK_PROJECT_ID = "proj-customer-support";

describe("Agent Context - generateAgentId", () => {
  it("should generate deterministic agent_id for same inputs", () => {
    const id1 = generateAgentId("qa_agent", "proj-customer-support");
    const id2 = generateAgentId("qa_agent", "proj-customer-support");

    expect(id1).toBe(id2);
  });

  it("should generate different IDs for different agent names", () => {
    const id1 = generateAgentId("qa_agent", "proj-customer-support");
    const id2 = generateAgentId("support_agent", "proj-customer-support");

    expect(id1).not.toBe(id2);
  });

  it("should generate different IDs for different projects", () => {
    const id1 = generateAgentId("qa_agent", "proj-123");
    const id2 = generateAgentId("qa_agent", "proj-456");

    expect(id1).not.toBe(id2);
  });

  it("should generate 16-character hex string", () => {
    const id = generateAgentId("qa_agent", "proj-customer-support");

    expect(id.length).toBe(16);
    expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
  });

  it("should throw error for empty agent name", () => {
    expect(() => generateAgentId("", "proj-123")).toThrow(
      "agentName must be a non-empty string",
    );
  });

  it("should throw error for empty project id", () => {
    expect(() => generateAgentId("qa_agent", "")).toThrow(
      "projectId must be a non-empty string",
    );
  });

  it("should handle long agent names by truncating", () => {
    const longName = "a".repeat(300);
    const id = generateAgentId(longName, "proj-123");

    // Should still generate valid ID
    expect(id.length).toBe(16);
    expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
  });

  it("should handle special characters in agent name", () => {
    const id = generateAgentId("qa_agent-v2.0", "proj-customer-support");

    expect(id.length).toBe(16);
    expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
  });

  it("should handle unicode characters", () => {
    const id = generateAgentId("qa_agent_日本語", "proj-123");

    expect(id.length).toBe(16);
    expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
  });

  it("should handle emoji characters", () => {
    const id = generateAgentId("qa_agent_🤖", "proj-123");

    expect(id.length).toBe(16);
    expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
  });
});

describe("Agent Context - validateAgentConfig", () => {
  it("should pass validation for valid config", () => {
    expect(() =>
      validateAgentConfig({
        projectId: "proj-customer-support",
        agentName: "qa_agent",
      }),
    ).not.toThrow();
  });

  it("should pass validation for config with optional display name", () => {
    expect(() =>
      validateAgentConfig({
        projectId: "proj-customer-support",
        agentName: "qa_agent",
        agentDisplayName: "QA Agent - Production",
      }),
    ).not.toThrow();
  });

  it("should throw error for missing projectId", () => {
    expect(() =>
      validateAgentConfig({
        projectId: "",
        agentName: "qa_agent",
      }),
    ).toThrow("projectId is required");
  });

  it("should throw error for missing agentName", () => {
    expect(() =>
      validateAgentConfig({
        projectId: "proj-customer-support",
        agentName: "",
      }),
    ).toThrow("agentName is required");
  });

  it("should throw error for whitespace-only projectId", () => {
    expect(() =>
      validateAgentConfig({
        projectId: "   ",
        agentName: "qa_agent",
      }),
    ).toThrow("projectId is required");
  });

  it("should throw error for whitespace-only agentName", () => {
    expect(() =>
      validateAgentConfig({
        projectId: "proj-customer-support",
        agentName: "   ",
      }),
    ).toThrow("agentName is required");
  });
});

describe("Agent Context - resolveAgentConfig", () => {
  it("should resolve valid config with generated ID", () => {
    const result = resolveAgentConfig({
      projectId: "proj-customer-support",
      agentName: "qa_agent",
      agentDisplayName: "QA Agent - Production",
    });

    expect(result.agentName).toBe("qa_agent");
    expect(result.agentDisplayName).toBe("QA Agent - Production");
    expect(result.projectId).toBe("proj-customer-support");
    expect(result.agentId.length).toBe(16);
    expect(/^[0-9a-f]{16}$/.test(result.agentId)).toBe(true);
  });

  it("should resolve config without display name", () => {
    const result = resolveAgentConfig({
      projectId: "proj-customer-support",
      agentName: "qa_agent",
    });

    expect(result.agentName).toBe("qa_agent");
    expect(result.agentDisplayName).toBeUndefined();
    expect(result.projectId).toBe("proj-customer-support");
    expect(result.agentId.length).toBe(16);
  });

  it("should generate same agent_id for same config", () => {
    const config = {
      projectId: "proj-customer-support",
      agentName: "qa_agent",
    };

    const result1 = resolveAgentConfig(config);
    const result2 = resolveAgentConfig(config);

    expect(result1.agentId).toBe(result2.agentId);
  });

  it("should generate same agent_id regardless of display name", () => {
    const result1 = resolveAgentConfig({
      projectId: "proj-customer-support",
      agentName: "qa_agent",
      agentDisplayName: "QA Agent v1",
    });

    const result2 = resolveAgentConfig({
      projectId: "proj-customer-support",
      agentName: "qa_agent",
      agentDisplayName: "QA Agent v2 - Updated",
    });

    expect(result1.agentId).toBe(result2.agentId);
  });

  it("should trim whitespace from inputs", () => {
    const result = resolveAgentConfig({
      projectId: "  proj-customer-support  ",
      agentName: "  qa_agent  ",
      agentDisplayName: "  QA Agent  ",
    });

    expect(result.agentName).toBe("qa_agent");
    expect(result.agentDisplayName).toBe("QA Agent");
    expect(result.projectId).toBe("proj-customer-support");
  });
});

describe("Agent Context - Span Processor Integration", () => {
  let testEnv: TestEnvironment;
  let assertions: SpanAssertions;

  beforeEach(async () => {
    testEnv = await setupTestEnvironment({
      spanProcessorConfig: {
        agent: {
          // projectId is auto-fetched from API in production
          // For tests, we use _testProjectId to bypass the API fetch
          agentName: "qa_agent",
          agentDisplayName: "QA Agent - Production",
        },
        // Use _testProjectId to bypass API fetch in tests
        _testProjectId: MOCK_PROJECT_ID,
      },
    });
    // Wait for agent config to be resolved
    await waitFor(50);
    assertions = new SpanAssertions(testEnv.mockExporter);
    void assertions; // Suppress unused variable warning
  });

  afterEach(async () => {
    await teardownTestEnvironment(testEnv);
  });

  it("should add agent attributes to spans", async () => {
    const span = startObservation("test-span", {
      input: { message: "test" },
    });
    span.end();

    await waitForSpanExport(testEnv.mockExporter, 1);

    const spanData = testEnv.mockExporter.getSpanByName("test-span");
    expect(spanData).toBeDefined();

    const attributes = spanData?.attributes;
    expect(attributes?.[AntsPlatformOtelSpanAttributes.AGENT_NAME]).toBe(
      "qa_agent",
    );
    expect(attributes?.[AntsPlatformOtelSpanAttributes.AGENT_DISPLAY_NAME]).toBe(
      "QA Agent - Production",
    );
    expect(attributes?.[AntsPlatformOtelSpanAttributes.PROJECT_ID]).toBe(
      MOCK_PROJECT_ID,
    );
    expect(attributes?.[AntsPlatformOtelSpanAttributes.AGENT_ID]).toMatch(
      /^[0-9a-f]{16}$/,
    );
  });

  it("should add same agent_id to all spans", async () => {
    const span1 = startObservation("span-1");
    span1.end();

    const span2 = startObservation("span-2");
    span2.end();

    await waitForSpanExport(testEnv.mockExporter, 2);

    const spanData1 = testEnv.mockExporter.getSpanByName("span-1");
    const spanData2 = testEnv.mockExporter.getSpanByName("span-2");

    expect(
      spanData1?.attributes?.[AntsPlatformOtelSpanAttributes.AGENT_ID],
    ).toBe(spanData2?.attributes?.[AntsPlatformOtelSpanAttributes.AGENT_ID]);
  });
});

describe("Agent Context - Span Processor Without Agent Config", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = await setupTestEnvironment();
  });

  afterEach(async () => {
    await teardownTestEnvironment(testEnv);
  });

  it("should not add agent attributes when no config provided", async () => {
    const span = startObservation("test-span", {
      input: { message: "test" },
    });
    span.end();

    await waitForSpanExport(testEnv.mockExporter, 1);

    const spanData = testEnv.mockExporter.getSpanByName("test-span");
    expect(spanData).toBeDefined();

    const attributes = spanData?.attributes;
    expect(
      attributes?.[AntsPlatformOtelSpanAttributes.AGENT_ID],
    ).toBeUndefined();
    expect(
      attributes?.[AntsPlatformOtelSpanAttributes.AGENT_NAME],
    ).toBeUndefined();
    expect(
      attributes?.[AntsPlatformOtelSpanAttributes.AGENT_DISPLAY_NAME],
    ).toBeUndefined();
    expect(
      attributes?.[AntsPlatformOtelSpanAttributes.PROJECT_ID],
    ).toBeUndefined();
  });
});

describe("Agent Context - Collision Resistance", () => {
  it("should generate different IDs for similar agent names", () => {
    const agents = [
      ["qa_agent", "qa_agent_2"],
      ["qa", "agent"],
      ["q", "a_agent"],
      ["test", "test1"],
    ];

    for (const [name1, name2] of agents) {
      const id1 = generateAgentId(name1, "proj-123");
      const id2 = generateAgentId(name2, "proj-123");
      expect(id1).not.toBe(id2);
    }
  });

  it("should produce consistent results across multiple calls", () => {
    const runs = 100;
    const expectedId = generateAgentId("qa_agent", "proj-customer-support");

    for (let i = 0; i < runs; i++) {
      const id = generateAgentId("qa_agent", "proj-customer-support");
      expect(id).toBe(expectedId);
    }
  });
});

describe("Agent Context - Transfer Safety", () => {
  it("should generate same agent_id when project transfers between orgs", () => {
    // The key insight: projectId stays constant during transfers
    // So agent_id remains stable even if organization changes
    const projectId = "proj-customer-support";
    const agentName = "qa_agent";

    const id1 = generateAgentId(agentName, projectId);
    const id2 = generateAgentId(agentName, projectId);

    expect(id1).toBe(id2);
  });

  it("should include both agentName and projectId in hash", () => {
    // Different projects should produce different IDs even for same agent
    const agentName = "qa_agent";

    const id1 = generateAgentId(agentName, "proj-org-a");
    const id2 = generateAgentId(agentName, "proj-org-b");

    expect(id1).not.toBe(id2);
  });
});
