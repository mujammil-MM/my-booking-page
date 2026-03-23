import prisma from '@/lib/prisma';

export type AnalyticsSummary = {
  totalBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  cancellationRate: number;
  noShowRate: number;
  popularSlots: { time: string; count: number }[];
  bookingsByType: { type: string; count: number }[];
};

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const today = new Date().toISOString().split('T')[0];

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
  for (const count of counts) {
    statusCounts[count.status] = count._count._all;
  }

  const total = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
  const cancelled = statusCounts.CANCELLED || 0;
  const noShow = statusCounts.NO_SHOW || 0;
  const completed = statusCounts.COMPLETED || 0;

  return {
    totalBookings: total,
    upcomingBookings: upcomingCount,
    completedBookings: completed,
    cancelledBookings: cancelled,
    noShowBookings: noShow,
    cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
    popularSlots: popularSlotsRaw.map(slot => ({
      time: slot.startTime,
      count: slot._count._all,
    })),
    bookingsByType: typeCountsRaw.map(type => ({
      type: type.callType,
      count: type._count._all,
    })),
  };
}
