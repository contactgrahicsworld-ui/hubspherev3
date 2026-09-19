/**
 * Tests for the feature flag system.
 * Covers isFeatureEnabled, requireFeature, FEATURE_FLAG_KEYS, getTenantFeatures.
 */

import * as featureFlags from '@/lib/feature-flags';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

// ============================================
// FEATURE_FLAG_KEYS TESTS
// ============================================

describe('FEATURE_FLAG_KEYS', () => {
  it('has all expected keys', () => {
    expect(featureFlags.FEATURE_FLAG_KEYS.CRM).toBe('crm');
    expect(featureFlags.FEATURE_FLAG_KEYS.HRMS).toBe('hrms');
    expect(featureFlags.FEATURE_FLAG_KEYS.AI).toBe('ai');
    expect(featureFlags.FEATURE_FLAG_KEYS.AUTOMATION).toBe('automation');
    expect(featureFlags.FEATURE_FLAG_KEYS.COMMUNICATION).toBe('communication');
    expect(featureFlags.FEATURE_FLAG_KEYS.ANALYTICS).toBe('analytics');
    expect(featureFlags.FEATURE_FLAG_KEYS.CUSTOM_ROLES).toBe('custom_roles');
    expect(featureFlags.FEATURE_FLAG_KEYS.API).toBe('api_access');
    expect(featureFlags.FEATURE_FLAG_KEYS.SSO).toBe('sso');
    expect(featureFlags.FEATURE_FLAG_KEYS.AUDIT_LOG).toBe('audit_log');
    expect(featureFlags.FEATURE_FLAG_KEYS.FILE_UPLOAD).toBe('file_upload');
    expect(featureFlags.FEATURE_FLAG_KEYS.EXPORT_DATA).toBe('export_data');
    expect(featureFlags.FEATURE_FLAG_KEYS.WHITE_LABEL).toBe('white_label');
    expect(featureFlags.FEATURE_FLAG_KEYS.PRIORITY_SUPPORT).toBe('priority_support');
  });

  it('has exactly 14 feature flags', () => {
    const keys = Object.keys(featureFlags.FEATURE_FLAG_KEYS);
    expect(keys).toHaveLength(14);
  });

  it('all values are lowercase strings', () => {
    const values = Object.values(featureFlags.FEATURE_FLAG_KEYS);
    for (const value of values) {
      expect(value).toBe(value.toLowerCase());
      expect(typeof value).toBe('string');
    }
  });
});

// ============================================
// isFeatureEnabled TESTS
// ============================================

describe('isFeatureEnabled', () => {
  let tenantId: string;

  beforeAll(async () => {
    // Create a test tenant (let DB generate the UUID)
    const tenant = await db.tenant.create({
      data: {
        name: 'Feature Flag Test Tenant',
        slug: `ff-test-${randomUUID().slice(0, 8)}`,
        plan: 'FREE',
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.tenantFeatureFlag.deleteMany({ where: { tenantId } }).catch(() => {});
    await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it('CRM is enabled on FREE plan (default)', async () => {
    const result = await featureFlags.isFeatureEnabled('crm', tenantId);
    expect(result).toBe(true);
  });

  it('AI is disabled on FREE plan (default)', async () => {
    const result = await featureFlags.isFeatureEnabled('ai', tenantId);
    expect(result).toBe(false);
  });

  it('AUTOMATION is disabled on FREE plan (default)', async () => {
    const result = await featureFlags.isFeatureEnabled('automation', tenantId);
    expect(result).toBe(false);
  });

  it('SSO is disabled on FREE plan (default)', async () => {
    const result = await featureFlags.isFeatureEnabled('sso', tenantId);
    expect(result).toBe(false);
  });

  it('respects plan code when provided explicitly', async () => {
    // PRO plan has AI enabled
    const result = await featureFlags.isFeatureEnabled('ai', tenantId, 'PRO');
    expect(result).toBe(true);
  });

  it('ENTERPRISE plan has SSO enabled', async () => {
    const result = await featureFlags.isFeatureEnabled('sso', tenantId, 'ENTERPRISE');
    expect(result).toBe(true);
  });

  it('tenant override can disable a plan-enabled feature', async () => {
    // First ensure the feature flag record exists
    const flag = await db.featureFlag.upsert({
      where: { key: 'crm' },
      create: { key: 'crm', name: 'CRM', enabled: true },
      update: { name: 'CRM' },
    });

    // Create a tenant override to disable CRM
    await db.tenantFeatureFlag.create({
      data: {
        tenantId,
        featureFlagId: flag.id,
        enabled: false,
      },
    });

    // CRM should now be disabled despite FREE plan having it
    const result = await featureFlags.isFeatureEnabled('crm', tenantId);
    expect(result).toBe(false);

    // Cleanup the override
    await db.tenantFeatureFlag.deleteMany({
      where: { tenantId, featureFlagId: flag.id },
    });
  });

  it('unknown feature flag returns false', async () => {
    const result = await featureFlags.isFeatureEnabled('nonexistent_feature', tenantId);
    expect(result).toBe(false);
  });
});

// ============================================
// requireFeature TESTS
// ============================================

describe('requireFeature', () => {
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await db.tenant.create({
      data: {
        name: 'Feature Require Test Tenant',
        slug: `ff-req-${randomUUID().slice(0, 8)}`,
        plan: 'FREE',
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it('does not throw when feature is enabled', async () => {
    // CRM is enabled on FREE plan
    await expect(featureFlags.requireFeature('crm', tenantId)).resolves.toBeUndefined();
  });

  it('throws when feature is disabled', async () => {
    await expect(featureFlags.requireFeature('ai', tenantId)).rejects.toThrow();
  });

  it('throws with feature name in error message', async () => {
    try {
      await featureFlags.requireFeature('ai', tenantId);
    } catch (err) {
      expect((err as Error).message).toContain('ai');
    }
  });
});

// ============================================
// getTenantFeatures TESTS
// ============================================

describe('getTenantFeatures', () => {
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await db.tenant.create({
      data: {
        name: 'Feature GetAll Test Tenant',
        slug: `ff-all-${randomUUID().slice(0, 8)}`,
        plan: 'PRO',
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it('returns proper structure (Record<string, boolean>)', async () => {
    const features = await featureFlags.getTenantFeatures(tenantId);
    expect(typeof features).toBe('object');
    expect(features).not.toBeNull();
  });

  it('returns boolean values for all features', async () => {
    const features = await featureFlags.getTenantFeatures(tenantId);
    for (const [key, value] of Object.entries(features)) {
      expect(typeof value).toBe('boolean');
    }
  });

  it('PRO plan has AI enabled', async () => {
    const features = await featureFlags.getTenantFeatures(tenantId, 'PRO');
    expect(features.ai).toBe(true);
  });

  it('FREE plan has CRM enabled', async () => {
    const features = await featureFlags.getTenantFeatures(tenantId, 'FREE');
    expect(features.crm).toBe(true);
  });

  it('FREE plan has AI disabled', async () => {
    const features = await featureFlags.getTenantFeatures(tenantId, 'FREE');
    expect(features.ai).toBe(false);
  });
});
