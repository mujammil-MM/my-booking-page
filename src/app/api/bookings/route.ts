import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from '@/lib/calendar';
import { sendCancellationEmail, sendConfirmationEmail, sendAdminNotificationEmail } from '@/lib/email';
import { sendAdminSMS } from '@/lib/sms';
import { mirrorBookingToSupabase } from '@/lib/supabaseMirror';
import { CallType, getCallDuration } from '@/lib/types';
import { toDate, formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const isValidPhone = (phone: string) => /^[\d\s+\-()]{7,20}$/.test(phone.trim());

function getUtcRange(localDate: string, localStart: string, clientTz: string, duration: number) {
  const startUtc = toDate(`${localDate}T${localStart}:00`, { timeZone: clientTz || 'UTC' });
  const endUtc = addMinutes(startUtc, duration);

  return {
    date: formatInTimeZone(startUtc, 'UTC', 'yyyy-MM-dd'),
    startTime: formatInTimeZone(startUtc, 'UTC', 'HH:mm'),
    endTime: formatInTimeZone(endUtc, 'UTC', 'HH:mm'),
    endDate: formatInTimeZone(endUtc, 'UTC', 'yyyy-MM-dd'),
  };
}

async function getBookingById(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: { qualification: true },
  });
}

async function hasBookingConflict(idToExclude: string | null, date: string, startTime: string, endTime: string, endDate: string) {
  return prisma.booking.findFirst({
    where: {
      ...(idToExclude ? { id: { not: idToExclude } } : {}),
      status: { not: 'CANCELLED' },
      OR: [
        {
          date,
          OR: [
            { startTime: { lte: startTime }, endTime: { gt: startTime } },
            { startTime: { lt: endTime }, endTime: { gte: endTime } },
            { startTime: { gte: startTime }, endTime: { lte: endTime } },
          ],
        },
        {
          date: endDate,
          OR: [
            { startTime: { lte: startTime }, endTime: { gt: startTime } },
            { startTime: { lt: endTime }, endTime: { gte: endTime } },
            { startTime: { gte: startTime }, endTime: { lte: endTime } },
          ],
        },
      ],
    },
    select: { id: true },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    if (id) {
      const booking = await getBookingById(id);

      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      return NextResponse.json(booking);
    }

    const where = {
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { clientName: { contains: query } },
              { email: { contains: query } },
              { company: { contains: query } },
              { discussionTopic: { contains: query } },
            ],
          }
        : {}),
    };

    const [bookings, totalCount] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { qualification: true },
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

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Booking id is required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (body.date && body.startTime) {
      if (booking.rescheduleCount >= 2) {
        return NextResponse.json({ error: 'Maximum reschedules reached (2)' }, { status: 400 });
      }

      const clientTz = body.timeZone || booking.timeZone || 'UTC';
      const duration = getCallDuration(booking.callType as CallType);
      const startDateTimeUTC = toDate(`${body.date}T${body.startTime}:00`, { timeZone: clientTz });
      const utcDate = formatInTimeZone(startDateTimeUTC, 'UTC', 'yyyy-MM-dd');
      const utcStart = formatInTimeZone(startDateTimeUTC, 'UTC', 'HH:mm');
      const endDateTimeUTC = addMinutes(startDateTimeUTC, duration);
      const utcEnd = formatInTimeZone(endDateTimeUTC, 'UTC', 'HH:mm');
      const utcEndDate = formatInTimeZone(endDateTimeUTC, 'UTC', 'yyyy-MM-dd');

      const currentMeetingUTC = toDate(`${booking.date}T${booking.startTime}:00`, { timeZone: 'UTC' });
      const now = new Date();
      const hoursUntil = (currentMeetingUTC.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil < 2) {
        return NextResponse.json(
          { error: 'Cannot reschedule within 2 hours of the meeting' },
          { status: 400 }
        );
      }

      const conflict = await hasBookingConflict(id, utcDate, utcStart, utcEnd, utcEndDate);
      if (conflict) {
        return NextResponse.json({ error: 'New time slot is not available' }, { status: 409 });
      }

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

    if (body.status) {
      const updated = await prisma.booking.update({
        where: { id },
        data: { status: body.status },
        include: { qualification: true },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update booking:', error);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Booking id is required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.calendarEventId) {
      await deleteCalendarEvent(booking.calendarEventId);
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    try {
      await sendCancellationEmail({
        clientName: booking.clientName,
        email: booking.email,
        date: booking.date,
        startTime: booking.startTime,
        timeZone: booking.timeZone,
      });
    } catch (error) {
      console.error('Failed to send cancellation email:', error);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to cancel booking:', error);
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();

    if (body.website && body.website.length > 0) {
      return NextResponse.json({ success: true, id: 'bot' });
    }

    const {
      clientName,
      email,
      phone,
      company,
      discussionTopic,
      callType,
      date: localDate,
      startTime: localStart,
      timeZone: clientTz,
      qualification,
    } = body;

    if (!clientName || !email || !phone || !callType || !localDate || !localStart) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isValidEmail(email) || !isValidPhone(phone)) {
      return NextResponse.json({ error: 'Invalid contact details' }, { status: 400 });
    }

    const duration = getCallDuration(callType as CallType);
    const { date, startTime, endTime, endDate } = getUtcRange(localDate, localStart, clientTz || 'UTC', duration);

    const conflict = await hasBookingConflict(null, date, startTime, endTime, endDate);
    if (conflict) {
      return NextResponse.json(
        { error: 'This time slot is no longer available. Please choose another time.' },
        { status: 409 }
      );
    }

    let meetingLink = '';
    let calendarEventId = '';

    try {
      const calendarResult = await createCalendarEvent({
        clientName,
        email,
        date,
        startTime,
        endTime,
        discussionTopic: discussionTopic || '',
        callType,
      });

      meetingLink = calendarResult?.meetingLink || '';
      calendarEventId = calendarResult?.eventId || '';
    } catch (error) {
      console.error('Calendar event creation failed:', error);
    }

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

    void mirrorBookingToSupabase({
      clientName: booking.clientName,
      email: booking.email,
      phone: booking.phone,
      company: booking.company,
      callType: booking.callType,
      date: booking.date,
      startTime: booking.startTime,
      meetingLink: booking.meetingLink,
      discussion: booking.discussionTopic,
      problem: booking.qualification?.problem,
      budget: booking.qualification?.budgetRange,
      timeline: booking.qualification?.timeline,
      priorAgency: booking.qualification?.workedWithAgencyBefore,
      clientTimeZone: booking.timeZone,
    }).catch(error => console.error('Supabase mirror failed:', error));

    void Promise.all([
      sendConfirmationEmail({
        id: booking.id,
        clientName: booking.clientName,
        email: booking.email,
        phone: booking.phone,
        company: booking.company,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        callType: booking.callType,
        meetingLink: booking.meetingLink,
        timeZone: booking.timeZone,
        discussion: booking.discussionTopic,
        problem: booking.qualification?.problem,
        budget: booking.qualification?.budgetRange,
        timeline: booking.qualification?.timeline,
        priorAgency: booking.qualification?.workedWithAgencyBefore,
      }).catch(error => console.error('Confirmation email failed:', error)),
      sendAdminNotificationEmail({
        clientName: booking.clientName,
        email: booking.email,
        phone: booking.phone,
        company: booking.company,
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
      }).catch(error => console.error('Admin email failed:', error)),
      sendAdminSMS({
        clientName: booking.clientName,
        date: booking.date,
        startTime: booking.startTime,
      }).catch(error => console.error('Admin SMS failed:', error)),
    ]);

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Booking POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
