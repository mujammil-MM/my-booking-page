import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendReminderEmail } from '@/lib/email';

export async function POST() {
  try {
    const now = new Date();

    // Find all confirmed bookings that are upcoming
    const bookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        date: { gte: now.toISOString().split('T')[0] },
      },
    });

    let sentCount = 0;

    for (const booking of bookings) {
      const meetingTime = new Date(`${booking.date}T${booking.startTime}:00`);
      const diff = meetingTime.getTime() - now.getTime();
      const hoursUntil = diff / (1000 * 60 * 60);
      const minutesUntil = diff / (1000 * 60);

      const reminders = [
        { label: '24 hours', minHours: 23, maxHours: 25 },
        { label: '1 hour', minHours: 0.8, maxHours: 1.2 },
        { label: '10 minutes', minHours: 0, maxHours: 0.2 },
      ];

      for (const reminder of reminders) {
        if (hoursUntil >= reminder.minHours && hoursUntil <= reminder.maxHours) {
          // Check if already sent
          const alreadySent = await prisma.reminderLog.findFirst({
            where: {
              bookingId: booking.id,
              scheduledFor: reminder.label,
            },
          });

          if (!alreadySent) {
            await sendReminderEmail(
              {
                id: booking.id,
                clientName: booking.clientName,
                email: booking.email,
                date: booking.date,
                startTime: booking.startTime,
                meetingLink: booking.meetingLink,
                callType: booking.callType,
              },
              reminder.label
            );

            // Log WhatsApp reminder (stub)
            console.log(
              `📱 [WHATSAPP STUB] Would send "${reminder.label}" reminder to ${booking.phone} for booking ${booking.id}`
            );

            await prisma.reminderLog.create({
              data: {
                bookingId: booking.id,
                type: 'EMAIL',
                scheduledFor: reminder.label,
                sentAt: new Date(),
              },
            });

            sentCount++;
          }
        }
      }
    }

    return NextResponse.json({ sent: sentCount });
  } catch (error) {
    console.error('Reminder error:', error);
    return NextResponse.json({ error: 'Failed to process reminders' }, { status: 500 });
  }
}
