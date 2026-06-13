import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'wcb_session';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'worldcupbets-dev-secret-change-in-production'
);

const publicRoutes = new Set(['/login', '/register']);
const publicApiPrefixes = ['/api/auth', '/api/cron'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicRoutes.has(pathname) || publicApiPrefixes.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.next();
    } catch {
      // invalid / expired token — fall through to redirect
    }
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirectedFrom', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
