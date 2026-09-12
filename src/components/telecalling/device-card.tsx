'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, Wifi, WifiOff, Check, X, Clock } from 'lucide-react';

// ============================================
// Types
// ============================================

export interface Device {
  id: string;
  tenantId: string;
  userId: string;
  deviceName: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  appVersion: string | null;
  simOperator: string | null;
  simCountry: string | null;
  phoneNumber: string | null;
  status: string;
  lastHeartbeatAt: string | null;
  lastIpAddress: string | null;
  registeredAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeviceCardProps {
  device: Device;
  onApprove: (id: string) => void;
  onRevoke: (id: string) => void;
}

// ============================================
// Status badge config
// ============================================

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  UNREGISTERED: {
    label: 'Unregistered',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
  PAIRING: {
    label: 'Pairing',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  PENDING_APPROVAL: {
    label: 'Pending Approval',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  ACTIVE: {
    label: 'Active',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  REVOKED: {
    label: 'Revoked',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

// ============================================
// Helpers
// ============================================

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return 'Unknown';
  }
}

function isHeartbeatStale(lastHeartbeatAt: string | null): boolean {
  if (!lastHeartbeatAt) return true;
  try {
    const diffMs = Date.now() - new Date(lastHeartbeatAt).getTime();
    return diffMs > 5 * 60 * 1000; // stale if > 5 minutes
  } catch {
    return true;
  }
}

// ============================================
// Component
// ============================================

export function DeviceCard({ device, onApprove, onRevoke }: DeviceCardProps) {
  const statusConfig = STATUS_CONFIG[device.status] ?? {
    label: device.status,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  const isActive = device.status === 'ACTIVE';
  const isPendingApproval = device.status === 'PENDING_APPROVAL';
  const heartbeatStale = isHeartbeatStale(device.lastHeartbeatAt);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        {/* Header row: name + status badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Smartphone className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {device.deviceName || 'Unnamed Device'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {device.deviceModel || 'Unknown model'}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`shrink-0 ${statusConfig.className}`}>
            {statusConfig.label}
          </Badge>
        </div>

        {/* Info grid */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {/* Heartbeat */}
          <div className="flex items-center gap-1.5">
            {isActive && !heartbeatStale ? (
              <Wifi className="size-3 text-green-600 dark:text-green-400" />
            ) : (
              <WifiOff className="size-3 text-muted-foreground/50" />
            )}
            <span>
              {isActive ? (heartbeatStale ? 'Stale' : 'Online') : '—'}
            </span>
            <span className="text-muted-foreground/60">
              {formatRelativeTime(device.lastHeartbeatAt)}
            </span>
          </div>

          {/* SIM operator */}
          <div className="truncate">
            {device.simOperator ? (
              <span className="flex items-center gap-1">
                <span className="inline-block size-1.5 shrink-0 rounded-full bg-current opacity-40" />
                {device.simOperator}
              </span>
            ) : (
              'No SIM info'
            )}
          </div>

          {/* Phone number */}
          <div className="truncate">
            {device.phoneNumber || 'No number'}
          </div>

          {/* App version */}
          <div className="truncate">
            {device.appVersion ? `v${device.appVersion}` : 'N/A'}
          </div>
        </div>

        {/* Actions */}
        {(isPendingApproval || isActive) && (
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            {isPendingApproval && (
              <Button
                size="sm"
                variant="default"
                className="h-7 gap-1 text-xs"
                onClick={() => onApprove(device.id)}
              >
                <Check className="size-3" />
                Approve
              </Button>
            )}
            {isActive && (
              <Button
                size="sm"
                variant="destructive"
                className="h-7 gap-1 text-xs"
                onClick={() => onRevoke(device.id)}
              >
                <X className="size-3" />
                Revoke
              </Button>
            )}
            {isPendingApproval && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={() => onRevoke(device.id)}
              >
                <X className="size-3" />
                Reject
              </Button>
            )}
          </div>
        )}

        {/* Staleness warning for active devices */}
        {isActive && heartbeatStale && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-yellow-50 px-2 py-1 text-xs text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
            <Clock className="size-3 shrink-0" />
            <span>Last heartbeat was {formatRelativeTime(device.lastHeartbeatAt)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
