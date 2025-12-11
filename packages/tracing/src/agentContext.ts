import {
  getGlobalLogger,
  AntsPlatformAPIClient,
  ANTS_PLATFORM_SDK_VERSION,
} from "@antsplatform/core";
import { blake2b } from "@noble/hashes/blake2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * Configuration for agent identification in Ants Platform.
 *
 * These parameters are used to identify and track agents in the AI Command Center.
 * The project_id is automatically fetched from the API using your credentials,
 * matching the behavior of the Python SDK.
 *
 * @public
 */
export interface AgentConfig {
  /**
   * Agent identifier (stable, required, **cannot change**).
   * This is used as part of the deterministic agent_id generation.
   * Once set, this should never be changed as it will affect the generated agent_id.
   *
   * @example "qa_agent", "customer_support_bot", "data_processor"
   */
  agentName: string;

  /**
   * Human-readable display name (optional, mutable).
   * This can be changed via the updateAgentDisplayName API without affecting the agent_id.
   *
   * @example "QA Agent - Production", "Customer Support Bot v2"
   */
  agentDisplayName?: string;
}

/**
 * Legacy configuration for agent identification with explicit projectId.
 * Used internally by resolveAgentConfig when projectId is already known.
 *
 * @internal
 */
export interface AgentConfigWithProjectId extends AgentConfig {
  /**
   * Project identifier (stable, required).
   * This should be a stable identifier for your project.
   * Used in agent_id generation for transfer safety (when projects move between orgs).
   */
  projectId: string;
}

/**
 * Resolved agent configuration with computed agent_id.
 *
 * @public
 */
export interface ResolvedAgentConfig {
  /**
   * Deterministic agent ID generated from agentName and projectId.
   * Formula: BLAKE2b-64(agent_name + project_id) = 16-character hex string
   */
  agentId: string;

  /**
   * Agent name (immutable identifier).
   */
  agentName: string;

  /**
   * Human-readable display name (mutable).
   */
  agentDisplayName?: string;

  /**
   * Project identifier.
   */
  projectId: string;
}

/**
 * Maximum length for agent names.
 */
const MAX_AGENT_NAME_LENGTH = 255;

/**
 * Generates a deterministic agent_id using BLAKE2b-64.
 *
 * Formula: `agent_id = BLAKE2b-64(agent_name + project_id)` = 16-character hex string
 *
 * Design Decision: Include projectId in hash for transfer safety.
 * When projects transfer between organizations, projectId stays constant,
 * so agent_id remains stable across transfers.
 *
 * @param agentName - Agent name (immutable identifier)
 * @param projectId - Project ID
 * @returns 16-character hex string (64 bits)
 *
 * @example
 * ```typescript
 * const agentId = generateAgentId("qa_agent", "proj-customer-support");
 * // Returns: "1fdb77db0603771f" (deterministic)
 * ```
 *
 * @public
 */
export function generateAgentId(agentName: string, projectId: string): string {
  const logger = getGlobalLogger();

  // Validate inputs
  if (!agentName || typeof agentName !== "string") {
    throw new Error("agentName must be a non-empty string");
  }
  if (!projectId || typeof projectId !== "string") {
    throw new Error("projectId must be a non-empty string");
  }

  // Truncate if too long
  let name = agentName.trim();
  if (name.length > MAX_AGENT_NAME_LENGTH) {
    logger.warn(
      `agentName too long (${name.length} chars), truncated to ${MAX_AGENT_NAME_LENGTH} characters`,
    );
    name = name.slice(0, MAX_AGENT_NAME_LENGTH);
  }

  // Generate BLAKE2b-64 hash (8 bytes = 16 hex chars)
  // Hash both agent_name and project_id together
  const agentId = blake2b64(name, projectId.trim());

  logger.debug(`[AGENT_ID] Generated: ${agentId} from agent_name: ${name}`);

  return agentId;
}

/**
 * BLAKE2b-64 hash implementation (8 bytes = 16 hex characters).
 *
 * Uses @noble/hashes for true BLAKE2b with configurable digest size.
 * This matches Python's hashlib.blake2b(digest_size=8) exactly.
 *
 * Implementation matches Python SDK:
 * ```python
 * hasher = hashlib.blake2b(digest_size=8)
 * hasher.update(agent_name.encode('utf-8'))
 * hasher.update(project_id.encode('utf-8'))
 * agent_id = hasher.hexdigest()
 * ```
 *
 * And Java SDK:
 * ```java
 * Blake2b blake2b = new Blake2b(DIGEST_SIZE);
 * blake2b.update(agentName.getBytes(StandardCharsets.UTF_8));
 * blake2b.update(projectId.getBytes(StandardCharsets.UTF_8));
 * byte[] hash = blake2b.digest();
 * ```
 *
 * @param agentName - First input to hash (agent_name)
 * @param projectId - Second input to hash (project_id)
 * @returns 16-character hex string
 * @internal
 */
