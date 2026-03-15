import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateLimit = thirtyDaysAgo.toISOString().split('T')[0];

    // Fetch confirmed bookings from the last 30 days
    const bookings = await prisma.booking.findMany({
      where: {
        date: { gte: dateLimit },
        status: { not: 'CANCELLED' }
      },
      select: { date: true }
    });

    // Group by date
    const countsByDate: Record<string, number> = {};
    
    // Initialize dates
    for (let i = 0; i <= 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      countsByDate[str] = 0;
    }

    bookings.forEach(b => {
      if (countsByDate[b.date] !== undefined) {
        countsByDate[b.date]++;
      }
    });

    // Convert to sorted array
    const data = Object.keys(countsByDate)
      .sort()
      .map(date => ({
        date,
        count: countsByDate[date],
        displayDate: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch daily analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
