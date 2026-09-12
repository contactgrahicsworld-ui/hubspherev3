'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, X, Clock, AlertCircle } from 'lucide-react';

// ============================================
// Types
// ============================================

export interface CallRequest {
  id: string;
  tenantId: string;
  deviceId: string;
  requestedBy: string;
  leadId: string | null;
  contactId: string | null;
  dealId: string | null;
  phoneNumber: string;
  contactName: string | null;
  status: string;
  callId: string | null;
  priority: number;
  expiresAt: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Enriched fields from API joins
  deviceName?: string | null;
  requestedByName?: string | null;
}

interface CallRequestCardProps {
  callRequest: CallRequest;
  onCancel: (id: string) => void;
}

// ============================================
// Status badge config
// ============================================

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  ACCEPTED: {
    label: 'Accepted',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
  EXPIRED: {
    label: 'Expired',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
};

// ============================================
// Helpers
// ============================================

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  try {
    return new Date(expiresAt).getTime() < Date.now();
  } catch {
    return false;
  }
}

function timeUntilExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  try {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 1) return `${diffSec}s left`;
    return `${diffMin}m left`;
  } catch {
    return null;
  }
}

// ============================================
// Component
// ============================================

export function CallRequestCard({ callRequest, onCancel }: CallRequestCardProps) {
  const statusConfig = STATUS_CONFIG[callRequest.status] ?? {
    label: callRequest.status,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  const isPending = callRequest.status === 'PENDING';
  const expired = isExpired(callRequest.expiresAt);
  const remaining = timeUntilExpiry(callRequest.expiresAt);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        {/* Header: phone + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Phone className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {callRequest.contactName || callRequest.phoneNumber}
              </p>
              {callRequest.contactName && (
                <p className="truncate text-xs text-muted-foreground">
                  {callRequest.phoneNumber}
                </p>
              )}
            </div>
          </div>
          <Badge variant="outline" className={`shrink-0 ${statusConfig.className}`}>
            {statusConfig.label}
          </Badge>
        </div>

        {/* Info row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {/* Device */}
          <span className="truncate">
            {callRequest.deviceName || 'Device unknown'}
          </span>

          {/* Requested by */}
          {callRequest.requestedByName && (
            <span className="truncate">
              by {callRequest.requestedByName}
            </span>
          )}

          {/* Time */}
          <span className="whitespace-nowrap">
            {formatTime(callRequest.createdAt)}
          </span>

          {/* Priority */}
          {callRequest.priority > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              P{callRequest.priority}
            </Badge>
          )}
        </div>

        {/* Expiry countdown for pending requests */}
        {isPending && remaining && !expired && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-yellow-50 px-2 py-1 text-xs text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
            <Clock className="size-3 shrink-0" />
            <span>{remaining}</span>
          </div>
        )}

        {/* Expired warning */}
        {isPending && expired && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="size-3 shrink-0" />
            <span>Request has expired</span>
          </div>
        )}

        {/* Cancel action for pending */}
        {isPending && !expired && (
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
              onClick={() => onCancel(callRequest.id)}
            >
              <X className="size-3" />
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
