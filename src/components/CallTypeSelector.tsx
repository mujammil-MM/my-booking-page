'use client';

import { CallTypeInfo, CALL_TYPES, CallType } from '@/lib/types';

interface Props {
  selected: CallType | null;
  onSelect: (type: CallType) => void;
}

export default function CallTypeSelector({ selected, onSelect }: Props) {
  return (
    <div className="call-types">
      {CALL_TYPES.map((ct: CallTypeInfo) => (
        <div
          key={ct.id}
          className={`call-type-card ${selected === ct.id ? 'selected' : ''}`}
          onClick={() => onSelect(ct.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(ct.id)}
        >
          <div className="duration">{ct.duration}<span style={{ fontSize: '14px', fontWeight: 400 }}>min</span></div>
          <div className="label">{ct.label}</div>
          <div className="desc">{ct.description}</div>
          <div className="price">{ct.price}</div>
        </div>
      ))}
    </div>
  );
}
