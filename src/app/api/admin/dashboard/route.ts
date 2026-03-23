import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAnalyticsSummary } from '@/lib/analytics';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const where = query
      ? {
          OR: [
            { clientName: { contains: query } },
            { email: { contains: query } },
            { company: { contains: query } },
            { discussionTopic: { contains: query } },
          ],
        }
      : {};

    const [settings, holidays, analytics, bookings, totalCount] = await Promise.all([
      prisma.globalSettings.findUnique({
        where: { id: 'default' },
        select: { holidayMode: true },
      }),
      prisma.holiday.findMany({
        orderBy: { date: 'asc' },
        select: { id: true, date: true, note: true },
      }),
      getAnalyticsSummary(),
      prisma.booking.findMany({
        where,
        include: { qualification: true },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.booking.count({ where }),
    ]);

    return NextResponse.json({
      holidayMode: settings?.holidayMode ?? false,
      holidays,
      analytics,
      bookings,
      totalCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Failed to fetch admin dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch admin dashboard' }, { status: 500 });
  }
}
