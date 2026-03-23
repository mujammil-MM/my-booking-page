import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsSummaryData, getBootstrapData, listBookingsData } from '@/lib/dataStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const [bootstrap, analytics, bookingPage] = await Promise.all([
      getBootstrapData(),
      getAnalyticsSummaryData(),
      listBookingsData({ query, limit, offset }),
    ]);

    return NextResponse.json({
      holidayMode: bootstrap.holidayMode,
      holidays: bootstrap.holidays,
      analytics,
      bookings: bookingPage.bookings,
      totalCount: bookingPage.totalCount,
      limit: bookingPage.limit,
      offset: bookingPage.offset,
    });
  } catch (error) {
    console.error('Failed to fetch admin dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch admin dashboard' }, { status: 500 });
  }
}
