import { useState, memo } from 'react';

interface Props {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  blockedDates?: string[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CalendarPicker = memo(({ selectedDate, onSelectDate, blockedDates = [] }: Props) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonthCount = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  const days = [];
  // Empty slots
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${viewYear}-${viewMonth}-${i}`} className="day empty" />);
  }

  // Days
  for (let d = 1; d <= daysInMonthCount; d++) {
    const date = new Date(viewYear, viewMonth, d);
    const dateStr = date.toISOString().split('T')[0];
    const isPast = date < today;
    const isSelected = selectedDate === dateStr;
    const isToday = todayStr === dateStr;
    const isBlocked = blockedDates.includes(dateStr);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    const isDisabled = isPast || isBlocked || isWeekend;

    days.push(
      <button
        key={`${viewYear}-${viewMonth}-${d}`}
        type="button"
        className={`day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`}
        onClick={() => !isDisabled && onSelectDate(dateStr)}
        disabled={isDisabled}
      >
        {d}
      </button>
    );
  }

  const canGoPrev = viewYear > today.getFullYear() || viewMonth > today.getMonth();

  return (
    <div className="calendar-container">
      <div className="calendar-nav">
        <button type="button" onClick={prevMonth} disabled={!canGoPrev} style={{ opacity: canGoPrev ? 1 : 0.3 }}>
          ‹
        </button>
        <h3>{MONTH_NAMES[viewMonth]} {viewYear}</h3>
        <button type="button" onClick={nextMonth}>›</button>
      </div>

      <div className="calendar-grid">
        {DAY_LABELS.map(label => (
          <div key={label} className="day-label">{label}</div>
        ))}
        {days}
      </div>
    </div>
  );
});

CalendarPicker.displayName = 'CalendarPicker';

export default CalendarPicker;
