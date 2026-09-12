'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth-client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { DeviceCard, type Device } from '@/components/telecalling/device-card';
import { CallRequestCard, type CallRequest } from '@/components/telecalling/call-request-card';
import { useTelecallingSSE } from '@/lib/telecalling/use-telecalling-sse';
import {
  Wifi,
  WifiOff,
  Phone,
  Smartphone,
  AlertCircle,
  RefreshCw,
  PhoneCall,
  Clock,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface CallEventItem {
  id: string;
  callRequestId: string;
  deviceId: string;
  eventType: string;
  duration: number | null;
  failureReason: string | null;
  createdAt: string;
}

interface PaginatedDevices {
  success: boolean;
  data: Device[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface PaginatedCallRequests {
  success: boolean;
  data: CallRequest[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface PaginatedCallEvents {
  success: boolean;
  data: CallEventItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ============================================
// Event type badge
// ============================================

const EVENT_TYPE_STYLES: Record<string, string> = {
  CALL_STARTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RINGING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  CONNECTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ON_HOLD: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  RESUMED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ENDED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  MISSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  CALL_STARTED: 'Call Started',
  RINGING: 'Ringing',
  CONNECTED: 'Connected',
  ON_HOLD: 'On Hold',
  RESUMED: 'Resumed',
  ENDED: 'Ended',
  FAILED: 'Failed',
  MISSED: 'Missed',
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
      second: '2-digit',
    });
  } catch {
    return '-';
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ============================================
// Component
// ============================================

export function TelecallingDashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [callRequests, setCallRequests] = useState<CallRequest[]>([]);
  const [callEvents, setCallEvents] = useState<CallEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    connected: sseConnected,
    deviceStatuses,
    callRequests: sseCallRequests,
    callEvents: sseCallEvents,
    reconnect,
  } = useTelecallingSSE();

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [devicesRes, callRequestsRes, callEventsRes] = await Promise.all([
        apiFetch<PaginatedDevices>('/api/v1/devices?limit=50'),
        apiFetch<PaginatedCallRequests>('/api/v1/call-requests?status=PENDING&limit=20'),
        apiFetch<PaginatedCallEvents>('/api/v1/call-events?limit=20'),
      ]);

      setDevices(devicesRes.data ?? []);
      setCallRequests(callRequestsRes.data ?? []);
      setCallEvents(callEventsRes.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load telecalling data';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Merge SSE device status updates into local devices state
  useEffect(() => {
    const sseDeviceIds = Object.keys(deviceStatuses);
    if (sseDeviceIds.length === 0) return;

    setDevices((prev) =>
      prev.map((device) => {
        const update = deviceStatuses[device.id];
        if (update) {
          return { ...device, status: update.newStatus };
        }
        return device;
      })
    );
  }, [deviceStatuses]);

  // Merge SSE call request updates into local call requests state
  useEffect(() => {
    const sseRequestIds = Object.keys(sseCallRequests);
    if (sseRequestIds.length === 0) return;

    setCallRequests((prev) => {
      const updated = prev.map((cr) => {
        const update = sseCallRequests[cr.id];
        if (update) {
          return { ...cr, ...update };
        }
        return cr;
      });

      // Add new call requests from SSE that aren't in our list
      for (const id of sseRequestIds) {
        if (!updated.find((cr) => cr.id === id)) {
          updated.push(sseCallRequests[id] as unknown as CallRequest);
        }
      }

      // Filter out non-pending requests (they've been handled)
      return updated.filter((cr) => cr.status === 'PENDING');
    });
  }, [sseCallRequests]);

  // Merge SSE call events into local call events state
  useEffect(() => {
    const sseEventIds = Object.keys(sseCallEvents);
    if (sseEventIds.length === 0) return;

    setCallEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const newEvents = sseEventIds
        .filter((id) => !existingIds.has(id))
        .map((id) => sseCallEvents[id] as unknown as CallEventItem);

      if (newEvents.length === 0) return prev;

      // Prepend new events, keep max 20
      const merged = [...newEvents, ...prev].slice(0, 20);
      return merged;
    });
  }, [sseCallEvents]);

  // Approve device
  const handleApprove = useCallback(async (deviceId: string) => {
    try {
      await apiFetch(`/api/v1/devices/${deviceId}/approve`, { method: 'POST' });
      toast.success('Device approved');
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, status: 'ACTIVE' } : d))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve device');
    }
  }, []);

  // Revoke device
  const handleRevoke = useCallback(async (deviceId: string) => {
    try {
      await apiFetch(`/api/v1/devices/${deviceId}/revoke`, { method: 'POST' });
      toast.success('Device revoked');
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, status: 'REVOKED' } : d))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke device');
    }
  }, []);

  // Cancel call request
  const handleCancelCallRequest = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/v1/call-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      toast.success('Call request cancelled');
      setCallRequests((prev) => prev.filter((cr) => cr.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel call request');
    }
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && devices.length === 0 && callRequests.length === 0) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex items-center gap-3 py-6">
          <AlertCircle className="size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto shrink-0"
            onClick={fetchData}
          >
            <RefreshCw className="size-3 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeDevices = devices.filter((d) => d.status === 'ACTIVE');
  const pendingDevices = devices.filter((d) => d.status === 'PENDING_APPROVAL');

  return (
    <div className="space-y-6">
      {/* Header with SSE status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`size-2.5 rounded-full ${
                sseConnected
                  ? 'bg-green-500 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {sseConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          {!sseConnected && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={reconnect}
            >
              <WifiOff className="size-3" />
              Reconnect
            </Button>
          )}
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Smartphone className="size-3" />
            {activeDevices.length} active
          </span>
          {pendingDevices.length > 0 && (
            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
              <Clock className="size-3" />
              {pendingDevices.length} pending
            </span>
          )}
          <span className="flex items-center gap-1">
            <Phone className="size-3" />
            {callRequests.length} queued
          </span>
        </div>
      </div>

      {/* Pending approvals alert */}
      {pendingDevices.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertCircle className="size-4 shrink-0 text-orange-600 dark:text-orange-400" />
            <p className="text-sm text-orange-700 dark:text-orange-400">
              {pendingDevices.length} device{pendingDevices.length > 1 ? 's' : ''} awaiting approval
            </p>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout: Devices + Call Queue/Events */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Devices */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Smartphone className="size-5 text-muted-foreground" />
              Devices
              <Badge variant="secondary" className="ml-1">
                {devices.length}
              </Badge>
            </h2>
          </div>

          {devices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Smartphone className="mb-2 size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No devices registered</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Devices will appear here once paired.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="flex flex-col gap-3 pr-2">
                {/* Show pending first, then others */}
                {pendingDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onApprove={handleApprove}
                    onRevoke={handleRevoke}
                  />
                ))}
                {devices
                  .filter((d) => d.status !== 'PENDING_APPROVAL')
                  .map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      onApprove={handleApprove}
                      onRevoke={handleRevoke}
                    />
                  ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right: Call Requests + Events */}
        <div className="space-y-6">
          {/* Call Queue */}
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <PhoneCall className="size-5 text-muted-foreground" />
              Call Queue
              <Badge variant="secondary" className="ml-1">
                {callRequests.length}
              </Badge>
            </h2>

            {callRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <PhoneCall className="mb-2 size-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">No pending calls</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    New call requests will appear here in real-time.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="max-h-[280px]">
                <div className="flex flex-col gap-3 pr-2">
                  {callRequests.map((cr) => (
                    <CallRequestCard
                      key={cr.id}
                      callRequest={cr}
                      onCancel={handleCancelCallRequest}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Recent Call Events */}
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Phone className="size-5 text-muted-foreground" />
              Recent Events
              <Badge variant="secondary" className="ml-1">
                {callEvents.length}
              </Badge>
            </h2>

            {callEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <Phone className="mb-2 size-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">No call events</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Events from active calls will stream here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[300px]">
                    <div className="divide-y">
                      {callEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center gap-3 px-4 py-2.5"
                        >
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] ${
                              EVENT_TYPE_STYLES[event.eventType] ?? ''
                            }`}
                          >
                            {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-muted-foreground">
                              Request {event.callRequestId.slice(0, 8)}…
                            </p>
                          </div>
                          {event.duration != null && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatDuration(event.duration)}
                            </span>
                          )}
                          {event.failureReason && (
                            <span className="shrink-0 truncate text-xs text-red-600 dark:text-red-400 max-w-[120px]">
                              {event.failureReason}
                            </span>
                          )}
                          <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                            {formatTime(event.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
