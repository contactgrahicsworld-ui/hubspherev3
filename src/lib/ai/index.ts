/**
 * AI Agent Registry.
 * Central point to discover and access all AI agents.
 */

import type { AgentBase, AgentResponse, AgentExecuteParams } from './agent-base';
import { novaAgent } from './nova-agent';
import { voxAgent } from './vox-agent';
import { salesProAgent } from './salespro-agent';
import { peopleMindAgent } from './peoplemind-agent';
import { insightAgent } from './insight-agent';

// ============================================
// AGENT REGISTRY
// ============================================

const agentMap = new Map<string, AgentBase>([
  ['NOVA', novaAgent],
  ['VOX', voxAgent],
  ['SALESPRO', salesProAgent],
  ['PEOPLEMIND', peopleMindAgent],
  ['INSIGHT', insightAgent],
]);

/**
 * Get an agent instance by name.
 * Returns null if the agent does not exist.
 */
export function getAgent(name: string): AgentBase | null {
  return agentMap.get(name.toUpperCase()) ?? null;
}

/**
 * List all available agents with their metadata.
 */
export function listAgents(): Array<{
  name: string;
  description: string;
  requiredPermissions: string[];
}> {
  return Array.from(agentMap.values()).map((agent) => ({
    name: agent.name,
    description: agent.description,
    requiredPermissions: agent.requiredPermissions,
  }));
}

/**
 * Valid agent names for validation.
 */
export const VALID_AGENT_NAMES = Array.from(agentMap.keys());

// Re-export types and agent instances
export type { AgentBase, AgentResponse, AgentExecuteParams };
export { novaAgent, voxAgent, salesProAgent, peopleMindAgent, insightAgent };
