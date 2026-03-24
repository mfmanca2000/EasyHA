import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/middleware';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function computeToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + ':easyha-secure');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(request: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
  }

  const body = await request.json();
  if (body.password !== sitePassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await computeToken(sitePassword);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });

  return response;
}
