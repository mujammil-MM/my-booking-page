import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const settings = await prisma.globalSettings.findUnique({
      where: { id: 'default' },
    });
    return NextResponse.json(settings || { holidayMode: false });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { holidayMode } = await req.json();
    const settings = await prisma.globalSettings.upsert({
      where: { id: 'default' },
      update: { holidayMode },
      create: { id: 'default', holidayMode },
    });
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
