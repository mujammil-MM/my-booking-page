'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BookingResponse } from '@/lib/types';

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function callLabel(type: string): string {
  return type === 'INTRO_15' ? '15 Min Intro Call'
    : type === 'CONSULT_30' ? '30 Min Consultation'
    : '60 Min Strategy Session';
}

export default function ConfirmationPage() {
  const params = useParams();
  const id = params.id as string;
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/bookings/${id}`)
      .then(r => r.json())
      .then(data => { setBooking(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Loading...</h1>
        </div>
        <div className="confirmation-container">
          <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Booking Not Found</h1>
          <p>This booking does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="confirmation-icon">✓</div>
        <h1>Booking Confirmed!</h1>
        <p>Your call has been scheduled. You&apos;ll receive a confirmation email shortly.</p>
      </header>

      <div className="confirmation-container">
        <div className="confirmation-details">
          <div className="detail-row">
            <span className="label">Call Type</span>
            <span className="value">{callLabel(booking.callType)}</span>
          </div>
          <div className="detail-row">
            <span className="label">Date</span>
            <span className="value">{formatDate(booking.date)}</span>
          </div>
          <div className="detail-row">
            <span className="label">Time</span>
            <span className="value">{formatTime12h(booking.startTime)} – {formatTime12h(booking.endTime)}</span>
          </div>
          <div className="detail-row">
            <span className="label">Name</span>
            <span className="value">{booking.clientName}</span>
          </div>
          <div className="detail-row">
            <span className="label">Email</span>
            <span className="value">{booking.email}</span>
          </div>
          {booking.company && (
            <div className="detail-row">
              <span className="label">Company</span>
              <span className="value">{booking.company}</span>
            </div>
          )}
        </div>

        {booking.meetingLink && (
          <div className="meeting-link-box">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Meeting Link</p>
            <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer">
              {booking.meetingLink}
            </a>
          </div>
        )}

        <div className="confirmation-actions">
          <a href={`/api/ics/${booking.id}`} className="btn btn-secondary" download>
            📅 Add to Calendar
          </a>
          <a href={`/reschedule/${booking.id}`} className="btn btn-secondary">
            🔄 Reschedule
          </a>
          <a href={`/cancel/${booking.id}`} className="btn btn-secondary">
            ✕ Cancel
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <a href="/" className="btn btn-primary">← Book Another Call</a>
        </div>
      </div>
    </div>
  );
}
