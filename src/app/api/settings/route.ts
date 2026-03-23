import { NextRequest, NextResponse } from 'next/server';
import { getSettingsData, updateSettingsData } from '@/lib/dataStore';

export async function GET() {
  try {
    return NextResponse.json(await getSettingsData(), {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { holidayMode } = await req.json();
    return NextResponse.json(await updateSettingsData(Boolean(holidayMode)));
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
