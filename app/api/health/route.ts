/**
 * Health Check API Route
 * 
 * Simple health check endpoint for monitoring and load balancers.
 * This route does not require authentication.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
