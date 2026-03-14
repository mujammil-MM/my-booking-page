import { Resend } from 'resend';

const resend = new Resend('re_PsH1uH9b_N5PXrR9kUPtWj6Pzz9dYrbaX');

async function sendTest() {
  console.log('Attempting to send test email to nova.rosehearts@gmail.com...');
  try {
    const { data, error } = await resend.emails.send({
      from: 'Booking <onboarding@resend.dev>',
      to: 'nova.rosehearts@gmail.com',
      subject: 'Test email',
      html: '<p>This is a test from the booking system.</p>',
    });

    if (error) {
      console.error('Resend Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('Test email sent successfully!', data);
    }
  } catch (err) {
    console.error('Caught error during send:', err);
  }
}

sendTest();
