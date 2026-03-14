'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BookingResponse } from '@/lib/types';

import { formatTime12h, formatDate } from '@/lib/utils';


export default function CancelPage() {
  const params = useParams();
  const id = params.id as string;
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelled, setCancelled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/bookings/${id}`)
      .then(r => r.json())
      .then(data => { setBooking(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleCancel() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCancelled(true);
      }
    } catch {
      alert('Failed to cancel. Please try again.');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header"><h1>Loading...</h1></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Booking Not Found</h1>
        </div>
      </div>
    );
  }

  if (cancelled || booking.status === 'CANCELLED') {
    return (
      <div className="page-container">
        <header className="page-header">
          <div className="confirmation-icon" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)' }}>
            ✕
          </div>
          <h1>Booking Cancelled</h1>
          <p>Your booking has been cancelled. We hope to hear from you again!</p>
        </header>
        <div style={{ textAlign: 'center' }}>
          <a href="/" className="btn btn-primary">← Book a New Call</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Cancel Booking?</h1>
        <p>Are you sure you want to cancel your booking?</p>
      </header>

      <div className="confirmation-container">
        <div className="confirmation-details">
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
        </div>

        <div className="confirmation-actions" style={{ justifyContent: 'center' }}>
          <a href={`/confirmation/${id}`} className="btn btn-secondary">← Keep Booking</a>
          <button
            className="btn btn-danger"
            onClick={handleCancel}
            disabled={submitting}
          >
            {submitting ? (
              <><span className="spinner" /> Cancelling...</>
            ) : (
              'Yes, Cancel Booking'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
