import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateEndTime } from '@/lib/availability';
import { createCalendarEvent } from '@/lib/calendar';
import { sendConfirmationEmail } from '@/lib/email';
import { CallType } from '@/lib/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (dateFrom && dateTo) {
    where.date = { gte: dateFrom, lte: dateTo };
  } else if (dateFrom) {
    where.date = { gte: dateFrom };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { qualification: true },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  return NextResponse.json({ bookings });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName,
      email,
      phone,
      company,
      discussionTopic,
      callType,
      date,
      startTime,
      timeZone,
      qualification,
    } = body;

    // Validate required fields
    if (!clientName || !email || !phone || !callType || !date || !startTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const endTime = calculateEndTime(startTime, callType as CallType);

    // Check for double booking
    const existing = await prisma.booking.findFirst({
      where: {
        date,
        status: { not: 'CANCELLED' },
        OR: [
          { startTime: { lte: startTime }, endTime: { gt: startTime } },
          { startTime: { lt: endTime }, endTime: { gte: endTime } },
          { startTime: { gte: startTime }, endTime: { lte: endTime } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'This time slot is no longer available' }, { status: 409 });
    }

    // Create calendar event & get meeting link
    const calendarResult = await createCalendarEvent({
      clientName,
      email,
      date,
      startTime,
      endTime,
      discussionTopic: discussionTopic || '',
      callType,
    });

    const meetingLink = calendarResult?.meetingLink || '';
    const calendarEventId = calendarResult?.eventId || '';

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        clientName,
        email,
        phone,
        company: company || '',
        discussionTopic: discussionTopic || '',
        callType,
        date,
        startTime,
        endTime,
        timeZone: timeZone || 'UTC',
        meetingLink,
        calendarEventId,
        status: 'CONFIRMED',
        qualification: qualification
          ? {
              create: {
                problem: qualification.problem || '',
                budgetRange: qualification.budgetRange || '',
                timeline: qualification.timeline || '',
                workedWithAgencyBefore: qualification.workedWithAgencyBefore || '',
              },
            }
          : undefined,
      },
      include: { qualification: true },
    });

    // Send confirmation email
    try {
      await sendConfirmationEmail({
        id: booking.id,
        clientName: booking.clientName,
        email: booking.email,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        callType: booking.callType,
        meetingLink: booking.meetingLink,
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Booking creation error:', error);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
