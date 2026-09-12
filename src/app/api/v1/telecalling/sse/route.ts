/**
 * SSE Endpoint for real-time telecalling events.
 * GET /api/v1/telecalling/sse
 *
 * Authenticates via JWT, then holds connection open with:
 * - Initial connection event
 * - Heartbeat every 30s
 * - Tenant-scoped broadcasts via SSE manager
 */

import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError } from '@/lib/errors';
import { sseManager } from '@/lib/telecalling/sse-manager';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new Error('Tenant context required');
    }

    const tenantId = payload.tenantId;
    const userId = payload.userId;
    const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Create the Response with SSE headers
    const response = new Response(stream.readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });

    // Register client with SSE manager
    sseManager.addClient(clientId, response, tenantId, userId);
    sseManager.registerWriter(clientId, writer);

    // Send initial connection event
    await writer.write(`event: connected\ndata: ${JSON.stringify({ clientId, tenantId, connectedAt: new Date().toISOString() })}\n\n`);

    // Start heartbeat interval (every 30s)
    const heartbeatInterval = setInterval(async () => {
      try {
        await writer.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
      } catch {
        // Writer closed, clean up
        clearInterval(heartbeatInterval);
        sseManager.removeClient(clientId);
      }
    }, 30_000);

    // Clean up on close/abort
    request.signal.addEventListener('abort', () => {
      clearInterval(heartbeatInterval);
      sseManager.removeClient(clientId);
      try {
        writer.close();
      } catch {
        // Already closed
      }
    });

    return response;
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return new Response(JSON.stringify(body), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
