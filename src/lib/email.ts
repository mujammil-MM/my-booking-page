import nodemailer from 'nodemailer';
import { formatTime12h, formatDate } from './availability';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail(to: string, subject: string, html: string) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Book a Call" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log('Message sent: %s', info.messageId);
  } catch (error) {
    console.error('SMTP error:', error);
  }
}

export async function sendConfirmationEmail(booking: {
  id: string;
  clientName: string;
  email: string;
  date: string;
  startTime: string;
  endTime: string;
  callType: string;
  meetingLink: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const formattedDate = formatDate(booking.date);
  const formattedStart = formatTime12h(booking.startTime);
  const formattedEnd = formatTime12h(booking.endTime);

  const callLabel =
    booking.callType === 'INTRO_15'
      ? '15 Min Intro Call'
      : booking.callType === 'CONSULT_30'
      ? '30 Min Consultation'
      : '60 Min Strategy Session';

  const html = `
    <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#e4e4e7;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 32px;text-align:center;">
        <h1 style="margin:0;font-size:24px;color:#fff;">Booking Confirmed ✓</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your call has been scheduled</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#a1a1aa;margin:0 0 24px;">Hi <strong style="color:#e4e4e7;">${booking.clientName}</strong>,</p>
        
        <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#71717a;font-size:13px;">Call Type</td><td style="padding:8px 0;text-align:right;color:#e4e4e7;font-size:14px;">${callLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#71717a;font-size:13px;">Date</td><td style="padding:8px 0;text-align:right;color:#e4e4e7;font-size:14px;">${formattedDate}</td></tr>
            <tr><td style="padding:8px 0;color:#71717a;font-size:13px;">Time</td><td style="padding:8px 0;text-align:right;color:#e4e4e7;font-size:14px;">${formattedStart} – ${formattedEnd}</td></tr>
          </table>
        </div>
        
        ${booking.meetingLink ? `
        <a href="${booking.meetingLink}" style="display:block;text-align:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:600;font-size:14px;margin-bottom:16px;">
          Join Meeting
        </a>` : ''}
        
        <div style="display:flex;gap:12px;margin-top:16px;">
          <a href="${appUrl}/reschedule/${booking.id}" style="flex:1;display:block;text-align:center;border:1px solid #27272a;color:#a1a1aa;text-decoration:none;padding:10px;border-radius:8px;font-size:13px;">Reschedule</a>
          <a href="${appUrl}/cancel/${booking.id}" style="flex:1;display:block;text-align:center;border:1px solid #27272a;color:#a1a1aa;text-decoration:none;padding:10px;border-radius:8px;font-size:13px;">Cancel</a>
        </div>
        
        <a href="${appUrl}/api/ics/${booking.id}" style="display:block;text-align:center;color:#6366f1;text-decoration:none;padding:12px;font-size:13px;margin-top:8px;">📅 Add to Calendar</a>
      </div>
      <div style="padding:16px 32px;background:#18181b;text-align:center;color:#52525b;font-size:12px;">
        Need help? Reply to this email or contact us at ${process.env.ADMIN_EMAIL || 'support@example.com'}
      </div>
    </div>
  `;

  await sendMail(booking.email, `Booking Confirmed: ${callLabel} on ${formattedDate}`, html);
}

export async function sendReminderEmail(booking: {
  id: string;
  clientName: string;
  email: string;
  date: string;
  startTime: string;
  meetingLink: string;
  callType: string;
}, timeLabel: string) {
  const formattedDate = formatDate(booking.date);
  const formattedTime = formatTime12h(booking.startTime);

  const html = `
    <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#e4e4e7;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f59e0b,#f97316);padding:32px;text-align:center;">
        <h1 style="margin:0;font-size:20px;color:#fff;">⏰ Reminder: Call in ${timeLabel}</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#a1a1aa;">Hi <strong style="color:#e4e4e7;">${booking.clientName}</strong>, your call is coming up:</p>
        <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin:16px 0;">
          <p style="margin:0;color:#e4e4e7;"><strong>${formattedDate}</strong> at <strong>${formattedTime}</strong></p>
        </div>
        ${booking.meetingLink ? `<a href="${booking.meetingLink}" style="display:block;text-align:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px;border-radius:10px;font-weight:600;">Join Meeting</a>` : ''}
      </div>
    </div>
  `;

  await sendMail(booking.email, `Reminder: Your call is in ${timeLabel}`, html);
}

export async function sendCancellationEmail(booking: {
  clientName: string;
  email: string;
  date: string;
  startTime: string;
}) {
  const formattedDate = formatDate(booking.date);
  const formattedTime = formatTime12h(booking.startTime);

  const html = `
    <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#e4e4e7;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px;text-align:center;">
        <h1 style="margin:0;font-size:20px;color:#fff;">Booking Cancelled</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#a1a1aa;">Hi <strong style="color:#e4e4e7;">${booking.clientName}</strong>,</p>
        <p style="color:#a1a1aa;">Your call on <strong style="color:#e4e4e7;">${formattedDate}</strong> at <strong style="color:#e4e4e7;">${formattedTime}</strong> has been cancelled.</p>
        <p style="color:#a1a1aa;">If you'd like to rebook, visit our <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" style="color:#6366f1;">booking page</a>.</p>
      </div>
    </div>
  `;

  await sendMail(booking.email, `Booking Cancelled: ${formattedDate}`, html);
}

export async function sendAdminNotificationEmail(booking: {
  clientName: string;
  email: string;
  phone: string;
  company: string;
  callType: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingLink: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL || 'nova.rosehearts@gmail.com';
  const formattedDate = formatDate(booking.date);
  const formattedStart = formatTime12h(booking.startTime);
  const formattedEnd = formatTime12h(booking.endTime);

  const callLabel =
    booking.callType === 'INTRO_15'
      ? '15 Min Intro Call'
      : booking.callType === 'CONSULT_30'
      ? '30 Min Consultation'
      : '60 Min Strategy Session';

  const html = `
    <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;color:#0f172a;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
      <h2 style="margin-top:0;color:#334155;">New Booking Received</h2>
      <p>A new call has been booked. Here are the details:</p>
      
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:4px 0;"><strong>Client Name:</strong> ${booking.clientName}</p>
        <p style="margin:4px 0;"><strong>Email:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
        <p style="margin:4px 0;"><strong>Phone:</strong> ${booking.phone}</p>
        <p style="margin:4px 0;"><strong>Company:</strong> ${booking.company || 'N/A'}</p>
        <p style="margin:4px 0;"><strong>Call Type:</strong> ${callLabel}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> ${formattedDate}</p>
        <p style="margin:4px 0;"><strong>Time:</strong> ${formattedStart} – ${formattedEnd}</p>
      </div>

      ${booking.meetingLink ? `
      <p style="margin-top:16px;">
        <strong>Meeting Link:</strong> <a href="${booking.meetingLink}">${booking.meetingLink}</a>
      </p>
      ` : ''}
    </div>
  `;

  await sendMail(adminEmail, `New call booked`, html);
}

