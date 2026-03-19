import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { createCalendarEvent } from '@/lib/calendar';
import { sendConfirmationEmail, sendAdminNotificationEmail } from '@/lib/email';
import { sendAdminSMS } from '@/lib/sms';
import { CallType, getCallDuration } from '@/lib/types';
import { toDate, formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';

// ─── Rate Limiting ───────────────────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true; // allowed
  }

  if (entry.count >= RATE_LIMIT_MAX) return false; // blocked

  entry.count += 1;
  return true;
}

// ─── Validation ──────────────────────────────────────────────────────────────
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone: string): boolean {
  return /^[\d\s\+\-\(\)]{7,20}$/.test(phone.trim());
}

// ─── GET – List bookings (admin) ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const query = searchParams.get('q');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    const where: Prisma.BookingWhereInput = {};
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

// ─── POST – Create booking ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // ── Rate limiting ──
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many booking attempts. Please wait an hour and try again.' },
        { status: 429 }
      );
    }

    const body = await req.json();

    // ── Honeypot check (bot trap) ──
    if (body.website && body.website.length > 0) {
      // Silently succeed to fool bots
      return NextResponse.json({ id: 'bot', success: true }, { status: 200 });
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

    // ── Server-side validation ──
    const missingFields: string[] = [];
    if (!clientName?.trim()) missingFields.push('name');
    if (!email?.trim()) missingFields.push('email');
    if (!phone?.trim()) missingFields.push('phone');
    if (!callType) missingFields.push('call type');
    if (!localDate) missingFields.push('date');
    if (!localStart) missingFields.push('time');

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number (digits, spaces, dashes, +, parentheses).' },
        { status: 400 }
      );
    }

    const duration = getCallDuration(callType as CallType);

    // Convert local time to UTC
    const startDateTimeLocal = toDate(`${localDate}T${localStart}:00`, { timeZone: clientTz || 'UTC' });
    const date = formatInTimeZone(startDateTimeLocal, 'UTC', 'yyyy-MM-dd');
    const startTime = formatInTimeZone(startDateTimeLocal, 'UTC', 'HH:mm');

    const endDateTimeUTC = addMinutes(startDateTimeLocal, duration);
    const endTime = formatInTimeZone(endDateTimeUTC, 'UTC', 'HH:mm');
    const endDate = formatInTimeZone(endDateTimeUTC, 'UTC', 'yyyy-MM-dd');

    // Double-booking check
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
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This time slot is no longer available. Please choose another time.' },
        { status: 409 }
      );
    }

    // Create calendar event (graceful fallback if it fails)
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
    } catch (calError) {
      console.error('Calendar event creation failed (non-fatal):', calError);
    }

    // Create booking in Prisma
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

    // Send emails (non-blocking, errors logged)
    const emailPromises = [
      sendConfirmationEmail({
        id: booking.id,
        clientName: booking.clientName,
        email: booking.email,
        phone: booking.phone,
        company: booking.company ?? '',
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        callType: booking.callType,
        meetingLink: booking.meetingLink,
        timeZone: booking.timeZone,
        discussion: booking.discussionTopic ?? '',
        problem: booking.qualification?.problem,
        budget: booking.qualification?.budgetRange,
        timeline: booking.qualification?.timeline,
        priorAgency: booking.qualification?.workedWithAgencyBefore,
      }).catch(e => console.error('Confirmation email failed:', e)),

      sendAdminNotificationEmail({
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
      }).catch(e => console.error('Admin email failed:', e)),

      sendAdminSMS({
        clientName: booking.clientName,
        date: booking.date,
        startTime: booking.startTime,
      }).catch(e => console.error('Admin SMS failed:', e)),
    ];

    // Fire emails in background (don't await to keep response fast)
    Promise.all(emailPromises);

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Booking creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create booking. Please try again.' },
      { status: 500 }
    );
  }
}
