export function generateICS(booking: {
  id: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingLink: string;
  callType: string;
  discussionTopic: string;
}): string {
  const callLabel =
    booking.callType === 'INTRO_15'
      ? '15 Min Intro Call'
      : booking.callType === 'CONSULT_30'
      ? '30 Min Consultation'
      : '60 Min Strategy Session';

  const dtStart = `${booking.date.replace(/-/g, '')}T${booking.startTime.replace(':', '')}00`;
  const dtEnd = `${booking.date.replace(/-/g, '')}T${booking.endTime.replace(':', '')}00`;
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BookACall//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `DTSTAMP:${now}`,
    `UID:${booking.id}@bookacall`,
    `SUMMARY:${callLabel} with ${booking.clientName}`,
    `DESCRIPTION:${booking.discussionTopic}\\nMeeting Link: ${booking.meetingLink}`,
    `URL:${booking.meetingLink}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Your call starts in 10 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
