import { NextRequest, NextResponse } from 'next/server';

export const COOKIE_NAME = 'easyha-auth';

async function computeToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + ':easyha-secure');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API through without checking
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const password = process.env.SITE_PASSWORD || '';
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  const expected = await computeToken(password);

  if (!password || cookie !== expected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
