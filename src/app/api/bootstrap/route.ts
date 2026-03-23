import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const [settings, holidays] = await Promise.all([
      prisma.globalSettings.findUnique({
        where: { id: 'default' },
        select: { holidayMode: true },
      }),
      prisma.holiday.findMany({
        orderBy: { date: 'asc' },
        select: { id: true, date: true, note: true },
      }),
    ]);

    return NextResponse.json(
      {
        holidayMode: settings?.holidayMode ?? false,
        holidays,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch bootstrap data:', error);
    return NextResponse.json({ error: 'Failed to fetch bootstrap data' }, { status: 500 });
  }
}
