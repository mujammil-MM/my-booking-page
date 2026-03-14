import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateEndTime } from '@/lib/availability';
import { deleteCalendarEvent, updateCalendarEvent } from '@/lib/calendar';
import { sendCancellationEmail } from '@/lib/email';
import { CallType } from '@/lib/types';

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

    // Check 2-hour cutoff
    const meetingDateTime = new Date(`${booking.date}T${booking.startTime}:00`);
    const now = new Date();
    const hoursUntil = (meetingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntil < 2) {
      return NextResponse.json(
        { error: 'Cannot reschedule within 2 hours of the meeting' },
        { status: 400 }
      );
    }

    const endTime = calculateEndTime(body.startTime, booking.callType as CallType);

    // Check for conflicts on new date/time
    const conflict = await prisma.booking.findFirst({
      where: {
        id: { not: id },
        date: body.date,
        status: { not: 'CANCELLED' },
        OR: [
          { startTime: { lte: body.startTime }, endTime: { gt: body.startTime } },
          { startTime: { lt: endTime }, endTime: { gte: endTime } },
          { startTime: { gte: body.startTime }, endTime: { lte: endTime } },
        ],
      },
    });

    if (conflict) {
      return NextResponse.json({ error: 'New time slot is not available' }, { status: 409 });
    }

    // Update calendar event
    if (booking.calendarEventId) {
      await updateCalendarEvent(booking.calendarEventId, {
        date: body.date,
        startTime: body.startTime,
        endTime,
        clientName: booking.clientName,
      });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        date: body.date,
        startTime: body.startTime,
        endTime,
        rescheduleCount: { increment: 1 },
      },
      include: { qualification: true },
    });

    return NextResponse.json(updated);
  }

  // Handle status updates (e.g., mark as no-show, completed)
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
    });
  } catch (err) {
    console.error('Failed to send cancellation email:', err);
  }

  return NextResponse.json(updated);
}
