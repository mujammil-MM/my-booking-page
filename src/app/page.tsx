'use client';

import { useState, useEffect, useCallback } from 'react';
import CallTypeSelector from '@/components/CallTypeSelector';
import CalendarPicker from '@/components/CalendarPicker';
import TimeSlotGrid from '@/components/TimeSlotGrid';
import ClientInfoForm from '@/components/ClientInfoForm';
import QualificationForm from '@/components/QualificationForm';
import { CallType, TimeSlot } from '@/lib/types';

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [callType, setCallType] = useState<CallType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeZone, setTimeZone] = useState('UTC');

  const [clientInfo, setClientInfo] = useState({
    clientName: '',
    email: '',
    phone: '',
    company: '',
    discussionTopic: '',
  });

  const [qualification, setQualification] = useState({
    problem: '',
    budgetRange: '',
    timeline: '',
    workedWithAgencyBefore: '',
  });

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const fetchSlots = useCallback(async (date: string, type: CallType) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/availability?date=${date}&callType=${type}`);
      const data = await res.json();
      setTimeSlots(data.slots || []);
    } catch {
      setTimeSlots([]);
    }
    setLoadingSlots(false);
  }, []);

  useEffect(() => {
    if (selectedDate && callType) {
      fetchSlots(selectedDate, callType);
      setSelectedTime(null);
    }
  }, [selectedDate, callType, fetchSlots]);

  function handleCallTypeSelect(type: CallType) {
    setCallType(type);
    if (step < 2) setStep(2);
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    if (step < 2) setStep(2);
  }

  function handleTimeSelect(time: string) {
    setSelectedTime(time);
    if (step < 3) setStep(3);
  }

  async function handleSubmit() {
    if (!callType || !selectedDate || !selectedTime) return;
    if (!clientInfo.clientName || !clientInfo.email || !clientInfo.phone || !clientInfo.discussionTopic) {
      alert('Please fill in all required fields.');
      return;
    }
    if (!qualification.problem) {
      alert('Please describe the problem you are trying to solve.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...clientInfo,
          callType,
          date: selectedDate,
          startTime: selectedTime,
          timeZone,
          qualification,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Booking failed. Please try again.');
        setSubmitting(false);
        return;
      }

      const booking = await res.json();
      window.location.href = `/confirmation/${booking.id}`;
    } catch {
      alert('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const canSubmit =
    callType &&
    selectedDate &&
    selectedTime &&
    clientInfo.clientName &&
    clientInfo.email &&
    clientInfo.phone &&
    clientInfo.discussionTopic &&
    qualification.problem;

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div className="badge">✦ Schedule a Meeting</div>
        <h1>Book a Call</h1>
        <p>
          Choose a time that works for you. We&apos;ll discuss your project,
          answer questions, and explore how we can help you succeed.
        </p>
      </header>

      {/* Progress Steps */}
      <div className="progress-steps">
        <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <span className="dot" />
          Call Type
        </div>
        <div className={`progress-line ${step > 1 ? 'completed' : ''}`} />
        <div className={`progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <span className="dot" />
          Date & Time
        </div>
        <div className={`progress-line ${step > 2 ? 'completed' : ''}`} />
        <div className={`progress-step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
          <span className="dot" />
          Your Details
        </div>
        <div className={`progress-line ${step > 3 ? 'completed' : ''}`} />
        <div className={`progress-step ${step >= 4 ? 'active' : ''}`}>
          <span className="dot" />
          Confirm
        </div>
      </div>

      {/* Step 1: Call Type */}
      <div className="section">
        <div className="section-title">
          <span className="step-number">1</span>
          Select Call Type
        </div>
        <CallTypeSelector selected={callType} onSelect={handleCallTypeSelect} />
      </div>

      {/* Step 2: Calendar & Time */}
      {callType && (
        <div className="section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div className="section-title">
              <span className="step-number">2</span>
              Choose Date
            </div>
            <CalendarPicker selectedDate={selectedDate} onSelectDate={handleDateSelect} />
          </div>
          <div>
            <div className="section-title" style={{ visibility: 'hidden' }}>
              <span className="step-number">2</span>
              Time
            </div>
            <TimeSlotGrid
              slots={timeSlots}
              selectedTime={selectedTime}
              onSelectTime={handleTimeSelect}
              loading={loadingSlots}
              timeZone={timeZone}
            />
          </div>
        </div>
      )}

      {/* Step 3: Client Info */}
      {selectedTime && (
        <div className="section">
          <div className="section-title">
            <span className="step-number">3</span>
            Your Information
          </div>
          <div className="card">
            <ClientInfoForm data={clientInfo} onChange={setClientInfo} />
          </div>
        </div>
      )}

      {/* Step 4: Qualification */}
      {selectedTime && clientInfo.clientName && clientInfo.email && (
        <div className="section">
          <div className="section-title">
            <span className="step-number">4</span>
            Quick Questions
          </div>
          <div className="card">
            <QualificationForm data={qualification} onChange={setQualification} />
          </div>
        </div>
      )}

      {/* Submit */}
      {selectedTime && (
        <div className="section" style={{ textAlign: 'center', paddingBottom: '60px' }}>
          <button
            className="btn btn-primary btn-lg btn-full"
            style={{ maxWidth: '400px' }}
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <span className="spinner" />
                Booking...
              </>
            ) : (
              <>✦ Confirm Booking</>
            )}
          </button>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>
            You can reschedule or cancel anytime before the meeting
          </p>
        </div>
      )}
    </div>
  );
}
