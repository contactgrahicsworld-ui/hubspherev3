'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================
// Types
// ============================================

interface SSEEvent {
  event: string;
  data: unknown;
}

interface DeviceStatusPayload {
  deviceId: string;
  previousStatus: string;
  newStatus: string;
  [key: string]: unknown;
}

interface CallRequestPayload {
  id: string;
  deviceId?: string;
  phoneNumber?: string;
  status?: string;
  [key: string]: unknown;
}

interface CallEventPayload {
  id: string;
  callRequestId?: string;
  deviceId?: string;
  eventType?: string;
  [key: string]: unknown;
}

// ============================================
// Constants
// ============================================

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

// ============================================
// Hook
// ============================================

export function useTelecallingSSE() {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, DeviceStatusPayload>>({});
  const [callRequests, setCallRequests] = useState<Record<string, CallRequestPayload>>({});
  const [callEvents, setCallEvents] = useState<Record<string, CallEventPayload>>({});

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const mountedRef = useRef(true);
  // Stable ref to the latest connect function so recursive calls work
  const connectRef = useRef<() => void>(() => {});

  // Clear any pending reconnect timer
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // Schedule a reconnect with exponential backoff
  const scheduleReconnect = useCallback(() => {
    const delay = backoffRef.current;
    backoffRef.current = Math.min(backoffRef.current * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);

    clearReconnectTimer();
    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connectRef.current();
    }, delay);
  }, [clearReconnectTimer]);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    // Close any existing connection first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    clearReconnectTimer();

    // Get the access token from localStorage
    const token = localStorage.getItem('hs-token');
    if (!token) {
      // No token available; schedule a reconnect attempt
      scheduleReconnect();
      return;
    }

    const es = new EventSource(`/api/v1/telecalling/sse?token=${token}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      // Reset backoff on successful connection
      backoffRef.current = INITIAL_BACKOFF_MS;
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      setConnected(false);

      // Close the broken EventSource
      es.close();
      eventSourceRef.current = null;

      // Schedule reconnect with exponential backoff
      scheduleReconnect();
    };

    // Device status change events
    es.addEventListener('device.status_change', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(e.data) as DeviceStatusPayload;
        setLastEvent({ event: 'device.status_change', data });
        if (data.deviceId) {
          setDeviceStatuses((prev) => ({
            ...prev,
            [data.deviceId]: data,
          }));
        }
      } catch {
        // Ignore malformed data
      }
    });

    // Call request created events
    es.addEventListener('call_request.created', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(e.data) as CallRequestPayload;
        setLastEvent({ event: 'call_request.created', data });
        if (data.id) {
          setCallRequests((prev) => ({
            ...prev,
            [data.id]: data,
          }));
        }
      } catch {
        // Ignore malformed data
      }
    });

    // Call request status change events
    es.addEventListener('call_request.status_change', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(e.data) as CallRequestPayload;
        setLastEvent({ event: 'call_request.status_change', data });
        if (data.id) {
          setCallRequests((prev) => ({
            ...prev,
            [data.id]: {
              ...(prev[data.id] ?? {}),
              ...data,
            },
          }));
        }
      } catch {
        // Ignore malformed data
      }
    });

    // Call event created events
    es.addEventListener('call_event.created', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(e.data) as CallEventPayload;
        setLastEvent({ event: 'call_event.created', data });
        if (data.id) {
          setCallEvents((prev) => ({
            ...prev,
            [data.id]: data,
          }));
        }
      } catch {
        // Ignore malformed data
      }
    });

    // Heartbeat — no-op, just keeps the connection alive
    es.addEventListener('heartbeat', () => {
      // Connection is still alive; backoff already reset on open
    });
  }, [clearReconnectTimer, scheduleReconnect]);

  // Keep the ref up to date
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    clearReconnectTimer();
    setConnected(false);
  }, [clearReconnectTimer]);

  // Reconnect manually (resets backoff)
  const reconnect = useCallback(() => {
    backoffRef.current = INITIAL_BACKOFF_MS;
    disconnect();
    connect();
  }, [disconnect, connect]);

  // Auto-connect on mount, clean up on unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      clearReconnectTimer();
    };
  }, [connect, clearReconnectTimer]);

  return {
    connected,
    lastEvent,
    deviceStatuses,
    callRequests,
    callEvents,
    reconnect,
    disconnect,
  };
}
