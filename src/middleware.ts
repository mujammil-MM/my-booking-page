import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminSession';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin (but allow /admin-login)
  if (pathname.startsWith('/admin') && pathname !== '/admin-login') {
    const token = request.cookies.get('admin_session')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/admin-login', request.url));
    }

    try {
      await verifyAdminSession(token);
      return NextResponse.next();
    } catch (error) {
      console.error('JWT verification failed:', error);
      return NextResponse.redirect(new URL('/admin-login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
