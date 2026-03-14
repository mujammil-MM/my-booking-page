import twilio from 'twilio';
import { formatTime12h, formatDate } from './availability';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const adminPhoneNumber = '+91819163691';

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function sendAdminSMS(booking: {
  clientName: string;
  date: string;
  startTime: string;
}) {
  const formattedDate = formatDate(booking.date);
  const formattedTime = formatTime12h(booking.startTime);
  const message = `New call booked by ${booking.clientName} on ${formattedDate} at ${formattedTime}`;

  if (client && twilioPhoneNumber) {
    try {
      await client.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: adminPhoneNumber,
      });
    } catch (error) {
      console.error('Twilio SMS error:', error);
    }
  } else {
    console.log('📱 [SMS DEV MODE]');
    console.log(`  To:      ${adminPhoneNumber}`);
    console.log(`  Message: ${message}`);
  }
}
