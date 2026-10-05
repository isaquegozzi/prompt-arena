import { NextResponse } from 'next/server';
import { DEMO_MODELS } from '@/providers/demo/mock-models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ models: DEMO_MODELS });
}