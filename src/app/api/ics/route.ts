import { NextRequest, NextResponse } from 'next/server';
import { getBookingData } from '@/lib/dataStore';
import { generateICS } from '@/lib/ics';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Booking id is required' }, { status: 400 });
    }

    const booking = await getBookingData(id);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const ics = generateICS({
      id: booking.id,
      clientName: booking.clientName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      meetingLink: booking.meetingLink,
      callType: booking.callType,
      discussionTopic: booking.discussionTopic,
    });

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar',
        'Content-Disposition': `attachment; filename="booking-${id}.ics"`,
      },
    });
  } catch (error) {
    console.error('Failed to generate ICS:', error);
    return NextResponse.json({ error: 'Failed to generate ICS file' }, { status: 500 });
  }
}
