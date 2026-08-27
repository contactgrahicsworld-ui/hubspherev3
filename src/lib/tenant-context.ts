/**
 * Tenant context utilities.
 * Platform-level operations use this constant for tenantId.
 */

/**
 * Null sentinel for platform-level context (no tenant scope).
 * Used in RBAC checks where tenantId is optional.
 */
export const PLATFORM_CONTEXT = null;
