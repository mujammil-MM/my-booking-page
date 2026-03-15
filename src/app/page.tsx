'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import CallTypeSelector from '@/components/CallTypeSelector';
import CalendarPicker from '@/components/CalendarPicker';
import TimeSlotGrid from '@/components/TimeSlotGrid';
import { CallType, TimeSlot } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import TimezoneSelector from '@/components/TimezoneSelector';

const ClientInfoForm = dynamic(() => import('@/components/ClientInfoForm'), { 
  loading: () => <div className="skeleton" style={{ height: '300px' }} /> 
});
const QualificationForm = dynamic(() => import('@/components/QualificationForm'), {
  loading: () => <div className="skeleton" style={{ height: '200px' }} />
});

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [callType, setCallType] = useState<CallType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeZone, setTimeZone] = useState('Asia/Kolkata');

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

  const [holidays, setHolidays] = useState<{ id: string; date: string; note: string }[]>([]);
  const [holidayMode, setHolidayMode] = useState(false);
  const [isHolidayToday, setIsHolidayToday] = useState(false);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) setTimeZone(tz);
    
    // Fetch holidays and settings
    Promise.all([
      fetch('/api/holidays').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([holidaysData, settingsData]) => {
      setHolidays(holidaysData || []);
      setHolidayMode(settingsData.holidayMode || false);
      
      const todayStr = new Date().toISOString().split('T')[0];
      const foundToday = (holidaysData || []).some((h: { date: string }) => h.date === todayStr);
      setIsHolidayToday(foundToday);
    });
  }, []);

  const fetchSlots = useCallback(async (date: string, type: CallType, tz: string) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/availability?date=${date}&callType=${type}&timezone=${tz}`);
      const data = await res.json();
      setTimeSlots(data.slots || []);
    } catch {
      setTimeSlots([]);
    }
    setLoadingSlots(false);
  }, []);

  useEffect(() => {
    if (selectedDate && callType) {
      fetchSlots(selectedDate, callType, timeZone);
      setSelectedTime(null);
    }
  }, [selectedDate, callType, timeZone, fetchSlots]);

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

      try {
        await supabase.from('bookings').insert({
          name: clientInfo.clientName,
          email: clientInfo.email,
          phone: clientInfo.phone,
          company: clientInfo.company,
          call_type: callType,
          date: booking.date, // Save normalization UTC date
          time: booking.startTime, // Save normalization UTC time
          client_timezone: timeZone,
          meeting_link: booking.meetingLink,
          discussion: clientInfo.discussionTopic,
          problem: qualification.problem,
          budget: qualification.budgetRange,
          timeline: qualification.timeline,
          prior_agency: qualification.workedWithAgencyBefore,
          created_at: new Date().toISOString()
        });
      } catch (supabaseError) {
        console.error('Failed to save booking to Supabase:', supabaseError);
      }

      // 3. Trigger Resend Email Notification via our new secure route
      try {
        await fetch('/api/notify-supabase-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: clientInfo.clientName,
            email: clientInfo.email,
            phone: clientInfo.phone,
            company: clientInfo.company,
            call_type: callType,
            date: booking.date,
            time: booking.startTime,
            timezone: timeZone,
            meeting_link: booking.meetingLink,
            discussion: clientInfo.discussionTopic,
            problem: qualification.problem,
            budget: qualification.budgetRange,
            timeline: qualification.timeline,
            prior_agency: qualification.workedWithAgencyBefore,
          }),
        });
      } catch (notifyError) {
        console.error('Failed to trigger Supabase email notification:', notifyError);
      }

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

  const isAppDisabled = holidayMode || isHolidayToday;

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div className="badge">Schedule a Meeting</div>
        <h1>Book a Call</h1>
        <p>
          Choose a time that works for you. We&apos;ll discuss your project,
          answer questions, and explore how we can help you succeed.
        </p>
      </header>

      {isAppDisabled && (
        <div className="holiday-banner">
          <div className="emoji">🏖️</div>
          <h2>We are on holiday</h2>
          <p>We are currently on holiday and not accepting bookings right now. Please check back later. We will update availability soon.</p>
        </div>
      )}

      {/* Progress Steps */}
      <div className={`progress-steps ${isAppDisabled ? 'disabled' : ''}`} style={isAppDisabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
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
      <div className="section" style={isAppDisabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
        <div className="section-title">
          <span className="step-number">1</span>
          Select Call Type
        </div>
        <CallTypeSelector selected={callType} onSelect={handleCallTypeSelect} />
      </div>

      {/* Timezone Switcher */}
      <div className="section" style={isAppDisabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
        <TimezoneSelector 
          value={timeZone} 
          onChange={setTimeZone}
        />
      </div>

      {/* Step 2: Calendar & Time */}
      {callType && (
        <div className="section calendar-time-grid" style={isAppDisabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
          <div>
            <div className="section-title">
              <span className="step-number">2</span>
              Choose Date
            </div>
            <CalendarPicker 
              selectedDate={selectedDate} 
              onSelectDate={handleDateSelect} 
              blockedDates={holidays.map(h => h.date)}
            />
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
        <div className="section confirm-btn-container" style={{ textAlign: 'center', paddingBottom: '60px' }}>
          <button
            className="btn btn-primary btn-lg btn-full confirm-btn"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <span className="spinner" />
                Booking...
              </>
            ) : (
              <>Confirm Booking</>
            )}
          </button>
          <p className="mobile-hide" style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>
            You can reschedule or cancel anytime before the meeting
          </p>
        </div>
      )}
    </div>
  );
}
