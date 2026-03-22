import { hasSupabaseAdmin, supabaseAdmin } from './supabaseShared';

interface SupabaseBookingMirrorInput {
  clientName: string;
  email: string;
  phone: string;
  company?: string;
  callType: string;
  date: string;
  startTime: string;
  meetingLink?: string;
  discussion?: string;
  problem?: string;
  budget?: string;
  timeline?: string;
  priorAgency?: string;
  clientTimeZone?: string;
}

export async function mirrorBookingToSupabase(booking: SupabaseBookingMirrorInput) {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    console.warn('Supabase mirror skipped: SUPABASE_SERVICE_ROLE_KEY is missing.');
    return;
  }

  const { error } = await supabaseAdmin.from('bookings').insert({
    name: booking.clientName,
    email: booking.email,
    phone: booking.phone,
    company: booking.company || '',
    call_type: booking.callType,
    date: booking.date,
    time: `${booking.startTime}:00`,
    meeting_link: booking.meetingLink || '',
    created_at: new Date().toISOString(),
    discussion: booking.discussion || '',
    problem: booking.problem || '',
    budget: booking.budget || '',
    timeline: booking.timeline || '',
    prior_agency: booking.priorAgency || '',
    client_timezone: booking.clientTimeZone || null,
  });

  if (error) {
    throw error;
  }
}
