import nodemailer from 'nodemailer';
import { toDate, formatInTimeZone } from 'date-fns-tz';

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
      from: process.env.SMTP_FROM || '"Booking System" <nova.rosehearts@gmail.com>',
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
  timeZone: string;
}) {
  // booking.date and booking.startTime are in UTC
  const utcDate = toDate(`${booking.date}T${booking.startTime}:00`, { timeZone: 'UTC' });
  const utcEnd = toDate(`${booking.date}T${booking.endTime}:00`, { timeZone: 'UTC' });
  
  const clientTz = booking.timeZone || 'UTC';
  const formattedDate = formatInTimeZone(utcDate, clientTz, 'EEEE, MMMM d, yyyy');
  const formattedStart = formatInTimeZone(utcDate, clientTz, 'hh:mm a');
  const formattedEnd = formatInTimeZone(utcEnd, clientTz, 'hh:mm a');

  const html = `
    <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fafafa; border: 1px solid #27272a; border-radius: 12px; overflow: hidden;">
      <div style="padding: 32px;">
        <p style="margin-top: 0; font-size: 16px;">Hello ${booking.clientName},</p>
        <p style="font-size: 16px; line-height: 1.6;">Your call has been successfully scheduled.</p>
        
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #a1a1aa;">Date: <strong style="color: #fafafa;">${formattedDate}</strong></p>
          <p style="margin: 8px 0 0; font-size: 14px; color: #a1a1aa;">Time: <strong style="color: #fafafa;">${formattedStart} – ${formattedEnd}</strong></p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #71717a;">Timezone: ${clientTz}</p>
        </div>

        <p style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">Meeting Link:</p>
        <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          ${booking.meetingLink ? `
            <p style="margin: 0 0 8px; font-size: 14px; color: #a1a1aa;">Click here to join your call:</p>
            <a href="${booking.meetingLink}" style="color: #6366f1; text-decoration: none; word-break: break-all; font-size: 14px; font-weight: 500;">
              ${booking.meetingLink}
            </a>
          ` : `
            <p style="margin: 0; font-size: 14px; color: #a1a1aa; font-style: italic;">
              Meeting link will be generated shortly.
            </p>
          `}
        </div>

        <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          If you need to reschedule or cancel, please contact us.
        </p>

        <p style="margin-bottom: 0; font-size: 16px; font-weight: 500;">Thank you.</p>
      </div>
      <div style="background: #18181b; padding: 16px; text-align: center; border-top: 1px solid #27272a;">
        <p style="margin: 0; font-size: 12px; color: #71717a;">Booking System</p>
      </div>
    </div>
  `;

  await sendMail(booking.email, 'Your call has been booked', html);
}

