'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { getAllTimezones, getGMTLabel, TimezoneOption } from '@/lib/timezones';

interface Props {
  value: string;
  onChange: (tz: string) => void;
}

export default function TimezoneSelector({ value, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const detectedTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  
  const allOptions = useMemo(() => getAllTimezones(), []);
  
  const filteredOptions = useMemo(() => {
    if (!search) return allOptions;
    const s = search.toLowerCase();
    return allOptions.filter(o => o.label.toLowerCase().includes(s));
  }, [allOptions, search]);

  const displayLabel = useMemo(() => {
    if (value === detectedTz) {
      return `Automatic (Detected) — ${value} (${getGMTLabel(value)})`;
    }
    const found = allOptions.find(o => o.value === value);
    return found ? found.label : value;
  }, [value, detectedTz, allOptions]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="timezone-selector-container" ref={containerRef}>
      <div 
        className={`timezone-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="globe-icon">🌍</span>
        <span className="current-value">{displayLabel}</span>
        <span className="chevron-icon">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <>
          <div className="timezone-overlay" onClick={() => setIsOpen(false)} />
          <div className="timezone-dropdown">
            <div className="search-box">
              <div className="mobile-header">
                <h3>Select Timezone</h3>
                <button className="close-btn" onClick={() => setIsOpen(false)}>✕</button>
              </div>
              <input 
                type="text" 
                placeholder="Search timezone..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="options-list">
              {/* Quick Auto Option */}
              <div 
                className={`option-item ${value === detectedTz ? 'selected' : ''}`}
                onClick={() => {
                  onChange(detectedTz);
                  setIsOpen(false);
                  setSearch('');
                }}
              >
                <span className="auto-badge">Auto</span>
                {detectedTz} ({getGMTLabel(detectedTz)})
              </div>
              
              <div className="divider">All Timezones</div>
              
              {filteredOptions.map((opt) => (
                <div 
                  key={opt.value}
                  className={`option-item ${value === opt.value ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  {opt.label}
                </div>
              ))}
              {filteredOptions.length === 0 && (
                <div className="no-results">No timezones found</div>
              )}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .timezone-selector-container {
          position: relative;
          width: 100%;
          z-index: 50;
        }

        .timezone-trigger {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          backdrop-filter: blur(10px);
          cursor: pointer;
          transition: all 0.25s ease;
          color: #fafafa;
        }

        .timezone-trigger:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(99, 102, 241, 0.3);
        }

        .timezone-trigger.active {
          border-color: var(--accent-primary);
          box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
        }

        .globe-icon {
          font-size: 16px;
        }

        .current-value {
          flex: 1;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chevron-icon {
          font-size: 10px;
          opacity: 0.5;
        }

        .timezone-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: #121214;
          border: 1px solid var(--border);
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .search-box {
          padding: 12px;
          border-bottom: 1px solid var(--border);
        }

        .search-box input {
          width: 100%;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: #fff;
          font-size: 13px;
          outline: none;
        }

        .search-box input:focus {
          border-color: var(--accent-primary);
        }

        .options-list {
          max-height: 300px;
          overflow-y: auto;
          padding: 8px;
        }

        .options-list::-webkit-scrollbar {
          width: 5px;
        }
        .options-list::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 10px;
        }

        .option-item {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .option-item:hover {
          background: rgba(99, 102, 241, 0.1);
          color: #fff;
        }

        .option-item.selected {
          background: var(--accent-primary);
          color: #fff;
        }

        .auto-badge {
          background: rgba(99, 102, 241, 0.2);
          color: var(--accent-primary);
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .divider {
          padding: 12px 14px 6px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .no-results {
          padding: 20px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
        }

        .timezone-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          z-index: 1000;
        }

        @media (max-width: 768px) {
          .timezone-trigger {
            border-radius: 12px;
            padding: 14px 16px;
          }

          .timezone-dropdown {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            border-radius: 24px 24px 0 0;
            max-height: 80vh;
            z-index: 1001;
            animation: slideUpModal 0.3s ease;
          }

          @keyframes slideUpModal {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }

          .options-list {
            max-height: 60vh;
          }

          .option-item {
            padding: 16px;
            font-size: 15px;
          }

          .mobile-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }

          .mobile-header h3 {
            font-size: 16px;
            font-weight: 700;
            color: #fff;
          }

          .close-btn {
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: #fff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .timezone-overlay {
            display: block;
          }
        }

        .mobile-header {
          display: none;
        }
      `}</style>
    </div>
  );
}
