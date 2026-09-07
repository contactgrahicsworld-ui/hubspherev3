/**
 * Storage abstraction layer.
 * Uses Supabase Storage when configured, falls back to null when not available.
 */

import type { StorageProvider } from '@/lib/providers/types';

/**
 * Get the configured storage provider.
 * Returns Supabase Storage provider when SUPABASE_SERVICE_KEY is configured.
 * Returns null if no storage provider is configured.
 */
export function getStorageProvider(): StorageProvider | null {
  // Check if Supabase Storage is available
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL || '';

  // Extract project ref from Supabase connection string to verify configuration
  const refMatch = dbUrl.match(/postgres\.([a-zA-Z0-9]+)[:@]/);
  if (serviceKey && refMatch) {
    // Supabase Storage is configured - return a provider marker
    // The actual implementation is in storage-supabase.ts which is used directly
    // by file upload routes. This function signals availability.
    return { name: 'supabase' } as unknown as StorageProvider;
  }

  return null;
}

/**
 * Check if storage is available.
 */
export function isStorageAvailable(): boolean {
  return getStorageProvider() !== null;
}
