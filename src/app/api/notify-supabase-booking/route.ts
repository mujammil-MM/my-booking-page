import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize the explicitly requested API key for this route
const resend = new Resend('re_PsH1uH9b_N5PXrR9kUPtWj6Pzz9dYrbaX');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, company, call_type, date, time, meeting_link } = body;

    if (!name || !email || !date || !time) {
      return NextResponse.json({ error: 'Missing required booking details for notification' }, { status: 400 });
    }

    const callLabel =
      call_type === 'INTRO_15'
        ? '15 Min Intro Call'
        : call_type === 'CONSULT_30'
        ? '30 Min Consultation'
        : '60 Min Strategy Session';

    const html = `
      <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;color:#0f172a;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
        <h2 style="margin-top:0;color:#334155;">Supabase Booking Logged</h2>
        <p>A new call was successfully inserted into the Supabase database. Here are the details:</p>
        
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:4px 0;"><strong>Client Name:</strong> ${name}</p>
          <p style="margin:4px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p style="margin:4px 0;"><strong>Phone:</strong> ${phone || 'N/A'}</p>
          <p style="margin:4px 0;"><strong>Company:</strong> ${company || 'N/A'}</p>
          <p style="margin:4px 0;"><strong>Call Type:</strong> ${callLabel}</p>
          <p style="margin:4px 0;"><strong>Date:</strong> ${date}</p>
          <p style="margin:4px 0;"><strong>Time:</strong> ${time}</p>
        </div>

        ${meeting_link ? `
        <p style="margin-top:16px;">
          <strong>Meeting Link:</strong> <a href="${meeting_link}">${meeting_link}</a>
        </p>
        ` : ''}
      </div>
    `;

    // The user requested sending this notification to their admin email address
    const adminEmail = process.env.ADMIN_EMAIL || 'nova.rosehearts@gmail.com';

    await resend.emails.send({
      from: `"Supabase Notification" <onboarding@resend.dev>`,
      to: adminEmail,
      subject: `New Supabase Booking: ${name} - ${callLabel}`,
      html,
    });

    return NextResponse.json({ success: true, message: 'Notification sent successfully' }, { status: 200 });
  } catch (error) {
    console.error('Failed to send Supabase/Resend notification:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
