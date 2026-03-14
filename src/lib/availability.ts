import { getCallDuration, CallType, TimeSlot } from './types';
import prisma from './prisma';

const WORKING_START = parseInt(process.env.WORKING_HOURS_START || '10');
const WORKING_END = parseInt(process.env.WORKING_HOURS_END || '18');
const BUFFER = parseInt(process.env.BUFFER_MINUTES || '10');

export async function getAvailableSlots(
  date: string,
  callType: CallType
): Promise<TimeSlot[]> {
  const duration = getCallDuration(callType);

  // Fetch existing bookings for the date
  const bookings = await prisma.booking.findMany({
    where: {
      date,
      status: { not: 'CANCELLED' },
    },
    select: { startTime: true, endTime: true },
  });

  // Fetch blocked slots for the date
  const blockedSlots = await prisma.blockedSlot.findMany({
    where: { date },
    select: { startTime: true, endTime: true },
  });

  const allBlocked = [
    ...bookings.map(b => ({ start: timeToMin(b.startTime), end: timeToMin(b.endTime) })),
    ...blockedSlots.map(b => ({ start: timeToMin(b.startTime), end: timeToMin(b.endTime) })),
  ];

  const slots: TimeSlot[] = [];
  const startMin = WORKING_START * 60;
  const endMin = WORKING_END * 60;

  for (let m = startMin; m + duration <= endMin; m += 30) {
    const slotStart = m;
    const slotEnd = m + duration;

    // Check if this slot (with buffer) overlaps any existing booking
    const available = !allBlocked.some(blocked => {
      const blockedWithBuffer = {
        start: blocked.start - BUFFER,
        end: blocked.end + BUFFER,
      };
      return slotStart < blockedWithBuffer.end && slotEnd > blockedWithBuffer.start;
    });

    slots.push({
      time: minToTime(m),
      available,
    });
  }

  return slots;
}

export function timeToMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calculateEndTime(startTime: string, callType: CallType): string {
  const duration = getCallDuration(callType);
  const startMin = timeToMin(startTime);
  return minToTime(startMin + duration);
}

export function isDateAvailable(date: string): boolean {
  const d = new Date(date);
  const day = d.getDay();
  // Exclude weekends (0=Sunday, 6=Saturday)
  if (day === 0 || day === 6) return false;
  // Exclude past dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return false;
  return true;
}

export function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
