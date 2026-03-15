'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import CalendarPicker from '@/components/CalendarPicker';
import TimeSlotGrid from '@/components/TimeSlotGrid';
import { BookingResponse, TimeSlot, CallType } from '@/lib/types';

import { toDate, formatInTimeZone } from 'date-fns-tz';

function formatTime12h(time24: string, dateStr: string, timeZone: string): string {
  const d = toDate(`${dateStr}T${time24}:00`, { timeZone: 'UTC' });
  return formatInTimeZone(d, timeZone, 'hh:mm a');
}

function formatDate(dateStr: string, timeZone: string): string {
  const d = toDate(`${dateStr}T00:00:00`, { timeZone: 'UTC' });
  return formatInTimeZone(d, timeZone, 'EEEE, MMMM d, yyyy');
}

export default function ReschedulePage() {
  const params = useParams();
  const id = params.id as string;
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata');

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) setTimeZone(tz);

    fetch(`/api/bookings/${id}`)
      .then(r => r.json())
      .then(data => { setBooking(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const fetchSlots = useCallback(async (date: string, callType: CallType, tz: string) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/availability?date=${date}&callType=${callType}&timezone=${tz}`);
      const data = await res.json();
      setTimeSlots(data.slots || []);
    } catch {
      setTimeSlots([]);
    }
    setLoadingSlots(false);
  }, []);

  useEffect(() => {
    if (selectedDate && booking) {
      fetchSlots(selectedDate, booking.callType as CallType, timeZone);
      setSelectedTime(null);
    }
  }, [selectedDate, booking, timeZone, fetchSlots]);

  async function handleReschedule() {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date: selectedDate, 
          startTime: selectedTime,
          timeZone: timeZone // Ensure server knows original client context
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to reschedule');
        setSubmitting(false);
        return;
      }

      window.location.href = `/confirmation/${id}`;
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
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
          <p>This booking does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  if (booking.rescheduleCount >= 2) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Cannot Reschedule</h1>
          <p>You have reached the maximum number of reschedules (2). Please cancel and create a new booking.</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <a href={`/cancel/${id}`} className="btn btn-secondary">Cancel Booking</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="badge">🔄 Reschedule</div>
        <h1>Reschedule Your Call</h1>
        <p>
          Current booking: <strong>{formatDate(booking.date, booking.timeZone)}</strong> at <strong>{formatTime12h(booking.startTime, booking.date, booking.timeZone)}</strong>
          <br />Reschedules remaining: <strong>{2 - booking.rescheduleCount}</strong>
        </p>
      </header>

      {error && (
        <div className="toast error" style={{ position: 'relative', marginBottom: '16px', textAlign: 'center', maxWidth: '100%' }}>
          {error}
        </div>
      )}

      <div className="section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <div className="section-title">Choose New Date</div>
          <CalendarPicker selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </div>
        <div>
          <div className="section-title">Choose New Time</div>
          <TimeSlotGrid
            slots={timeSlots}
            selectedTime={selectedTime}
            onSelectTime={setSelectedTime}
            loading={loadingSlots}
            timeZone={timeZone}
          />
        </div>
      </div>

      <div className="section" style={{ textAlign: 'center', paddingBottom: '60px' }}>
        <button
          className="btn btn-primary btn-lg"
          disabled={!selectedDate || !selectedTime || submitting}
          onClick={handleReschedule}
        >
          {submitting ? (
            <><span className="spinner" /> Rescheduling...</>
          ) : (
            '✓ Confirm Reschedule'
          )}
        </button>
      </div>
    </div>
  );
}
