'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth-client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TelecallingDashboard } from '@/components/telecalling/telecalling-dashboard';
import { DeviceCard, type Device } from '@/components/telecalling/device-card';
import { CallRequestCard, type CallRequest } from '@/components/telecalling/call-request-card';
import {
  Phone,
  Smartphone,
  Wifi,
  WifiOff,
  Check,
  X,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Settings,
  History,
  PhoneCall,
  ListOrdered,
  Loader2,
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
// Helpers
// ============================================

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
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
// Device status badge
// ============================================

const DEVICE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  UNREGISTERED: {
    label: 'Unregistered',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
  PAIRING: {
    label: 'Pairing',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  PENDING_APPROVAL: {
    label: 'Pending',
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
// Call request status badge
// ============================================

const CR_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
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
// Main Page
// ============================================

export default function TelecallingPage() {
  // ===== Devices Tab State =====
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [deviceStatusFilter, setDeviceStatusFilter] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [revokeDialogDevice, setRevokeDialogDevice] = useState<Device | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  // ===== Call Queue Tab State =====
  const [callRequests, setCallRequests] = useState<CallRequest[]>([]);
  const [crLoading, setCrLoading] = useState(true);
  const [crError, setCrError] = useState<string | null>(null);
  const [crStatusFilter, setCrStatusFilter] = useState('PENDING');

  // ===== Call History Tab State =====
  const [callEvents, setCallEvents] = useState<CallEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // ===== Settings Tab State =====
  const [defaultExpiry, setDefaultExpiry] = useState('300');
  const [autoApprove, setAutoApprove] = useState(false);
  const [heartbeatTimeout, setHeartbeatTimeout] = useState('5');
  const [maxConcurrentCalls, setMaxConcurrentCalls] = useState('1');

  // ===== Fetch Devices =====
  const fetchDevices = useCallback(async () => {
    try {
      setDevicesLoading(true);
      setDevicesError(null);
      const params = new URLSearchParams({ limit: '100' });
      if (deviceStatusFilter) params.set('status', deviceStatusFilter);
      const res = await apiFetch<PaginatedDevices>(`/api/v1/devices?${params}`);
      setDevices(res.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load devices';
      setDevicesError(message);
      toast.error(message);
    } finally {
      setDevicesLoading(false);
    }
  }, [deviceStatusFilter]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // ===== Fetch Call Requests =====
  const fetchCallRequests = useCallback(async () => {
    try {
      setCrLoading(true);
      setCrError(null);
      const params = new URLSearchParams({ limit: '50' });
      if (crStatusFilter) params.set('status', crStatusFilter);
      const res = await apiFetch<PaginatedCallRequests>(`/api/v1/call-requests?${params}`);
      setCallRequests(res.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load call requests';
      setCrError(message);
      toast.error(message);
    } finally {
      setCrLoading(false);
    }
  }, [crStatusFilter]);

  useEffect(() => { fetchCallRequests(); }, [fetchCallRequests]);

  // ===== Fetch Call Events =====
  const fetchCallEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      setEventsError(null);
      const res = await apiFetch<PaginatedCallEvents>('/api/v1/call-events?limit=50');
      setCallEvents(res.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load call events';
      setEventsError(message);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCallEvents(); }, [fetchCallEvents]);

  // ===== Device Actions =====
  const handleApproveDevice = useCallback(async (deviceId: string) => {
    try {
      await apiFetch(`/api/v1/devices/${deviceId}/approve`, { method: 'POST' });
      toast.success('Device approved');
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? { ...d, status: 'ACTIVE' } : d)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve device');
    }
  }, []);

  const handleRevokeDevice = useCallback(async () => {
    if (!revokeDialogDevice) return;
    try {
      setRevokeLoading(true);
      await apiFetch(`/api/v1/devices/${revokeDialogDevice.id}/revoke`, { method: 'POST' });
      toast.success('Device revoked');
      setDevices((prev) =>
        prev.map((d) => (d.id === revokeDialogDevice.id ? { ...d, status: 'REVOKED' } : d))
      );
      setRevokeDialogDevice(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke device');
    } finally {
      setRevokeLoading(false);
    }
  }, [revokeDialogDevice]);

  const openRevokeDialog = useCallback((device: Device) => {
    setRevokeDialogDevice(device);
  }, []);

  // ===== Cancel Call Request =====
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

  // ===== Filtered devices for search =====
  const filteredDevices = deviceSearch
    ? devices.filter(
        (d) =>
          (d.deviceName?.toLowerCase().includes(deviceSearch.toLowerCase()) ?? false) ||
          (d.deviceModel?.toLowerCase().includes(deviceSearch.toLowerCase()) ?? false) ||
          (d.phoneNumber?.includes(deviceSearch) ?? false) ||
          d.id.includes(deviceSearch)
      )
    : devices;

  // ===== Event type helpers =====
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Telecalling</h1>
          <p className="mt-1 text-muted-foreground">
            Manage devices, call queues, and telecalling configuration
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <Wifi className="size-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="devices" className="gap-1.5">
            <Smartphone className="size-4" />
            <span className="hidden sm:inline">Devices</span>
          </TabsTrigger>
          <TabsTrigger value="call-queue" className="gap-1.5">
            <PhoneCall className="size-4" />
            <span className="hidden sm:inline">Call Queue</span>
          </TabsTrigger>
          <TabsTrigger value="call-history" className="gap-1.5">
            <History className="size-4" />
            <span className="hidden sm:inline">Call History</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="size-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* ===== Dashboard Tab ===== */}
        <TabsContent value="dashboard">
          <TelecallingDashboard />
        </TabsContent>

        {/* ===== Devices Tab ===== */}
        <TabsContent value="devices" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                className="pl-9"
                aria-label="Search devices"
              />
            </div>
            <Select
              value={deviceStatusFilter || '_all'}
              onValueChange={(v) => setDeviceStatusFilter(v === '_all' ? '' : v)}
            >
              <SelectTrigger className="w-[160px]" aria-label="Filter by status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Statuses</SelectItem>
                <SelectItem value="UNREGISTERED">Unregistered</SelectItem>
                <SelectItem value="PAIRING">Pairing</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="REVOKED">Revoked</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchDevices}>
              <RefreshCw className="size-3 mr-1" />
              Refresh
            </Button>
          </div>

          {/* Loading */}
          {devicesLoading && (
            <div className="space-y-3">
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
          )}

          {/* Error */}
          {devicesError && !devicesLoading && (
            <Card className="border-destructive/50">
              <CardContent className="flex items-center gap-3 py-6">
                <AlertCircle className="size-5 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{devicesError}</p>
                <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={fetchDevices}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Desktop Table */}
          {!devicesLoading && !devicesError && filteredDevices.length > 0 && (
            <>
              <Card className="hidden lg:block">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Device</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="min-w-[130px]">Phone</TableHead>
                        <TableHead>SIM Operator</TableHead>
                        <TableHead>App Ver</TableHead>
                        <TableHead>Last Heartbeat</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDevices.map((device) => {
                        const sc = DEVICE_STATUS_CONFIG[device.status] ?? {
                          label: device.status,
                          className: '',
                        };
                        return (
                          <TableRow key={device.id}>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">
                                  {device.deviceName || 'Unnamed'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {device.deviceModel || '-'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={sc.className}>
                                {sc.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {device.phoneNumber || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {device.simOperator || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {device.appVersion ? `v${device.appVersion}` : '-'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatDateTime(device.lastHeartbeatAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {device.status === 'PENDING_APPROVAL' && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 gap-1 text-xs"
                                    onClick={() => handleApproveDevice(device.id)}
                                  >
                                    <Check className="size-3" />
                                    Approve
                                  </Button>
                                )}
                                {(device.status === 'ACTIVE' || device.status === 'PENDING_APPROVAL') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
                                    onClick={() => openRevokeDialog(device)}
                                  >
                                    <X className="size-3" />
                                    {device.status === 'PENDING_APPROVAL' ? 'Reject' : 'Revoke'}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile Cards */}
              <div className="flex flex-col gap-3 lg:hidden">
                {filteredDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onApprove={handleApproveDevice}
                    onRevoke={(id) => {
                      const d = devices.find((dev) => dev.id === id);
                      if (d) openRevokeDialog(d);
                    }}
                  />
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {filteredDevices.length} of {devices.length} devices
              </p>
            </>
          )}

          {/* Empty */}
          {!devicesLoading && !devicesError && filteredDevices.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Smartphone className="mb-3 size-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">No devices found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {deviceSearch || deviceStatusFilter
                    ? 'Try adjusting your filters.'
                    : 'Devices will appear here once they are registered.'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Call Queue Tab ===== */}
        <TabsContent value="call-queue" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <Select
              value={crStatusFilter || '_all'}
              onValueChange={(v) => setCrStatusFilter(v === '_all' ? '' : v)}
            >
              <SelectTrigger className="w-[160px]" aria-label="Filter by status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchCallRequests}>
              <RefreshCw className="size-3 mr-1" />
              Refresh
            </Button>
          </div>

          {/* Loading */}
          {crLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Error */}
          {crError && !crLoading && (
            <Card className="border-destructive/50">
              <CardContent className="flex items-center gap-3 py-6">
                <AlertCircle className="size-5 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{crError}</p>
                <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={fetchCallRequests}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Desktop Table */}
          {!crLoading && !crError && callRequests.length > 0 && (
            <>
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px]">Phone / Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead className="min-w-[140px]">Device</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {callRequests.map((cr) => {
                        const sc = CR_STATUS_CONFIG[cr.status] ?? {
                          label: cr.status,
                          className: '',
                        };
                        const isPending = cr.status === 'PENDING';
                        const isExpired =
                          cr.expiresAt && new Date(cr.expiresAt).getTime() < Date.now();

                        return (
                          <TableRow key={cr.id}>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">
                                  {cr.contactName || cr.phoneNumber}
                                </p>
                                {cr.contactName && (
                                  <p className="text-xs text-muted-foreground">{cr.phoneNumber}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={sc.className}>
                                {sc.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {cr.priority > 0 ? `P${cr.priority}` : '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {cr.deviceName || cr.deviceId.slice(0, 8) + '…'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatDateTime(cr.createdAt)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {isPending && isExpired ? (
                                <span className="text-red-600 dark:text-red-400">Expired</span>
                              ) : (
                                formatDateTime(cr.expiresAt)
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isPending && !isExpired && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => handleCancelCallRequest(cr.id)}
                                >
                                  <X className="size-3" />
                                  Cancel
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile Cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {callRequests.map((cr) => (
                  <CallRequestCard
                    key={cr.id}
                    callRequest={cr}
                    onCancel={handleCancelCallRequest}
                  />
                ))}
              </div>
            </>
          )}

          {/* Empty */}
          {!crLoading && !crError && callRequests.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <PhoneCall className="mb-3 size-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">No call requests</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {crStatusFilter
                    ? `No ${crStatusFilter.toLowerCase()} call requests found.`
                    : 'Call requests will appear here when created.'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Call History Tab ===== */}
        <TabsContent value="call-history" className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchCallEvents}>
              <RefreshCw className="size-3 mr-1" />
              Refresh
            </Button>
          </div>

          {/* Loading */}
          {eventsLoading && (
            <Card>
              <CardContent className="p-0">
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {eventsError && !eventsLoading && (
            <Card className="border-destructive/50">
              <CardContent className="flex items-center gap-3 py-6">
                <AlertCircle className="size-5 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{eventsError}</p>
                <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={fetchCallEvents}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Events Table */}
          {!eventsLoading && !eventsError && callEvents.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead className="min-w-[120px]">Request ID</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Failure Reason</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${EVENT_TYPE_STYLES[event.eventType] ?? ''}`}
                          >
                            {event.eventType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {event.callRequestId.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDuration(event.duration)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-red-600 dark:text-red-400">
                          {event.failureReason || '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(event.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Empty */}
          {!eventsLoading && !eventsError && callEvents.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <History className="mb-3 size-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">No call events</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Events will appear here as calls progress.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Settings Tab ===== */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* General Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">General Settings</CardTitle>
                <CardDescription>Configure default telecalling behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="default-expiry">Default Call Expiry (seconds)</Label>
                  <Input
                    id="default-expiry"
                    type="number"
                    min="60"
                    max="3600"
                    value={defaultExpiry}
                    onChange={(e) => setDefaultExpiry(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Time before a pending call request expires (60–3600s)
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="heartbeat-timeout">Heartbeat Timeout (minutes)</Label>
                  <Input
                    id="heartbeat-timeout"
                    type="number"
                    min="1"
                    max="30"
                    value={heartbeatTimeout}
                    onChange={(e) => setHeartbeatTimeout(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mark device as stale if no heartbeat received within this time
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="max-concurrent">Max Concurrent Calls per Device</Label>
                  <Select value={maxConcurrentCalls} onValueChange={setMaxConcurrentCalls}>
                    <SelectTrigger id="max-concurrent" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 call</SelectItem>
                      <SelectItem value="2">2 calls</SelectItem>
                      <SelectItem value="3">3 calls</SelectItem>
                      <SelectItem value="5">5 calls</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Device Policy Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Device Policy</CardTitle>
                <CardDescription>Control how devices are registered and managed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-approve">Auto-approve devices</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically approve devices after pairing without manual review
                    </p>
                  </div>
                  <Switch
                    id="auto-approve"
                    checked={autoApprove}
                    onCheckedChange={setAutoApprove}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Pairing Token Expiry</Label>
                  <Select defaultValue="15">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How long a pairing token remains valid
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-revoke">Notify on revocation</Label>
                    <p className="text-xs text-muted-foreground">
                      Send a push notification to the device when it is revoked
                    </p>
                  </div>
                  <Switch id="notify-revoke" defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Save button */}
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="default"
              onClick={() => toast.success('Settings saved')}
            >
              Save Settings
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== Revoke Confirmation Dialog ===== */}
      <Dialog
        open={revokeDialogDevice !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeDialogDevice(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {revokeDialogDevice?.status === 'PENDING_APPROVAL'
                ? 'Reject Device?'
                : 'Revoke Device?'}
            </DialogTitle>
            <DialogDescription>
              {revokeDialogDevice?.status === 'PENDING_APPROVAL'
                ? `This will reject the device "${revokeDialogDevice?.deviceName || 'Unnamed'}". The device will need to re-register.`
                : `This will revoke access for device "${revokeDialogDevice?.deviceName || 'Unnamed'}". The device will be disconnected and its token invalidated.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRevokeDialogDevice(null)}
              disabled={revokeLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeDevice}
              disabled={revokeLoading}
            >
              {revokeLoading && <Loader2 className="size-4 mr-1 animate-spin" />}
              {revokeDialogDevice?.status === 'PENDING_APPROVAL' ? 'Reject' : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
