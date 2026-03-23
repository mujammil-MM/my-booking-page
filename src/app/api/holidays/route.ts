import { NextRequest, NextResponse } from 'next/server';
import { createHolidayData, deleteHolidayData, listHolidaysData } from '@/lib/dataStore';

export async function GET() {
  try {
    return NextResponse.json(await listHolidaysData(), {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Failed to fetch holidays:', error);
    return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { date, note } = await req.json();

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const holiday = await createHolidayData(date, note || '');

    return NextResponse.json(holiday, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Holiday already exists for this date' }, { status: 409 });
    }

    console.error('Failed to create holiday:', error);
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Holiday id is required' }, { status: 400 });
    }

    await deleteHolidayData(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete holiday:', error);
    return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 });
  }
}
