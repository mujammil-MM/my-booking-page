'use client';

import { useState } from 'react';

interface Props {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarPicker({ selectedDate, onSelectDate }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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

  function isDisabled(day: number): boolean {
    const d = new Date(viewYear, viewMonth, day);
    const dayOfWeek = d.getDay();
    // Weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) return true;
    // Past
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    if (d < t) return true;
    return false;
  }

  function dateStr(day: number): string {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const canGoPrev = viewYear > today.getFullYear() || viewMonth > today.getMonth();

  return (
    <div className="calendar-container">
      <div className="calendar-nav">
        <button onClick={prevMonth} disabled={!canGoPrev} style={{ opacity: canGoPrev ? 1 : 0.3 }}>
          ‹
        </button>
        <h3>{MONTH_NAMES[viewMonth]} {viewYear}</h3>
        <button onClick={nextMonth}>›</button>
      </div>

      <div className="calendar-grid">
        {DAY_LABELS.map(d => (
          <div key={d} className="day-label">{d}</div>
        ))}

        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`empty-${i}`} className="day empty" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const ds = dateStr(day);
          const disabled = isDisabled(day);
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDate;

          return (
            <div
              key={day}
              className={`day ${disabled ? 'disabled' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => !disabled && onSelectDate(ds)}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
