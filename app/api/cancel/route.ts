import { NextResponse } from 'next/server';
import { cancelRequestSchema } from '@/lib/validation/schemas';
import { cancelRun } from '@/lib/services/run-store';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: { runId: string };
  try {
    const json = await request.json();
    body = cancelRequestSchema.parse(json);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const canceled = cancelRun(body.runId);
  return NextResponse.json({ ok: true, canceled });
}