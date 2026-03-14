// Google Calendar integration (optional)
// Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in .env

import { google } from 'googleapis';

function getAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export async function createCalendarEvent(booking: {
  clientName: string;
  email: string;
  date: string;
  startTime: string;
  endTime: string;
  discussionTopic: string;
  callType: string;
}): Promise<{ meetingLink: string; eventId: string } | null> {
  const auth = getAuth();
  if (!auth) {
    console.log('📅 [CALENDAR DEV MODE] Would create event for', booking.clientName, 'on', booking.date);
    // Generate a mock meeting link for dev
    const mockLink = `https://meet.google.com/mock-${Date.now().toString(36)}`;
    return { meetingLink: mockLink, eventId: `mock-${Date.now()}` };
  }

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  const startDateTime = `${booking.date}T${booking.startTime}:00`;
  const endDateTime = `${booking.date}T${booking.endTime}:00`;

  const callLabel =
    booking.callType === 'INTRO_15'
      ? '15 Min Intro Call'
      : booking.callType === 'CONSULT_30'
      ? '30 Min Consultation'
      : '60 Min Strategy Session';

  try {
    const event = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      requestBody: {
        summary: `${callLabel} with ${booking.clientName}`,
        description: `Discussion: ${booking.discussionTopic}\nEmail: ${booking.email}`,
        start: { dateTime: startDateTime, timeZone: 'UTC' },
        end: { dateTime: endDateTime, timeZone: 'UTC' },
        attendees: [{ email: booking.email }],
        conferenceData: {
          createRequest: {
            requestId: `booking-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 10 },
            { method: 'email', minutes: 60 },
          ],
        },
      },
    });

    const meetingLink = event.data.conferenceData?.entryPoints?.[0]?.uri || '';
    const eventId = event.data.id || '';

    return { meetingLink, eventId };
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  const auth = getAuth();
  if (!auth || eventId.startsWith('mock-')) {
    console.log('📅 [CALENDAR DEV MODE] Would delete event', eventId);
    return true;
  }

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  try {
    await calendar.events.delete({ calendarId, eventId });
    return true;
  } catch (error) {
    console.error('Failed to delete calendar event:', error);
    return false;
  }
}

export async function updateCalendarEvent(
  eventId: string,
  booking: { date: string; startTime: string; endTime: string; clientName: string }
): Promise<boolean> {
  const auth = getAuth();
  if (!auth || eventId.startsWith('mock-')) {
    console.log('📅 [CALENDAR DEV MODE] Would update event', eventId);
    return true;
  }

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  try {
    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        start: { dateTime: `${booking.date}T${booking.startTime}:00`, timeZone: 'UTC' },
        end: { dateTime: `${booking.date}T${booking.endTime}:00`, timeZone: 'UTC' },
      },
    });
    return true;
  } catch (error) {
    console.error('Failed to update calendar event:', error);
    return false;
  }
}
