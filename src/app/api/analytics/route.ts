import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Use aggregations for faster computation
    const [counts, popularSlotsRaw, typeCountsRaw, upcomingCount] = await Promise.all([
      prisma.booking.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.booking.groupBy({
        by: ['startTime'],
        where: { status: { not: 'CANCELLED' } },
        _count: { _all: true },
        orderBy: { _count: { startTime: 'desc' } },
        take: 5,
      }),
      prisma.booking.groupBy({
        by: ['callType'],
        _count: { _all: true },
      }),
      prisma.booking.count({
        where: { status: 'CONFIRMED', date: { gte: today } },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    counts.forEach(c => {
      statusCounts[c.status] = c._count._all;
    });

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const cancelled = statusCounts['CANCELLED'] || 0;
    const noShow = statusCounts['NO_SHOW'] || 0;
    const completed = statusCounts['COMPLETED'] || 0;

    const popularSlots = popularSlotsRaw.map(s => ({
      time: s.startTime,
      count: s._count._all,
    }));

    const bookingsByType = typeCountsRaw.map(t => ({
      type: t.callType,
      count: t._count._all,
    }));

    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;

    return NextResponse.json({
      totalBookings: total,
      upcomingBookings: upcomingCount,
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
