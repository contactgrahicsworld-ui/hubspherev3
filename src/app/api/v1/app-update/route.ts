import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { success } from '@/lib/api-response';
import { handleApiError, ValidationError } from '@/lib/errors';

// ============================================
// App Update Check API
// Separate from data sync — this is for app version checking
// Android in-app update mechanism
// ============================================

// Current app version — update this when releasing a new version
const CURRENT_ANDROID_VERSION = '3.1.0';
const CURRENT_WEB_VERSION = '3.1.0';

// Version history with update info
interface AppVersion {
  version: string;
  releaseDate: string;
  mandatory: boolean; // Security updates that must be installed
  securityUpdate: boolean;
  changelog: string[];
  minCompatibleVersion: string; // Oldest version that can still communicate with backend
  downloadUrl?: string;
  apkSize?: number; // bytes
  apkHash?: string; // SHA-256
}

const VERSION_HISTORY: AppVersion[] = [
  {
    version: '3.1.0',
    releaseDate: '2026-09-13',
    mandatory: false,
    securityUpdate: false,
    changelog: [
      'Unified HubSphere branding (no more Companion)',
      'Real-time data sync via SSE',
      'Offline-first with persistent queue',
      'In-app update mechanism',
      'Improved CRM navigation',
    ],
    minCompatibleVersion: '3.0.0',
  },
  {
    version: '3.0.1',
    releaseDate: '2026-09-01',
    mandatory: true,
    securityUpdate: true,
    changelog: [
      'Critical security fix: Device token rotation',
      'Fix: Tenant isolation in call events',
      'Fix: Offline queue integrity check',
    ],
    minCompatibleVersion: '3.0.0',
  },
  {
    version: '3.0.0',
    releaseDate: '2026-08-15',
    mandatory: false,
    securityUpdate: false,
    changelog: [
      'Initial HubSphere Android release',
      'SIM telecalling via TelecomManager',
      'Device pairing and approval flow',
      'Call event sync with exponential backoff',
    ],
    minCompatibleVersion: '3.0.0',
  },
];

const checkUpdateSchema = z.object({
  platform: z.enum(['android', 'web', 'ios']),
  currentVersion: z.string(),
  deviceId: z.string().optional(), // For tracking which devices need updates
});

// Compare semver versions
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// GET /api/v1/app-update — Check for updates (no auth required for basic check)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || 'android';
    const currentVersion = searchParams.get('currentVersion') || '0.0.0';

    if (!['android', 'web', 'ios'].includes(platform)) {
      throw new ValidationError('Invalid platform. Must be android, web, or ios.');
    }

    const latestVersion = platform === 'web' ? CURRENT_WEB_VERSION : CURRENT_ANDROID_VERSION;
    const latestInfo = VERSION_HISTORY.find(v => v.version === latestVersion);

    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
    const isMandatory = updateAvailable && (latestInfo?.mandatory || latestInfo?.securityUpdate || false);
    const isCompatible = latestInfo
      ? compareVersions(currentVersion, latestInfo.minCompatibleVersion) >= 0
      : true;

    // Find all versions between current and latest
    const availableUpdates = updateAvailable
      ? VERSION_HISTORY.filter(v => compareVersions(v.version, currentVersion) > 0)
      : [];

    const mandatoryUpdates = availableUpdates.filter(v => v.mandatory || v.securityUpdate);

    return NextResponse.json(
      success({
        updateAvailable,
        isMandatory,
        isCompatible,
        currentVersion,
        latestVersion,
        latestRelease: latestInfo
          ? {
              version: latestInfo.version,
              releaseDate: latestInfo.releaseDate,
              changelog: latestInfo.changelog,
              mandatory: latestInfo.mandatory,
              securityUpdate: latestInfo.securityUpdate,
            }
          : null,
        availableUpdates: availableUpdates.map(v => ({
          version: v.version,
          releaseDate: v.releaseDate,
          mandatory: v.mandatory,
          securityUpdate: v.securityUpdate,
          changelog: v.changelog,
        })),
        mandatoryUpdateCount: mandatoryUpdates.length,
        // Action for Android client
        action: !updateAvailable
          ? 'NO_UPDATE'
          : isMandatory
            ? 'MANDATORY_UPDATE'
            : 'OPTIONAL_UPDATE',
        // If client is too old to communicate with backend
        deprecationWarning: !isCompatible
          ? `Your app version (${currentVersion}) is below the minimum compatible version (${latestInfo?.minCompatibleVersion}). Please update immediately.`
          : null,
      }, updateAvailable ? 'Update available' : 'App is up to date'),
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// POST /api/v1/app-update — Acknowledge/download update (authenticated)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validate(checkUpdateSchema, body);

    const latestVersion = data.platform === 'web' ? CURRENT_WEB_VERSION : CURRENT_ANDROID_VERSION;
    const updateAvailable = compareVersions(latestVersion, data.currentVersion) > 0;

    if (!updateAvailable) {
      return NextResponse.json(
        success({ action: 'NO_UPDATE', latestVersion }, 'Already on latest version'),
      );
    }

    const latestInfo = VERSION_HISTORY.find(v => v.version === latestVersion);
    const isMandatory = latestInfo?.mandatory || latestInfo?.securityUpdate || false;

    return NextResponse.json(
      success({
        action: isMandatory ? 'MANDATORY_UPDATE' : 'OPTIONAL_UPDATE',
        latestVersion,
        downloadUrl: latestInfo?.downloadUrl || null,
        apkSize: latestInfo?.apkSize || null,
        apkHash: latestInfo?.apkHash || null,
        changelog: latestInfo?.changelog || [],
        mandatory: isMandatory,
      }, isMandatory ? 'Mandatory update required' : 'Optional update available'),
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map(i => i.message).join(', '));
  }
  return result.data;
}
