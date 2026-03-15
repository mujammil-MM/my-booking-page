import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createCalendarEvent } from '@/lib/calendar';
import { sendConfirmationEmail, sendAdminNotificationEmail } from '@/lib/email';
import { sendAdminSMS } from '@/lib/sms';
import { CallType, getCallDuration } from '@/lib/types';
import { toDate } from 'date-fns-tz';
import { addMinutes, format } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, any> = {};
    if (status) where.status = status;
    if (dateFrom && dateTo) {
      where.date = { gte: dateFrom, lte: dateTo };
    } else if (dateFrom) {
      where.date = { gte: dateFrom };
    }

    if (query) {
      where.OR = [
        { clientName: { contains: query } },
        { email: { contains: query } },
        { company: { contains: query } },
      ];
    }

    // Optimization: Fetch only required fields for list view
    // Optimization: Implement pagination to avoid loading thousands of records
    const [bookings, totalCount] = await Promise.all([
      prisma.booking.findMany({
        where,
        select: {
          id: true,
          clientName: true,
          email: true,
          phone: true,
          company: true,
          callType: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          createdAt: true,
          meetingLink: true,
          timeZone: true,
          discussionTopic: true,
          qualification: {
            select: {
              problem: true,
              budgetRange: true,
              timeline: true,
              workedWithAgencyBefore: true,
            },
          },
        },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.booking.count({ where }),
    ]);

    return NextResponse.json({ bookings, totalCount, limit, offset });
  } catch (error) {
    console.error('Failed to fetch bookings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
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
      date: localDate, // Local to client
      startTime: localStart, // Local to client
      timeZone: clientTz,
      qualification,
    } = body;

    // Validate required fields
    if (!clientName || !email || !phone || !callType || !localDate || !localStart) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const duration = getCallDuration(callType as CallType);

    // Convert local time to UTC
    const startDateTimeLocal = toDate(`${localDate}T${localStart}:00`, { timeZone: clientTz });
    const date = format(startDateTimeLocal, 'yyyy-MM-dd');
    const startTime = format(startDateTimeLocal, 'HH:mm');
    
    const endDateTimeUTC = addMinutes(startDateTimeLocal, duration);
    const endTime = format(endDateTimeUTC, 'HH:mm');
    const endDate = format(endDateTimeUTC, 'yyyy-MM-dd');

    // Check for double booking using the normalized UTC date/time range
    // Note: A booking might span across two UTC dates, but for now we simplify 
    // to checking the normalized start date.
    const existing = await prisma.booking.findFirst({
      where: {
        status: { not: 'CANCELLED' },
        OR: [
          {
            date,
            OR: [
              { startTime: { lte: startTime }, endTime: { gt: startTime } },
              { startTime: { lt: endTime }, endTime: { gte: endTime } },
              { startTime: { gte: startTime }, endTime: { lte: endTime } },
            ]
          },
          {
            date: endDate,
            OR: [
              { startTime: { lte: startTime }, endTime: { gt: startTime } },
              { startTime: { lt: endTime }, endTime: { gte: endTime } },
              { startTime: { gte: startTime }, endTime: { lte: endTime } },
            ]
          }
        ]
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
        timeZone: clientTz || 'UTC',
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
        timeZone: booking.timeZone,
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    // Send admin notification email
    try {
      await sendAdminNotificationEmail({
        clientName: booking.clientName,
        email: booking.email,
        phone: booking.phone,
        company: booking.company || '',
        callType: booking.callType,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        meetingLink: booking.meetingLink,
        timeZone: booking.timeZone,
        discussion: booking.discussionTopic,
        problem: booking.qualification?.problem,
        budget: booking.qualification?.budgetRange,
        timeline: booking.qualification?.timeline,
        priorAgency: booking.qualification?.workedWithAgencyBefore,
      });
    } catch (adminEmailError) {
      console.error('Failed to send admin notification email:', adminEmailError);
    }

    // Send admin SMS notification
    try {
      await sendAdminSMS({
        clientName: booking.clientName,
        date: booking.date,
        startTime: booking.startTime,
      });
    } catch (smsError) {
      console.error('Failed to send admin SMS:', smsError);
    }

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Booking creation error:', error);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