export async function sendReminderEmail(booking: {
  id: string;
  clientName: string;
  email: string;
  date: string;
  startTime: string;
  meetingLink: string;
  callType: string;
  timeZone: string;
}, timeLabel: string) {
  const utcDate = toDate(`${booking.date}T${booking.startTime}:00`, { timeZone: 'UTC' });
  const clientTz = booking.timeZone || 'UTC';
  const formattedDate = formatInTimeZone(utcDate, clientTz, 'MMMM d, yyyy');
  const formattedTime = formatInTimeZone(utcDate, clientTz, 'hh:mm a');

  const html = `
    <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#e4e4e7;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f59e0b,#f97316);padding:32px;text-align:center;">
        <h1 style="margin:0;font-size:20px;color:#fff;">⏰ Reminder: Call in ${timeLabel}</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#a1a1aa;">Hi <strong style="color:#e4e4e7;">${booking.clientName}</strong>, your call is coming up:</p>
        <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin:16px 0;">
          <p style="margin:0;color:#e4e4e7;"><strong>${formattedDate}</strong> at <strong>${formattedTime}</strong> (${clientTz})</p>
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
  timeZone: string;
}) {
  const utcDate = toDate(`${booking.date}T${booking.startTime}:00`, { timeZone: 'UTC' });
  const clientTz = booking.timeZone || 'UTC';
  const formattedDate = formatInTimeZone(utcDate, clientTz, 'MMMM d, yyyy');
  const formattedTime = formatInTimeZone(utcDate, clientTz, 'hh:mm a');

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
  timeZone: string;
  discussion?: string;
  problem?: string;
  budget?: string;
  timeline?: string;
  priorAgency?: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL || 'nova.rosehearts@gmail.com';
  const ADMIN_TZ = process.env.ADMIN_TZ || 'Asia/Kolkata';
  
  const utcDate = toDate(`${booking.date}T${booking.startTime}:00`, { timeZone: 'UTC' });
  const utcEnd = toDate(`${booking.date}T${booking.endTime}:00`, { timeZone: 'UTC' });
  
  const formattedDate = formatInTimeZone(utcDate, ADMIN_TZ, 'EEEE, MMMM d, yyyy');
  const formattedStart = formatInTimeZone(utcDate, ADMIN_TZ, 'hh:mm a');
  const formattedEnd = formatInTimeZone(utcEnd, ADMIN_TZ, 'hh:mm a');

  const callLabel =
    booking.callType === 'INTRO_15'
      ? '15 Min Intro Call'
      : booking.callType === 'CONSULT_30'
      ? '30 Min Consultation'
      : '60 Min Strategy Session';

  const html = `
    <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;color:#0f172a;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
      <h2 style="margin-top:0;color:#334155;border-bottom:2px solid #e2e8f0;padding-bottom:12px;">New Booking Received</h2>
      
      <h3 style="color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:24px;">Client Details</h3>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="margin:4px 0;"><strong>Client Name:</strong> ${booking.clientName}</p>
        <p style="margin:4px 0;"><strong>Email:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
        <p style="margin:4px 0;"><strong>Phone:</strong> ${booking.phone}</p>
        <p style="margin:4px 0;"><strong>Company / Project:</strong> ${booking.company || 'Not provided'}</p>
        <p style="margin:4px 0;"><strong>Timezone:</strong> ${booking.timeZone || 'Unknown timezone'}</p>
      </div>

      <h3 style="color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:24px;">Call Information (Your Time)</h3>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="margin:4px 0;"><strong>Call Type:</strong> ${callLabel}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> ${formattedDate}</p>
        <p style="margin:4px 0;"><strong>Time:</strong> ${formattedStart} – ${formattedEnd} (${ADMIN_TZ})</p>
      </div>

      <h3 style="color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:24px;">Lead Qualification</h3>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="margin:4px 0;"><strong>Discussion:</strong><br/>${booking.discussion || 'Not provided'}</p>
        <p style="margin:12px 0 4px;"><strong>Problem:</strong><br/>${booking.problem || 'Not provided'}</p>
        <p style="margin:12px 0 4px;"><strong>Budget:</strong><br/>${booking.budget || 'Not provided'}</p>
        <p style="margin:12px 0 4px;"><strong>Timeline:</strong><br/>${booking.timeline || 'Not provided'}</p>
        <p style="margin:12px 0 4px;"><strong>Prior Agency Experience:</strong><br/>${booking.priorAgency || 'Not provided'}</p>
      </div>

      <div style="margin-top:24px;background:#f1f5f9;padding:16px;border-radius:8px;text-align:center;">
        <p style="margin:0 0 8px;font-weight:600;color:#334155;">Meeting Link:</p>
        ${booking.meetingLink ? `
          <a href="${booking.meetingLink}" style="color:#6366f1;text-decoration:none;word-break:break-all;font-size:14px;">${booking.meetingLink}</a>
        ` : `
          <p style="margin:0;font-size:14px;color:#64748b;font-style:italic;">Meeting link will be generated shortly.</p>
        `}
      </div>
    </div>
  `;

  await sendMail(adminEmail, 'New Booking Received', html);
}

