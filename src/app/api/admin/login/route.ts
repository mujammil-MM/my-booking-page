import { NextRequest, NextResponse } from 'next/server';
import { createAdminSession } from '@/lib/adminSession';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.error('Failed to parse JSON body:', e);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { email, password } = body;

    const adminEmail = process.env.ADMIN_EMAIL || 'nova.rosehearts@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Nova9890$';

    if (email === adminEmail && password === adminPassword) {
      const token = await createAdminSession(email);

      const response = NextResponse.json({ success: true });
      
      // Set cookie
      response.cookies.set('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
