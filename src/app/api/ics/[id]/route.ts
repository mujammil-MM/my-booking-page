import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateICS } from '@/lib/ics';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({ where: { id } });
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
}
