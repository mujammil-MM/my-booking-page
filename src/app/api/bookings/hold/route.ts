import { NextRequest, NextResponse } from 'next/server';
import { CallType, getCallDuration } from '@/lib/types';
import { findBookingConflictData } from '@/lib/dataStore';
import { toDate, formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';

/**
 * POST /api/bookings/hold
 * Body: { date: string (local), startTime: string (HH:mm local), callType: string, timeZone: string }
 * Returns: { available: boolean }
 * Quickly checks whether a slot is still free before the client fills out the full form.
 */
export async function POST(req: NextRequest) {
  try {
    const { date: localDate, startTime: localStart, callType, timeZone: clientTz } = await req.json();

    if (!localDate || !localStart || !callType) {
      return NextResponse.json({ error: 'date, startTime, and callType are required' }, { status: 400 });
    }

    const duration = getCallDuration(callType as CallType);

    const startDateTimeLocal = toDate(`${localDate}T${localStart}:00`, { timeZone: clientTz || 'UTC' });
    const date = formatInTimeZone(startDateTimeLocal, 'UTC', 'yyyy-MM-dd');
    const startTime = formatInTimeZone(startDateTimeLocal, 'UTC', 'HH:mm');

    const endDateTimeUTC = addMinutes(startDateTimeLocal, duration);
    const endTime = formatInTimeZone(endDateTimeUTC, 'UTC', 'HH:mm');
    const endDate = formatInTimeZone(endDateTimeUTC, 'UTC', 'yyyy-MM-dd');

    const conflict = await findBookingConflictData(null, date, startTime, endTime, endDate);

    return NextResponse.json({ available: !conflict });
  } catch (error) {
    console.error('Hold check error:', error);
    return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 });
  }
}
