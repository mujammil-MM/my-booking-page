import { memo } from 'react';
import { TimeSlot } from '@/lib/types';

interface Props {
  slots: TimeSlot[];
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  loading: boolean;
  timeZone: string;
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

const TimeSlotGrid = memo(({ slots, selectedTime, onSelectTime, loading, timeZone }: Props) => {
  if (loading) {
    return (
      <div className="time-slots-container">
        <div className="time-slots-header">
          <h3>Available Times</h3>
          <span className="timezone-badge">{timeZone}</span>
        </div>
        <div className="time-slots-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 40 }} />
          ))}
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="time-slots-container">
        <div className="empty-state">
          <div className="emoji">📅</div>
          <p>Select a date to see available times</p>
        </div>
      </div>
    );
  }

  const availableCount = slots.filter(s => s.available).length;

  return (
    <div className="time-slots-container">
      <div className="time-slots-header">
        <h3>Available Times ({availableCount} slots)</h3>
        <span className="timezone-badge">{timeZone}</span>
      </div>
      <div className="time-slots-grid">
        {slots.map(slot => (
          <div
            key={slot.time}
            className={`time-slot ${!slot.available ? 'unavailable' : ''} ${selectedTime === slot.time ? 'selected' : ''}`}
            onClick={() => slot.available && onSelectTime(slot.time)}
          >
            {formatTime12h(slot.time)}
          </div>
        ))}
      </div>
    </div>
  );
});

TimeSlotGrid.displayName = 'TimeSlotGrid';

export default TimeSlotGrid;
