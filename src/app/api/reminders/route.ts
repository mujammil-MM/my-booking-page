import { NextResponse } from 'next/server';
import { listBookingsData } from '@/lib/dataStore';
import { sendReminderEmail } from '@/lib/email';
import prisma from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabaseShared';

async function hasReminderLog(bookingId: string, scheduledFor: string) {
  if (!supabaseAdmin) {
    const existingLog = await prisma.reminderLog.findFirst({
      where: {
        bookingId,
        scheduledFor,
      },
      select: { id: true },
    });

    return Boolean(existingLog);
  }

  const result = await supabaseAdmin
    .from('reminder_logs')
    .select('id')
    .eq('bookingId', bookingId)
    .eq('scheduledFor', scheduledFor)
    .maybeSingle();

  if (result.error) {
    console.warn('Reminder log lookup skipped:', result.error.message);
    return false;
  }

  return Boolean(result.data);
}

async function createReminderLog(bookingId: string, scheduledFor: string) {
  if (!supabaseAdmin) {
    await prisma.reminderLog.create({
      data: {
        bookingId,
        type: 'EMAIL',
        scheduledFor,
        sentAt: new Date(),
      },
    });
    return;
  }

  const result = await supabaseAdmin.from('reminder_logs').insert({
    bookingId,
    type: 'EMAIL',
    scheduledFor,
    sentAt: new Date().toISOString(),
  });

  if (result.error) {
    console.warn('Reminder log write skipped:', result.error.message);
  }
}

export async function POST() {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const { bookings } = await listBookingsData({
      status: 'CONFIRMED',
      dateFrom: today,
      limit: 500,
      offset: 0,
    });

    let sentCount = 0;

    for (const booking of bookings) {
      const meetingTime = new Date(`${booking.date}T${booking.startTime}:00Z`);
      const hoursUntil = (meetingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      const reminders = [
        { label: '24 hours', minHours: 23, maxHours: 25 },
        { label: '1 hour', minHours: 0.8, maxHours: 1.2 },
        { label: '10 minutes', minHours: 0, maxHours: 0.2 },
      ];

      for (const reminder of reminders) {
        if (hoursUntil < reminder.minHours || hoursUntil > reminder.maxHours) {
          continue;
        }

        if (await hasReminderLog(booking.id, reminder.label)) {
          continue;
        }

        await sendReminderEmail(
          {
            id: booking.id,
            clientName: booking.clientName,
            email: booking.email,
            date: booking.date,
            startTime: booking.startTime,
            meetingLink: booking.meetingLink,
            callType: booking.callType,
            timeZone: booking.timeZone,
          },
          reminder.label
        );

        await createReminderLog(booking.id, reminder.label);

        sentCount += 1;
      }
    }

    return NextResponse.json({ sent: sentCount });
  } catch (error) {
    console.error('Reminder error:', error);
    return NextResponse.json({ error: 'Failed to process reminders' }, { status: 500 });
  }
}
