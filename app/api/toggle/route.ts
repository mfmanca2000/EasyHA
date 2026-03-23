import { NextRequest, NextResponse } from 'next/server';

const HA_URL = process.env.HA_URL!;
const HA_TOKEN = process.env.HA_TOKEN!;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { entity_id, action } = body as { entity_id: string; action: 'turn_on' | 'turn_off' };

  if (!entity_id || !['turn_on', 'turn_off'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const res = await fetch(`${HA_URL}/api/services/light/${action}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ entity_id }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'HA request failed' }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
