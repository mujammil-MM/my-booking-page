import { NextResponse } from 'next/server';
import { getDailyAnalyticsData } from '@/lib/dataStore';

export async function GET() {
  try {
    return NextResponse.json(await getDailyAnalyticsData());
  } catch (error) {
    console.error('Failed to fetch daily analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
