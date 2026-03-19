import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendCancellationEmail } from '@/lib/email';

/**
 * POST /api/bookings/cancel
 * Body: { bookingId: string }
 * Cancels a booking and sends a cancellation email.
 */
export async function POST(req: NextRequest) {
  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 409 });
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });

    // Send cancellation email (non-fatal)
    sendCancellationEmail({
      clientName: booking.clientName,
      email: booking.email,
      date: booking.date,
      startTime: booking.startTime,
      timeZone: booking.timeZone,
    }).catch(e => console.error('Cancellation email failed:', e));

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Cancel booking error:', error);
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
}
