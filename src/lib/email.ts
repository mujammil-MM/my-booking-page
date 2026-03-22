import nodemailer from 'nodemailer';
import { toDate, formatInTimeZone } from 'date-fns-tz';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
const smtpSecure = process.env.SMTP_SECURE === 'true';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || 'Booking System <onboarding@resend.dev>';

const transporter = smtpHost && smtpUser && smtpPass
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null;

async function sendMail(
  to: string,
  subject: string,
  html: string,
  retries = 2
): Promise<void> {
  if (!transporter) {
    throw new Error('SMTP transporter is not configured');
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        html,
      });

      console.log('Email sent via SMTP:', info.messageId);
      return;
    } catch (error) {
      if (attempt < retries) {
        console.warn(`Email attempt ${attempt + 1} failed, retrying in 1s...`, error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('Email failed after all retries:', error);
        throw error;
      }
    }
  }
}

function bookingCallLabel(callType: string): string {
  return callType === 'INTRO_15'
    ? '15 Min Intro Call'
    : callType === 'CONSULT_30'
      ? '30 Min Consultation'
      : '60 Min Strategy Session';
}

function detailRow(label: string, value?: string) {
  return value
    ? `<p style="margin:4px 0;font-size:14px;color:#a1a1aa;">${label}: <strong style="color:#fafafa;">${value}</strong></p>`
    : '';
}

export async function sendConfirmationEmail(booking: {
  id: string;
  clientName: string;
  email: string;
  phone?: string;
  company?: string;
  date: string;
  startTime: string;
  endTime: string;
  callType: string;
  meetingLink: string;
  timeZone: string;
  discussion?: string;
  problem?: string;
  budget?: string;
  timeline?: string;
  priorAgency?: string;
}) {
  const utcDate = toDate(`${booking.date}T${booking.startTime}:00Z`);
  const utcEnd = toDate(`${booking.date}T${booking.endTime}:00Z`);
  const clientTz = booking.timeZone || 'UTC';
  const formattedDate = formatInTimeZone(utcDate, clientTz, 'EEEE, MMMM d, yyyy');
  const formattedStart = formatInTimeZone(utcDate, clientTz, 'hh:mm a');
  const formattedEnd = formatInTimeZone(utcEnd, clientTz, 'hh:mm a');
  const callLabel = bookingCallLabel(booking.callType);

  const html = `
    <div style="font-family:'Inter',-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#fafafa;border:1px solid #27272a;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
        <h1 style="margin:0;font-size:20px;color:#fff;">Booking Confirmed</h1>
        <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Your call has been successfully scheduled.</p>
      </div>
      <div style="padding:32px;">
        <p style="margin-top:0;font-size:16px;">Hello <strong>${booking.clientName}</strong>,</p>

        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Call Details</p>
          ${detailRow('Call Type', callLabel)}
          ${detailRow('Date', formattedDate)}
          ${detailRow('Time', `${formattedStart} - ${formattedEnd}`)}
          ${detailRow('Timezone', clientTz)}
        </div>

        ${booking.phone || booking.company || booking.discussion ? `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Your Info</p>
          ${detailRow('Email', booking.email)}
          ${detailRow('Phone', booking.phone)}
          ${detailRow('Company', booking.company)}
          ${detailRow('Discussion Topic', booking.discussion)}
        </div>` : ''}

        ${booking.problem || booking.budget || booking.timeline ? `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Your Responses</p>
          ${detailRow('Problem', booking.problem)}
          ${detailRow('Budget', booking.budget)}
          ${detailRow('Timeline', booking.timeline)}
          ${detailRow('Prior Agency Experience', booking.priorAgency)}
        </div>` : ''}

        <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:8px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;">Meeting Link</p>
          ${booking.meetingLink
            ? `<a href="${booking.meetingLink}" style="color:#6366f1;text-decoration:none;word-break:break-all;font-size:14px;">${booking.meetingLink}</a>`
            : `<p style="margin:0;font-size:14px;color:#a1a1aa;font-style:italic;">Meeting link will be sent shortly.</p>`
          }
        </div>

        <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin-bottom:24px;">
          Need to reschedule or cancel? Reply to this email or visit our booking page.
        </p>
        <p style="margin-bottom:0;font-size:16px;font-weight:500;">Looking forward to speaking with you.</p>
      </div>
      <div style="background:#18181b;padding:16px;text-align:center;border-top:1px solid #27272a;">
        <p style="margin:0;font-size:12px;color:#71717a;">Booking Confirmation - ${new Date().getFullYear()}</p>
      </div>
    </div>
  `;

  await sendMail(booking.email, `Booking Confirmed: ${formattedDate} at ${formattedStart}`, html);
}

