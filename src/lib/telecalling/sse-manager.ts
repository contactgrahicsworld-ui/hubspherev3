/**
 * SSE Manager - In-memory pub/sub for real-time telecalling events.
 * Supports: device status changes, call request updates, call events.
 * All broadcasts are tenant-scoped to prevent cross-tenant data leaks.
 */

interface SSEClient {
  id: string;
  response: Response;
  tenantId: string;
  userId?: string;
  connectedAt: Date;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private tenantChannels: Map<string, Set<string>> = new Map(); // tenantId → clientIds

  /**
   * Register a new SSE client.
   */
  addClient(id: string, response: Response, tenantId: string, userId?: string): void {
    const client: SSEClient = {
      id,
      response,
      tenantId,
      userId,
      connectedAt: new Date(),
    };

    this.clients.set(id, client);

    // Add to tenant channel
    if (!this.tenantChannels.has(tenantId)) {
      this.tenantChannels.set(tenantId, new Set());
    }
    this.tenantChannels.get(tenantId)!.add(id);
  }

  /**
   * Remove an SSE client and clean up tenant channel.
   */
  removeClient(id: string): void {
    const client = this.clients.get(id);
    if (!client) return;

    // Remove from tenant channel
    const channel = this.tenantChannels.get(client.tenantId);
    if (channel) {
      channel.delete(id);
      if (channel.size === 0) {
        this.tenantChannels.delete(client.tenantId);
      }
    }

    this.clients.delete(id);
  }

  /**
   * Broadcast an event to all clients in a tenant.
   * SSE format: "event: <event>\ndata: <json>\n\n"
   */
  broadcastToTenant(tenantId: string, event: string, data: unknown): void {
    const clientIds = this.tenantChannels.get(tenantId);
    if (!clientIds || clientIds.size === 0) return;

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const clientId of clientIds) {
      this.sendRaw(clientId, message);
    }
  }

  /**
   * Send an event to a specific client.
   */
  sendToClient(clientId: string, event: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.sendRaw(clientId, message);
  }

  /**
   * Send a raw SSE message string to a client.
   * Uses the Response body writer if available.
   */
  private sendRaw(clientId: string, message: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // Access the writable stream via the response's internal body
      // For SSE, we use the TransformStream pattern set up in the route handler
      const writer = (client.response as unknown as { _sseWriter?: WritableStreamDefaultWriter<string> })._sseWriter;
      if (writer) {
        writer.write(message).catch(() => {
          // Client disconnected, remove
          this.removeClient(clientId);
        });
      }
    } catch {
      // Client likely disconnected, clean up
      this.removeClient(clientId);
    }
  }

  /**
   * Register a writer for a client (called from the SSE route).
   */
  registerWriter(clientId: string, writer: WritableStreamDefaultWriter<string>): void {
    const client = this.clients.get(clientId);
    if (client) {
      (client.response as unknown as { _sseWriter?: WritableStreamDefaultWriter<string> })._sseWriter = writer;
    }
  }

  /**
   * Get the number of connected clients, optionally filtered by tenant.
   */
  getClientCount(tenantId?: string): number {
    if (tenantId) {
      return this.tenantChannels.get(tenantId)?.size ?? 0;
    }
    return this.clients.size;
  }

  /**
   * Get stats about connected clients.
   */
  getStats(): { totalClients: number; tenants: Record<string, number> } {
    const tenants: Record<string, number> = {};
    for (const [tenantId, clientIds] of this.tenantChannels) {
      tenants[tenantId] = clientIds.size;
    }
    return {
      totalClients: this.clients.size,
      tenants,
    };
  }
}

export const sseManager = new SSEManager();
