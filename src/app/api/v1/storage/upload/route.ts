import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { uploadFile, validateFile, isStorageAvailable } from '@/lib/storage-supabase';

/**
 * POST /api/v1/storage/upload - Upload a file
 * Accepts multipart form data with:
 * - file: The file to upload
 * - folder: Optional folder path (e.g., 'documents', 'avatars')
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'No tenant context' },
        { status: 400 }
      );
    }

    if (!isStorageAvailable()) {
      return NextResponse.json(
        {
          success: false,
          error: 'File storage is not configured. Set SUPABASE_SERVICE_KEY to enable file uploads.',
          code: 'STORAGE_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateFile({
      name: file.name,
      size: file.size,
      mimeType: file.type,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const data = await file.arrayBuffer();
    const result = await uploadFile(
      auth.tenantId,
      { name: file.name, data, mimeType: file.type, size: file.size },
      folder || undefined
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(
      success({
        key: result.key,
        url: result.url,
        size: result.size,
        name: file.name,
        mimeType: file.type,
      }),
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
