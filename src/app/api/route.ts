import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    name: 'HubSphere V3',
    version: '3.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
