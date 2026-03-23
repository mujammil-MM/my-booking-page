import { NextResponse } from 'next/server';
import { getAnalyticsSummary } from '@/lib/analytics';

export async function GET() {
  try {
    return NextResponse.json(await getAnalyticsSummary());
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
}