export async function sendReminderEmail(
  booking: {
    id: string;
    clientName: string;
    email: string;
    date: string;
    startTime: string;
    meetingLink: string;
    callType: string;
    timeZone: string;
  },
  timeLabel: string
) {
  const utcDate = toDate(`${booking.date}T${booking.startTime}:00Z`);
  const clientTz = booking.timeZone || 'UTC';
  const formattedDate = formatInTimeZone(utcDate, clientTz, 'MMMM d, yyyy');
  const formattedTime = formatInTimeZone(utcDate, clientTz, 'hh:mm a');

  const html = `
    <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#e4e4e7;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f59e0b,#f97316);padding:32px;text-align:center;">
        <h1 style="margin:0;font-size:20px;color:#fff;">Reminder: Call in ${timeLabel}</h1>
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
  const utcDate = toDate(`${booking.date}T${booking.startTime}:00Z`);
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
  const adminTz = process.env.ADMIN_TZ || 'Asia/Kolkata';
  const utcDate = toDate(`${booking.date}T${booking.startTime}:00Z`);
  const utcEnd = toDate(`${booking.date}T${booking.endTime}:00Z`);
  const formattedDate = formatInTimeZone(utcDate, adminTz, 'EEEE, MMMM d, yyyy');
  const formattedStart = formatInTimeZone(utcDate, adminTz, 'hh:mm a');
  const formattedEnd = formatInTimeZone(utcEnd, adminTz, 'hh:mm a');
  const callLabel = bookingCallLabel(booking.callType);

  const row = (label: string, value?: string) =>
    `<p style="margin:4px 0;"><strong>${label}:</strong> ${value || 'Not provided'}</p>`;

  const html = `
    <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;color:#0f172a;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
      <h2 style="margin-top:0;color:#334155;border-bottom:2px solid #e2e8f0;padding-bottom:12px;">New Booking Received</h2>

      <h3 style="color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:24px;">Client Details</h3>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        ${row('Name', booking.clientName)}
        <p style="margin:4px 0;"><strong>Email:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
        ${row('Phone', booking.phone)}
        ${row('Company / Project', booking.company || 'Not provided')}
        ${row('Client Timezone', booking.timeZone || 'Unknown')}
      </div>

      <h3 style="color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:24px;">Call Information (${adminTz})</h3>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        ${row('Call Type', callLabel)}
        ${row('Date', formattedDate)}
        ${row('Time', `${formattedStart} - ${formattedEnd} (${adminTz})`)}
      </div>

      <h3 style="color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:24px;">Lead Qualification</h3>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        ${row('Discussion Topic', booking.discussion)}
        ${row('Problem', booking.problem)}
        ${row('Budget', booking.budget)}
        ${row('Timeline', booking.timeline)}
        ${row('Prior Agency Experience', booking.priorAgency)}
      </div>

      <div style="margin-top:24px;background:#f1f5f9;padding:16px;border-radius:8px;text-align:center;">
        <p style="margin:0 0 8px;font-weight:600;color:#334155;">Meeting Link:</p>
        ${booking.meetingLink
          ? `<a href="${booking.meetingLink}" style="color:#6366f1;text-decoration:none;word-break:break-all;font-size:14px;">${booking.meetingLink}</a>`
          : `<p style="margin:0;font-size:14px;color:#64748b;font-style:italic;">Meeting link will be generated shortly.</p>`
        }
      </div>
    </div>
  `;

  await sendMail(adminEmail, 'New Booking Received', html);
}
