'use client';

import { useEffect, useState } from 'react';
import { BookingResponse, AnalyticsData } from '@/lib/types';

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function callLabel(type: string): string {
  return type === 'INTRO_15' ? '15 Min Intro'
    : type === 'CONSULT_30' ? '30 Min Consult'
    : '60 Min Strategy';
}

type Tab = 'upcoming' | 'past' | 'analytics';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([
      fetch('/api/bookings').then(r => r.json()),
      fetch('/api/analytics').then(r => r.json()),
    ]).then(([bookingsData, analyticsData]) => {
      setBookings(bookingsData.bookings || []);
      setAnalytics(analyticsData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function markStatus(id: string, status: string) {
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBookings(prev => prev.map(b => b.id === id ? updated : b));
    }
  }

  const upcoming = bookings.filter(b => b.status === 'CONFIRMED' && b.date >= today);
  const past = bookings.filter(b => b.date < today || b.status !== 'CONFIRMED');

  if (loading) {
    return (
      <div className="page-container admin-container">
        <div className="page-header"><h1>Loading Dashboard...</h1></div>
        <div className="admin-stats">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton stat-card" style={{ height: 100 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container admin-container">
      <header className="page-header">
        <div className="badge">✦ Admin</div>
        <h1>Dashboard</h1>
        <p>Manage your bookings, view client details, and track analytics.</p>
      </header>

      {/* Stats */}
      {analytics && (
        <div className="admin-stats">
          <div className="stat-card">
            <div className="stat-value">{analytics.totalBookings}</div>
            <div className="stat-label">Total Bookings</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.upcomingBookings}</div>
            <div className="stat-label">Upcoming</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.cancellationRate}%</div>
            <div className="stat-label">Cancellation Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{analytics.noShowRate}%</div>
            <div className="stat-label">No-Show Rate</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming ({upcoming.length})
        </button>
        <button className={`admin-tab ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
          Past ({past.length})
        </button>
        <button className={`admin-tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>
          Analytics
        </button>
      </div>

      {/* Upcoming */}
      {tab === 'upcoming' && (
        <div className="booking-list">
          {upcoming.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📭</div>
              <p>No upcoming bookings</p>
            </div>
          ) : (
            upcoming.map(b => (
              <div key={b.id} className="booking-card">
                <div className="booking-card-header">
                  <h3>{b.clientName}</h3>
                  <span className={`status-badge ${b.status.toLowerCase().replace('_', '-')}`}>{b.status.replace('_', ' ')}</span>
                </div>
                <div className="booking-card-details">
                  <div className="detail"><span className="label">Date</span><span className="value">{formatDate(b.date)}</span></div>
                  <div className="detail"><span className="label">Time</span><span className="value">{formatTime12h(b.startTime)} – {formatTime12h(b.endTime)}</span></div>
                  <div className="detail"><span className="label">Type</span><span className="value">{callLabel(b.callType)}</span></div>
                  <div className="detail"><span className="label">Email</span><span className="value">{b.email}</span></div>
                  <div className="detail"><span className="label">Phone</span><span className="value">{b.phone}</span></div>
                  {b.company && <div className="detail"><span className="label">Company</span><span className="value">{b.company}</span></div>}
                </div>
                {b.discussionTopic && (
                  <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Discussion:</strong>
                    <br />{b.discussionTopic}
                  </div>
                )}
                {b.qualification && (
                  <div className="qualification-section">
                    <h4>Lead Qualification</h4>
                    <div className="qualification-grid">
                      <div className="qualification-item">
                        <div className="q-label">Problem</div>
                        <div className="q-value">{b.qualification.problem || '—'}</div>
                      </div>
                      <div className="qualification-item">
                        <div className="q-label">Budget</div>
                        <div className="q-value">{b.qualification.budgetRange || '—'}</div>
                      </div>
                      <div className="qualification-item">
                        <div className="q-label">Timeline</div>
                        <div className="q-value">{b.qualification.timeline || '—'}</div>
                      </div>
                      <div className="qualification-item">
                        <div className="q-label">Prior Agency</div>
                        <div className="q-value">{b.qualification.workedWithAgencyBefore || '—'}</div>
                      </div>
                    </div>
                  </div>
                )}
                {b.meetingLink && (
                  <div style={{ marginTop: '12px' }}>
                    <a href={b.meetingLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                      Join Meeting →
                    </a>
                  </div>
                )}
                <div className="action-buttons">
                  <button className="btn btn-secondary btn-sm" onClick={() => markStatus(b.id, 'COMPLETED')}>✓ Mark Complete</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => markStatus(b.id, 'NO_SHOW')} style={{ color: 'var(--warning)' }}>⚠ No Show</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Past */}
      {tab === 'past' && (
        <div className="booking-list">
          {past.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📋</div>
              <p>No past bookings yet</p>
            </div>
          ) : (
            past.map(b => (
              <div key={b.id} className="booking-card">
                <div className="booking-card-header">
                  <h3>{b.clientName}</h3>
                  <span className={`status-badge ${b.status.toLowerCase().replace('_', '-')}`}>{b.status.replace('_', ' ')}</span>
                </div>
                <div className="booking-card-details">
                  <div className="detail"><span className="label">Date</span><span className="value">{formatDate(b.date)}</span></div>
                  <div className="detail"><span className="label">Time</span><span className="value">{formatTime12h(b.startTime)}</span></div>
                  <div className="detail"><span className="label">Type</span><span className="value">{callLabel(b.callType)}</span></div>
                  <div className="detail"><span className="label">Email</span><span className="value">{b.email}</span></div>
                </div>
                {b.qualification && (
                  <div className="qualification-section">
                    <h4>Lead Qualification</h4>
                    <div className="qualification-grid">
                      <div className="qualification-item">
                        <div className="q-label">Problem</div>
                        <div className="q-value">{b.qualification.problem || '—'}</div>
                      </div>
                      <div className="qualification-item">
                        <div className="q-label">Budget</div>
                        <div className="q-value">{b.qualification.budgetRange || '—'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Analytics */}
      {tab === 'analytics' && analytics && (
        <div>
          <div className="analytics-grid">
            <div className="analytics-card">
              <h3>Popular Time Slots</h3>
              {analytics.popularSlots.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No data yet</p>
              ) : (
                <div className="bar-chart">
                  {analytics.popularSlots.map(slot => {
                    const max = Math.max(...analytics.popularSlots.map(s => s.count));
                    return (
                      <div key={slot.time} className="bar-row">
                        <span className="bar-label">{formatTime12h(slot.time)}</span>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${(slot.count / max) * 100}%` }} />
                        </div>
                        <span className="bar-value">{slot.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="analytics-card">
              <h3>Bookings by Type</h3>
              {analytics.bookingsByType.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No data yet</p>
              ) : (
                <div className="bar-chart">
                  {analytics.bookingsByType.map(item => {
                    const max = Math.max(...analytics.bookingsByType.map(s => s.count));
                    return (
                      <div key={item.type} className="bar-row">
                        <span className="bar-label" style={{ width: '100px' }}>{callLabel(item.type)}</span>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
                        </div>
                        <span className="bar-value">{item.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="analytics-card">
              <h3>Status Breakdown</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--success)' }}>{analytics.completedBookings}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Completed</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--danger)' }}>{analytics.cancelledBookings}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Cancelled</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--warning)' }}>{analytics.noShowBookings}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>No Shows</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-primary)' }}>{analytics.upcomingBookings}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Upcoming</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: '60px' }} />
    </div>
  );
}
