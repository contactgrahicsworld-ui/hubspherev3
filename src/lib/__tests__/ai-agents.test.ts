/**
 * Tests for the AI Agent Registry.
 * Covers VALID_AGENT_NAMES, getAgent, listAgents, canExecute.
 */

import { VALID_AGENT_NAMES, getAgent, listAgents } from '@/lib/ai/index';
import { novaAgent, voxAgent, salesProAgent, peopleMindAgent, insightAgent } from '@/lib/ai/index';

// ============================================
// VALID_AGENT_NAMES TESTS
// ============================================

describe('VALID_AGENT_NAMES', () => {
  it('includes NOVA', () => {
    expect(VALID_AGENT_NAMES).toContain('NOVA');
  });

  it('includes VOX', () => {
    expect(VALID_AGENT_NAMES).toContain('VOX');
  });

  it('includes SALESPRO', () => {
    expect(VALID_AGENT_NAMES).toContain('SALESPRO');
  });

  it('includes PEOPLEMIND', () => {
    expect(VALID_AGENT_NAMES).toContain('PEOPLEMIND');
  });

  it('includes INSIGHT', () => {
    expect(VALID_AGENT_NAMES).toContain('INSIGHT');
  });

  it('has exactly 5 agents', () => {
    expect(VALID_AGENT_NAMES).toHaveLength(5);
  });

  it('all names are uppercase strings', () => {
    for (const name of VALID_AGENT_NAMES) {
      expect(name).toBe(name.toUpperCase());
      expect(typeof name).toBe('string');
    }
  });
});

// ============================================
// getAgent TESTS
// ============================================

describe('getAgent', () => {
  it('returns NOVA agent for "NOVA"', () => {
    const agent = getAgent('NOVA');
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe('NOVA');
  });

  it('returns VOX agent for "VOX"', () => {
    const agent = getAgent('VOX');
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe('VOX');
  });

  it('returns SALESPRO agent for "SALESPRO"', () => {
    const agent = getAgent('SALESPRO');
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe('SALESPRO');
  });

  it('returns PEOPLEMIND agent for "PEOPLEMIND"', () => {
    const agent = getAgent('PEOPLEMIND');
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe('PEOPLEMIND');
  });

  it('returns INSIGHT agent for "INSIGHT"', () => {
    const agent = getAgent('INSIGHT');
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe('INSIGHT');
  });

  it('returns null for invalid name', () => {
    expect(getAgent('INVALID')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getAgent('')).toBeNull();
  });

  it('is case-insensitive (lowercase)', () => {
    const agent = getAgent('nova');
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe('NOVA');
  });

  it('is case-insensitive (mixed case)', () => {
    const agent = getAgent('SaLeSPrO');
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe('SALESPRO');
  });
});

// ============================================
// listAgents TESTS
// ============================================

describe('listAgents', () => {
  it('returns all 5 agents', () => {
    const agents = listAgents();
    expect(agents).toHaveLength(5);
  });

  it('each agent has a non-empty name', () => {
    const agents = listAgents();
    for (const agent of agents) {
      expect(agent.name).toBeTruthy();
      expect(typeof agent.name).toBe('string');
    }
  });

  it('each agent has a non-empty description', () => {
    const agents = listAgents();
    for (const agent of agents) {
      expect(agent.description).toBeTruthy();
      expect(typeof agent.description).toBe('string');
    }
  });

  it('each agent has requiredPermissions array', () => {
    const agents = listAgents();
    for (const agent of agents) {
      expect(Array.isArray(agent.requiredPermissions)).toBe(true);
    }
  });

  it('includes all 5 expected agent names', () => {
    const agents = listAgents();
    const names = agents.map(a => a.name);
    expect(names).toContain('NOVA');
    expect(names).toContain('VOX');
    expect(names).toContain('SALESPRO');
    expect(names).toContain('PEOPLEMIND');
    expect(names).toContain('INSIGHT');
  });
});

// ============================================
// Agent canExecute TESTS
// ============================================

describe('Agent canExecute', () => {
  describe('NOVA', () => {
    it('can execute with leads.view and contacts.view', () => {
      expect(novaAgent.canExecute(['leads.view', 'contacts.view'])).toBe(true);
    });

    it('cannot execute without required permissions', () => {
      expect(novaAgent.canExecute([])).toBe(false);
    });

    it('cannot execute with only partial permissions', () => {
      expect(novaAgent.canExecute(['leads.view'])).toBe(false);
    });

    it('can execute with ai.manage permission', () => {
      expect(novaAgent.canExecute(['ai.manage'])).toBe(true);
    });

    it('can execute with ai.* wildcard', () => {
      expect(novaAgent.canExecute(['ai.*'])).toBe(true);
    });

    it('has correct required permissions', () => {
      expect(novaAgent.requiredPermissions).toEqual(['leads.view', 'contacts.view']);
    });
  });

  describe('VOX', () => {
    it('can execute with calls.view', () => {
      expect(voxAgent.canExecute(['calls.view'])).toBe(true);
    });

    it('cannot execute without calls.view', () => {
      expect(voxAgent.canExecute([])).toBe(false);
    });

    it('has correct required permissions', () => {
      expect(voxAgent.requiredPermissions).toEqual(['calls.view']);
    });
  });

  describe('SALESPRO', () => {
    it('can execute with leads.view and deals.view', () => {
      expect(salesProAgent.canExecute(['leads.view', 'deals.view'])).toBe(true);
    });

    it('cannot execute without required permissions', () => {
      expect(salesProAgent.canExecute(['leads.view'])).toBe(false);
    });

    it('has correct required permissions', () => {
      expect(salesProAgent.requiredPermissions).toEqual(['leads.view', 'deals.view']);
    });
  });

  describe('PEOPLEMIND', () => {
    it('can execute with employees.view', () => {
      expect(peopleMindAgent.canExecute(['employees.view'])).toBe(true);
    });

    it('cannot execute without employees.view', () => {
      expect(peopleMindAgent.canExecute([])).toBe(false);
    });

    it('has correct required permissions', () => {
      expect(peopleMindAgent.requiredPermissions).toEqual(['employees.view']);
    });
  });

  describe('INSIGHT', () => {
    it('can execute with dashboard.view', () => {
      expect(insightAgent.canExecute(['dashboard.view'])).toBe(true);
    });

    it('cannot execute without dashboard.view', () => {
      expect(insightAgent.canExecute([])).toBe(false);
    });

    it('has correct required permissions', () => {
      expect(insightAgent.requiredPermissions).toEqual(['dashboard.view']);
    });
  });
});

// ============================================
// Agent Metadata Tests
// ============================================

describe('Agent metadata', () => {
  const agents = [novaAgent, voxAgent, salesProAgent, peopleMindAgent, insightAgent];

  it('each agent name is a non-empty string', () => {
    for (const agent of agents) {
      expect(agent.name).toBeTruthy();
      expect(typeof agent.name).toBe('string');
      expect(agent.name.length).toBeGreaterThan(0);
    }
  });

  it('each agent description is a non-empty string', () => {
    for (const agent of agents) {
      expect(agent.description).toBeTruthy();
      expect(typeof agent.description).toBe('string');
      expect(agent.description.length).toBeGreaterThan(0);
    }
  });

  it('each agent has unique name', () => {
    const names = agents.map(a => a.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});
