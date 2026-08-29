import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Build the database URL with pgbouncer compatibility.
 * Supabase connection pooler (port 6543) uses PgBouncer which doesn't support
 * prepared statements. Prisma must be told to disable them.
 */
function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || ''
  if (!url) return url
  // If using Supabase pooler (port 6543), add pgbouncer=true
  if (url.includes(':6543/') && !url.includes('pgbouncer=')) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}pgbouncer=true`
  }
  return url
}

/**
 * Database connection (PostgreSQL via Supabase).
 * The app starts and renders pages even if PG is not yet available.
 * API routes that need the database will return 503 with a clear message.
 */
function createPrismaClient(): PrismaClient {
  const dbUrl = buildDatabaseUrl()
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
  })
  return client
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Check if the database is reachable. Returns true if connected.
 */
export async function isDatabaseConnected(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`
    return true
    } catch {
    return false
  }
}
