import { getCallDuration, CallType, TimeSlot } from './types';
import prisma from './prisma';
import { toDate, toZonedTime } from 'date-fns-tz';
import { addDays, addHours, addMinutes, format } from 'date-fns';

const WORKING_START = parseInt(process.env.WORKING_HOURS_START || '10', 10);
const WORKING_END = parseInt(process.env.WORKING_HOURS_END || '18', 10);
const BUFFER = parseInt(process.env.BUFFER_MINUTES || '10', 10);
const ADMIN_TZ = process.env.ADMIN_TZ || 'Asia/Kolkata';

function getUtcSlotRange(date: string, startTime: string, endTime: string) {
  const start = toDate(`${date}T${startTime}:00Z`);
  let end = toDate(`${date}T${endTime}:00Z`);

  if (end <= start) {
    end = addDays(end, 1);
  }

  return { start, end };
}

export async function getAvailableSlots(
  dateStr: string,
  callType: CallType,
  clientTimeZone = 'UTC'
): Promise<TimeSlot[]> {
  const duration = getCallDuration(callType);
  const clientDayStart = toDate(`${dateStr}T00:00:00`, { timeZone: clientTimeZone });
  const clientDayEnd = toDate(`${dateStr}T23:59:59`, { timeZone: clientTimeZone });

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: 'CANCELLED' },
      date: {
        gte: format(addHours(clientDayStart, -24), 'yyyy-MM-dd'),
        lte: format(addHours(clientDayEnd, 24), 'yyyy-MM-dd'),
      },
    },
    select: { date: true, startTime: true, endTime: true },
  });

  const slots: TimeSlot[] = [];

  for (let minutes = 0; minutes < 1440; minutes += 30) {
    const slotStartClient = addMinutes(clientDayStart, minutes);
    const slotEndClient = addMinutes(slotStartClient, duration);

    if (slotEndClient > clientDayEnd) {
      break;
    }

    const slotStartAdmin = toZonedTime(slotStartClient, ADMIN_TZ);
    const slotEndAdmin = addMinutes(slotStartAdmin, duration);
    const startHour = slotStartAdmin.getHours();
    const startMinute = slotStartAdmin.getMinutes();
    const endHour = slotEndAdmin.getHours();
    const endMinute = slotEndAdmin.getMinutes();

    const startsInWorkingHours =
      startHour >= WORKING_START &&
      (startHour < WORKING_END || (startHour === WORKING_END && startMinute === 0));
    const endsInWorkingHours =
      endHour < WORKING_END || (endHour === WORKING_END && endMinute === 0);

    if (!startsInWorkingHours || !endsInWorkingHours) {
      continue;
    }

    const isBlocked = bookings.some(booking => {
      const { start, end } = getUtcSlotRange(booking.date, booking.startTime, booking.endTime);
      const startWithBuffer = addMinutes(start, -BUFFER);
      const endWithBuffer = addMinutes(end, BUFFER);

      return slotStartClient < endWithBuffer && slotEndClient > startWithBuffer;
    });

    slots.push({
      time: format(slotStartClient, 'HH:mm'),
      available: !isBlocked,
    });
  }

  return slots;
}

export function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatDate(dateStr: string, timeZone = 'UTC'): string {
  const d = toDate(`${dateStr}T00:00:00`, { timeZone });
  return format(d, 'EEEE, MMMM d, yyyy');
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

export function isDateAvailable(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  if (day === 0 || day === 6) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return false;
  return true;
}
