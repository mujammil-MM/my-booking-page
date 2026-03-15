import { getCallDuration, CallType, TimeSlot } from './types';
import prisma from './prisma';
import { toDate, toZonedTime } from 'date-fns-tz';
import { addMinutes, addHours, format } from 'date-fns';

const WORKING_START = parseInt(process.env.WORKING_HOURS_START || '10');
const WORKING_END = parseInt(process.env.WORKING_HOURS_END || '18');
const BUFFER = parseInt(process.env.BUFFER_MINUTES || '10');
const ADMIN_TZ = process.env.ADMIN_TZ || 'Asia/Kolkata'; // Default admin timezone

export async function getAvailableSlots(
  dateStr: string,
  callType: CallType,
  clientTimeZone: string = 'UTC'
): Promise<TimeSlot[]> {
  const duration = getCallDuration(callType);

  // 1. Define the interval for the requested day in the client's timezone
  const clientDayStart = toDate(`${dateStr}T00:00:00`, { timeZone: clientTimeZone });
  const clientDayEnd = toDate(`${dateStr}T23:59:59`, { timeZone: clientTimeZone });

  // 2. Fetch all bookings that might overlap this day
  // Since we store dates as YYYY-MM-DD in UTC (roughly), we fetch a wide range
  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: 'CANCELLED' },
      date: {
        gte: format(addHours(clientDayStart, -24), 'yyyy-MM-dd'),
        lte: format(addHours(clientDayEnd, 24), 'yyyy-MM-dd'),
      }
    },
    select: { startTime: true, endTime: true, date: true }
  });

  const slots: TimeSlot[] = [];
  
  // 3. Generate potential slots (every 30 mins) in the client's day
  for (let m = 0; m < 1440; m += 30) {
    const slotStartClient = addMinutes(clientDayStart, m);
    const slotEndClient = addMinutes(slotStartClient, duration);

    if (slotEndClient > clientDayEnd) break;

    // 4. Convert slot to Admin Timezone to check working hours
    const slotStartAdmin = toZonedTime(slotStartClient, ADMIN_TZ);
    const adminHour = slotStartAdmin.getHours();
    const adminMinute = slotStartAdmin.getMinutes();

    const isAdminWorking = adminHour >= WORKING_START && (adminHour < WORKING_END || (adminHour === WORKING_END && adminMinute === 0));
    
    // Check if the entire duration fits in working hours
    const slotEndAdmin = addMinutes(slotStartAdmin, duration);
    const endAdminHour = slotEndAdmin.getHours();
    const endAdminMinute = slotEndAdmin.getMinutes();
    const isEndInWorking = endAdminHour < WORKING_END || (endAdminHour === WORKING_END && endAdminMinute === 0);

    if (!isAdminWorking || !isEndInWorking) continue;

    // 5. Check overlaps with existing bookings

    const isBlocked = bookings.some(b => {
      const bStart = toDate(`${b.date}T${b.startTime}:00`, { timeZone: 'UTC' });
      const bEnd = toDate(`${b.date}T${b.endTime}:00`, { timeZone: 'UTC' });
      
      const bStartWithBuffer = addMinutes(bStart, -BUFFER);
      const bEndWithBuffer = addMinutes(bEnd, BUFFER);

      return (slotStartClient < bEndWithBuffer && slotEndClient > bStartWithBuffer);
    });

    slots.push({
      time: format(slotStartClient, 'HH:mm'),
      available: !isBlocked
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

export function formatDate(dateStr: string, timeZone: string = 'UTC'): string {
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
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return false;
  return true;
}
