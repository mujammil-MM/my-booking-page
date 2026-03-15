import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteCalendarEvent, updateCalendarEvent } from '@/lib/calendar';
import { sendCancellationEmail } from '@/lib/email';
import { CallType, getCallDuration } from '@/lib/types';
import { toDate } from 'date-fns-tz';
import { addMinutes, format } from 'date-fns';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { qualification: true },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  return NextResponse.json(booking);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Handle reschedule
  if (body.date && body.startTime) {
    // Check max reschedules
    if (booking.rescheduleCount >= 2) {
      return NextResponse.json({ error: 'Maximum reschedules reached (2)' }, { status: 400 });
    }

    const clientTz = body.timeZone || booking.timeZone || 'UTC';
    const duration = getCallDuration(booking.callType as CallType);

    // Normalize incoming local time to UTC
    const startDateTimeUTC = toDate(`${body.date}T${body.startTime}:00`, { timeZone: clientTz });
    const utcDate = format(startDateTimeUTC, 'yyyy-MM-dd');
    const utcStart = format(startDateTimeUTC, 'HH:mm');
    
    const endDateTimeUTC = addMinutes(startDateTimeUTC, duration);
    const utcEnd = format(endDateTimeUTC, 'HH:mm');
    const utcEndDate = format(endDateTimeUTC, 'yyyy-MM-dd');

    // Check 2-hour cutoff (using normalized UTC)
    const currentMeetingUTC = toDate(`${booking.date}T${booking.startTime}:00`, { timeZone: 'UTC' });
    const now = new Date();
    const hoursUntil = (currentMeetingUTC.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntil < 2) {
      return NextResponse.json(
        { error: 'Cannot reschedule within 2 hours of the meeting' },
        { status: 400 }
      );
    }

    // Check for conflicts on new date/time (UTC)
    const conflict = await prisma.booking.findFirst({
      where: {
        id: { not: id },
        status: { not: 'CANCELLED' },
        OR: [
          {
            date: utcDate,
            OR: [
              { startTime: { lte: utcStart }, endTime: { gt: utcStart } },
              { startTime: { lt: utcEnd }, endTime: { gte: utcEnd } },
              { startTime: { gte: utcStart }, endTime: { lte: utcEnd } },
            ]
          },
          {
            date: utcEndDate,
            OR: [
              { startTime: { lte: utcStart }, endTime: { gt: utcStart } },
              { startTime: { lt: utcEnd }, endTime: { gte: utcEnd } },
              { startTime: { gte: utcStart }, endTime: { lte: utcEnd } },
            ]
          }
        ]
      },
    });

    if (conflict) {
      return NextResponse.json({ error: 'New time slot is not available' }, { status: 409 });
    }

    // Update calendar event
    if (booking.calendarEventId) {
      await updateCalendarEvent(booking.calendarEventId, {
        date: utcDate,
        startTime: utcStart,
        endTime: utcEnd,
        clientName: booking.clientName,
      });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        date: utcDate,
        startTime: utcStart,
        endTime: utcEnd,
        timeZone: clientTz,
        rescheduleCount: { increment: 1 },
      },
      include: { qualification: true },
    });

    return NextResponse.json(updated);
  }

  // Handle status updates
  if (body.status) {
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: body.status },
      include: { qualification: true },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Delete calendar event
  if (booking.calendarEventId) {
    await deleteCalendarEvent(booking.calendarEventId);
  }

  // Update status to cancelled
  const updated = await prisma.booking.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  // Send cancellation email
  try {
    await sendCancellationEmail({
      clientName: booking.clientName,
      email: booking.email,
      date: booking.date,
      startTime: booking.startTime,
      timeZone: booking.timeZone,
    });
  } catch (err) {
    console.error('Failed to send cancellation email:', err);
  }

  return NextResponse.json(updated);
}
