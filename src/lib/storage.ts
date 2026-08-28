/**
 * Storage abstraction layer.
 * Phase 1: Returns null (no provider configured).
 * Future: Will use provider registry to get a configured StorageProvider.
 */

import type { StorageProvider } from '@/lib/providers/types';

/**
 * Get the configured storage provider.
 * Returns null if no storage provider is configured.
 * The application continues working without storage.
 */
export function getStorageProvider(): StorageProvider | null {
  // Phase 1: No storage provider configured
  // Future: Will integrate with providerRegistry
  return null;
}

/**
 * Check if storage is available.
 */
export function isStorageAvailable(): boolean {
  return getStorageProvider() !== null;
}