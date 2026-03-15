import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/availability';
import { CallType } from '@/lib/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const callType = searchParams.get('callType') as CallType;
  const timezone = searchParams.get('timezone') || 'UTC';

  if (!date || !callType) {
    return NextResponse.json({ error: 'date and callType required' }, { status: 400 });
  }

  try {
    const slots = await getAvailableSlots(date, callType, timezone);
    return NextResponse.json({ slots });
  } catch (error) {
    console.error('Availability error:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}
