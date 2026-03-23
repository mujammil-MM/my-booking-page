'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import CallTypeSelector from '@/components/CallTypeSelector';
import CalendarPicker from '@/components/CalendarPicker';
import TimeSlotGrid from '@/components/TimeSlotGrid';
import { CallType, TimeSlot } from '@/lib/types';
import TimezoneSelector from '@/components/TimezoneSelector';

const ClientInfoForm = dynamic(() => import('@/components/ClientInfoForm'), {
  loading: () => <div className="skeleton skeleton-h-300" />,
});
const QualificationForm = dynamic(() => import('@/components/QualificationForm'), {
  loading: () => <div className="skeleton skeleton-h-200" />,
});

export default function BookingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [callType, setCallType] = useState<CallType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) setTimeZone(tz);

    setLoadingSettings(true);
    fetch('/api/bootstrap', { next: { revalidate: 300 } } as RequestInit)
      .then(r => r.json())
      .then(data => {
      const holidaysData = data.holidays || [];
      setHolidays(holidaysData);
      setHolidayMode(Boolean(data.holidayMode));

      const todayStr = new Date().toISOString().split('T')[0];
      const foundToday = holidaysData.some((h: { date: string }) => h.date === todayStr);
      setIsHolidayToday(foundToday);
    }).catch(() => {
      // Non-fatal: silently continue if settings fail to load
    }).finally(() => {
      setLoadingSettings(false);
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
    setErrorMsg(null);
  }

  async function handleSubmit() {
    if (!callType || !selectedDate || !selectedTime) return;
    if (!clientInfo.clientName || !clientInfo.email || !clientInfo.phone || !clientInfo.discussionTopic) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    if (!qualification.problem) {
      setErrorMsg('Please describe the problem you are trying to solve.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      console.log("Submitting booking", {
        ...clientInfo,
        callType,
        date: selectedDate,
        startTime: selectedTime,
        timeZone,
        qualification,
      });

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
          website: '', // honeypot field (always empty for real users)
        }),
      });

      if (!res.ok) {
        setSubmitting(false);
        const err = await res.json();
        setErrorMsg(err.error || 'Booking failed, please try again');
        return;
      }

      const booking = await res.json();
      router.push(`/confirmation/${booking.id}`);
      router.refresh();
    } catch {
      setErrorMsg('Something went wrong. Please check your connection and try again.');
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

      {loadingSettings ? (
        <div className="section section-animate">
          <div className="skeleton skeleton-h-100" style={{ marginBottom: '20px' }} />
        </div>
      ) : isAppDisabled ? (
        <div className="holiday-banner section-animate">
          <div className="emoji">🏖️</div>
          <h2>We are on holiday</h2>
          <p>We are currently on holiday and not accepting bookings right now. Please check back later. We will update availability soon.</p>
        </div>
      ) : null}

      {/* Progress Steps */}
      <div className={`progress-steps ${isAppDisabled ? 'disabled' : ''}`} style={isAppDisabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
        <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <span className="dot" />
          Call Type
        </div>
        <div className={`progress-line ${step > 1 ? 'completed' : ''}`} />
        <div className={`progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <span className="dot" />
          Date &amp; Time
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
      <div className="section section-animate" style={isAppDisabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
        <div className="section-title">
          <span className="step-number">1</span>
          Select Call Type
        </div>
        {loadingSettings ? (
          <div className="call-types">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-h-120" />
            ))}
          </div>
        ) : (
          <CallTypeSelector selected={callType} onSelect={handleCallTypeSelect} />
        )}
      </div>

      {/* Timezone Switcher */}
      <div className="section section-animate" style={isAppDisabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
        <TimezoneSelector
          value={timeZone}
          onChange={setTimeZone}
        />
      </div>

      {/* Step 2: Calendar & Time */}
      {callType && (
        <div className="section calendar-time-grid section-animate" style={isAppDisabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
          <div>
            <div className="section-title">
              <span className="step-number">2</span>
              Choose Date
            </div>
            <CalendarPicker
              selectedDate={selectedDate}
              onSelectDate={handleDateSelect}
              blockedDates={Array.isArray(holidays) ? holidays.map(h => h.date) : []}
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
        <div className="section section-animate">
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
        <div className="section section-animate">
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
        <div className="section confirm-btn-container section-animate" style={{ textAlign: 'center', paddingBottom: '60px' }}>
          {errorMsg && (
            <div className="error-banner section-animate" role="alert">
              <span className="error-banner-icon">⚠</span>
              {errorMsg}
            </div>
          )}
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
