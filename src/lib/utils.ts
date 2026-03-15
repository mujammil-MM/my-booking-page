import { toDate, formatInTimeZone } from 'date-fns-tz';

export function formatTime12h(time24: string, dateStr?: string, timeZone: string = 'UTC'): string {
  if (!time24) return '';
  if (dateStr) {
    const d = toDate(`${dateStr}T${time24}:00`, { timeZone: 'UTC' });
    return formatInTimeZone(d, timeZone, 'hh:mm a');
  }
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatDate(dateStr: string, timeZone: string = 'UTC'): string {
  if (!dateStr) return '';
  const d = toDate(`${dateStr}T00:00:00`, { timeZone: 'UTC' });
  return formatInTimeZone(d, timeZone, 'EEEE, MMMM d, yyyy');
}
