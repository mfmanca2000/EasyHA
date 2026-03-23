import { NextRequest, NextResponse } from 'next/server';

const HA_URL = process.env.HA_URL!;
const HA_TOKEN = process.env.HA_TOKEN!;

export async function GET(request: NextRequest) {
  const entities = request.nextUrl.searchParams.get('entities');
  if (!entities) {
    return NextResponse.json({ error: 'Missing entities param' }, { status: 400 });
  }

  const ids = entities.split(',').filter(Boolean);

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`${HA_URL}/api/states/${id}`, {
          headers: { Authorization: `Bearer ${HA_TOKEN}` },
          cache: 'no-store',
        });
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    })
  );

  return NextResponse.json(results);
}