function blake2b64(agentName: string, projectId: string): string {
  const encoder = new TextEncoder();

  // Encode inputs separately (matches Python/Java SDK approach)
  const agentNameBytes = encoder.encode(agentName);
  const projectIdBytes = encoder.encode(projectId);

  // Concatenate bytes (equivalent to sequential updates in BLAKE2b)
  // BLAKE2b: hash.update(A).update(B) === hash.update(A + B)
  const combined = new Uint8Array(agentNameBytes.length + projectIdBytes.length);
  combined.set(agentNameBytes, 0);
  combined.set(projectIdBytes, agentNameBytes.length);

  // BLAKE2b with 8-byte (64-bit) output - matches Python's digest_size=8
  const hash = blake2b(combined, { dkLen: 8 });

  return bytesToHex(hash);
}

/**
 * Validates agent configuration parameters.
 *
 * @param config - Agent configuration to validate
 * @throws {Error} If any required field is missing or invalid
 *
 * @public
 */
export function validateAgentConfig(config: AgentConfigWithProjectId): void {
  if (!config.projectId || !config.projectId.trim()) {
    throw new Error("projectId is required");
  }

  if (!config.agentName || !config.agentName.trim()) {
    throw new Error("agentName is required");
  }
}

/**
 * Resolves agent configuration by generating the agent_id.
 *
 * @param config - Agent configuration with projectId
 * @returns Resolved agent configuration with computed agent_id
 * @throws {Error} If configuration is invalid
 *
 * @example
 * ```typescript
 * const resolved = resolveAgentConfig({
 *   projectId: "proj-customer-support",
 *   agentName: "qa_agent",
 *   agentDisplayName: "QA Agent - Production"
 * });
 *
 * console.log(resolved.agentId); // "1fdb77db0603771f"
 * console.log(resolved.agentName); // "qa_agent"
 * ```
 *
 * @public
 */
export function resolveAgentConfig(config: AgentConfigWithProjectId): ResolvedAgentConfig {
  // Validate required fields
  validateAgentConfig(config);

  // Generate deterministic agent_id using BLAKE2b-64
  const agentId = generateAgentId(config.agentName.trim(), config.projectId.trim());

  return {
    agentId,
    agentName: config.agentName.trim(),
    agentDisplayName: config.agentDisplayName?.trim(),
    projectId: config.projectId.trim(),
  };
}

/**
 * Fetches the project_id from the Ants Platform API.
 *
 * This function makes an API call to retrieve the project ID associated with the
 * provided credentials. It matches the Python/Java SDK behavior where project_id
 * is fetched from `GET /api/public/projects` → `data[0].id`.
 *
 * @param baseUrl - The Ants Platform API base URL
 * @param publicKey - The public API key for authentication
 * @param secretKey - The secret API key for authentication
 * @returns Promise resolving to the project ID, or null if unavailable
 *
 * @example
 * ```typescript
 * const projectId = await fetchProjectId(
 *   "https://api.ants-platform.com",
 *   "pk_...",
 *   "sk_..."
 * );
 *
 * if (projectId) {
 *   const agentId = generateAgentId("my_agent", projectId);
 * }
 * ```
 *
 * @public
 */
export async function fetchProjectId(
  baseUrl: string,
  publicKey: string,
  secretKey: string,
): Promise<string | null> {
  const logger = getGlobalLogger();

  try {
    const apiClient = new AntsPlatformAPIClient({
      baseUrl,
      username: publicKey,
      password: secretKey,
      xAntsPlatformPublicKey: publicKey,
      xAntsPlatformSdkVersion: ANTS_PLATFORM_SDK_VERSION,
      xAntsPlatformSdkName: "javascript",
      environment: "", // noop as baseUrl is set
    });

    const response = await apiClient.projects.get();

    if (response.data && response.data.length > 0) {
      const projectId = response.data[0].id;
      logger.debug(`[PROJECT_ID] Fetched from API: ${projectId}`);
      return projectId;
    }

    logger.warn("[PROJECT_ID] No projects found in API response");
    return null;
  } catch (error) {
    logger.warn(
      `[PROJECT_ID] Failed to fetch from API: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

