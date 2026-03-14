import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [total, confirmed, cancelled, noShow, completed, allBookings] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      prisma.booking.count({ where: { status: 'CANCELLED' } }),
      prisma.booking.count({ where: { status: 'NO_SHOW' } }),
      prisma.booking.count({ where: { status: 'COMPLETED' } }),
      prisma.booking.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: { startTime: true, callType: true },
      }),
    ]);

    // Popular time slots
    const timeCount: Record<string, number> = {};
    allBookings.forEach(b => {
      timeCount[b.startTime] = (timeCount[b.startTime] || 0) + 1;
    });
    const popularSlots = Object.entries(timeCount)
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Bookings by type
    const typeCount: Record<string, number> = {};
    allBookings.forEach(b => {
      typeCount[b.callType] = (typeCount[b.callType] || 0) + 1;
    });
    const bookingsByType = Object.entries(typeCount).map(([type, count]) => ({ type, count }));

    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;

    const upcoming = await prisma.booking.count({
      where: { status: 'CONFIRMED', date: { gte: today } },
    });

    return NextResponse.json({
      totalBookings: total,
      confirmedBookings: confirmed,
      upcomingBookings: upcoming,
      completedBookings: completed,
      cancelledBookings: cancelled,
      noShowBookings: noShow,
      cancellationRate,
      noShowRate,
      popularSlots,
      bookingsByType,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
}
