import { NextResponse } from 'next/server';
import { getBootstrapData } from '@/lib/dataStore';

export async function GET() {
  try {
    return NextResponse.json(
      await getBootstrapData(),
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
