/**
 * Supabase Storage implementation for HubSphere V3.
 * Uses Supabase Storage API for file uploads with tenant isolation.
 */

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// ============================================
// TYPES
// ============================================

export interface StorageResult {
  success: boolean;
  key?: string;
  url?: string;
  size?: number;
  error?: string;
}

export interface StorageFile {
  key: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  createdAt: string;
}

// ============================================
// ALLOWED CONFIG
// ============================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB default
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain',
  'application/zip',
];

// ============================================
// SUPABASE STORAGE
// ============================================

/**
 * Get the Supabase project URL and service key from DATABASE_URL.
 */
function getSupabaseConfig(): { url: string; serviceKey: string } | null {
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL || '';
  // Extract project ref from Supabase connection string
  // Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  const refMatch = dbUrl.match(/postgres\.([a-zA-Z0-9]+)[:@]/);
  if (!refMatch) return null;

  const projectRef = refMatch[1];
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) return null;

  return {
    url: `https://${projectRef}.supabase.co`,
    serviceKey,
  };
}

/**
 * Check if Supabase storage is available.
 */
export function isStorageAvailable(): boolean {
  return getSupabaseConfig() !== null;
}

/**
 * Sanitize a filename for safe storage.
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

/**
 * Validate a file before upload.
 */
export function validateFile(file: { name: string; size: number; mimeType: string }): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)` };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
    return { valid: false, error: `File type '${file.mimeType}' is not allowed` };
  }
  return { valid: true };
}

/**
 * Upload a file to Supabase Storage.
 * Files are organized by tenant ID for isolation.
 */
export async function uploadFile(
  tenantId: string,
  file: { name: string; data: ArrayBuffer; mimeType: string; size: number },
  folder?: string
): Promise<StorageResult> {
  const config = getSupabaseConfig();
  if (!config) {
    return { success: false, error: 'Supabase storage not configured. Set SUPABASE_SERVICE_KEY.' };
  }

  const validation = validateFile({ name: file.name, size: file.size, mimeType: file.mimeType });
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const safeName = sanitizeFilename(file.name);
  const storageKey = `${tenantId}/${folder || 'general'}/${Date.now()}-${safeName}`;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'hubsphere-files';

  try {
    const response = await fetch(
      `${config.url}/storage/v1/object/${bucketName}/${storageKey}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.serviceKey}`,
          'Content-Type': file.mimeType,
          'x-upsert': 'false',
        },
        body: file.data,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('File upload failed', { module: 'storage', error });
      return { success: false, error: `Upload failed: ${response.status}` };
    }

    const publicUrl = `${config.url}/storage/v1/object/public/${bucketName}/${storageKey}`;

    return {
      success: true,
      key: storageKey,
      url: publicUrl,
      size: file.size,
    };
  } catch (error: any) {
    logger.error('File upload error', { module: 'storage', error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Download a file from Supabase Storage.
 * Enforces tenant isolation by checking the key prefix.
 */
export async function downloadFile(
  tenantId: string,
  storageKey: string
): Promise<StorageResult & { data?: ArrayBuffer }> {
  const config = getSupabaseConfig();
  if (!config) {
    return { success: false, error: 'Supabase storage not configured' };
  }

  // Tenant isolation: only allow access to files under this tenant's prefix
  if (!storageKey.startsWith(`${tenantId}/`)) {
    logger.security('storage_access_denied', { module: 'storage', tenantId, attemptedKey: storageKey });
    return { success: false, error: 'Access denied: file does not belong to this tenant' };
  }

  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'hubsphere-files';

  try {
    const response = await fetch(
      `${config.url}/storage/v1/object/${bucketName}/${storageKey}`,
      {
        headers: { 'Authorization': `Bearer ${config.serviceKey}` },
      }
    );

    if (!response.ok) {
      return { success: false, error: `Download failed: ${response.status}` };
    }

    const data = await response.arrayBuffer();
    return { success: true, key: storageKey, size: data.byteLength, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a file from Supabase Storage.
 * Enforces tenant isolation.
 */
export async function deleteFile(
  tenantId: string,
  storageKey: string
): Promise<StorageResult> {
  const config = getSupabaseConfig();
  if (!config) {
    return { success: false, error: 'Supabase storage not configured' };
  }

  if (!storageKey.startsWith(`${tenantId}/`)) {
    return { success: false, error: 'Access denied: file does not belong to this tenant' };
  }

  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'hubsphere-files';

  try {
    const response = await fetch(
      `${config.url}/storage/v1/object/${bucketName}/${storageKey}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${config.serviceKey}` },
      }
    );

    if (!response.ok) {
      return { success: false, error: `Delete failed: ${response.status}` };
    }

    return { success: true, key: storageKey };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get a signed URL for temporary file access.
 */
export async function getSignedUrl(
  tenantId: string,
  storageKey: string,
  expiresIn: number = 3600
): Promise<StorageResult> {
  const config = getSupabaseConfig();
  if (!config) {
    return { success: false, error: 'Supabase storage not configured' };
  }

  if (!storageKey.startsWith(`${tenantId}/`)) {
    return { success: false, error: 'Access denied' };
  }

  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'hubsphere-files';

  try {
    const response = await fetch(
      `${config.url}/storage/v1/object/sign/${bucketName}/${storageKey}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `Signed URL failed: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, url: `${config.url}${data.signedURL}`, key: storageKey };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
