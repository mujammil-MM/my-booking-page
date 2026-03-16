'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookingResponse, AnalyticsData } from '@/lib/types';

import { formatTime12h, formatDate } from '@/lib/utils';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';


function callLabel(type: string): string {
  return type === 'INTRO_15' ? '15 Min Intro'
    : type === 'CONSULT_30' ? '30 Min Consult'
    : '60 Min Strategy';
}

type Tab = 'upcoming' | 'past' | 'analytics' | 'holidays';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [adminTz, setAdminTz] = useState('UTC');
  
  useEffect(() => {
    setAdminTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [holidays, setHolidays] = useState<{ id: string; date: string; note: string }[]>([]);
  const [holidayMode, setHolidayMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: '', note: '' });
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dailyData, setDailyData] = useState<{ date: string; count: number; displayDate: string }[]>([]);
  const limit = 20;
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const today = new Date().toISOString().split('T')[0];

  const fetchBookings = async (offset: number, query: string) => {
    setBookingsLoading(true);
    try {
      const res = await fetch(`/api/bookings?limit=${limit}&offset=${offset}&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setBookings(data.bookings || []);
      setTotalBookings(data.totalCount || 0);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setBookingsLoading(false);
    }
  };

  const fetchHolidays = async () => {
    const res = await fetch('/api/holidays');
    const data = await res.json();
    setHolidays(data);
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    setHolidayMode(data.holidayMode);
  };

  const fetchAnalytics = async () => {
    const res = await fetch('/api/analytics');
    const data = await res.json();
    setAnalytics(data);

    // Also fetch daily data
    const resDaily = await fetch('/api/analytics/daily');
    const dataDaily = await resDaily.json();
    setDailyData(dataDaily);
  };

  useEffect(() => {
    // Initial load: Fetch settings first
    fetchSettings()
      .then(() => {
        setLoading(false);
        // Secondary load: Analytics and holidays can load in background
        fetchAnalytics();
        fetchHolidays();
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchBookings(page * limit, debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, loading]);

  async function toggleHolidayMode() {
    const nextMode = !holidayMode;
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holidayMode: nextMode }),
    });
    if (res.ok) setHolidayMode(nextMode);
  }

  async function addHoliday() {
    if (!newHoliday.date) return;
    const res = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newHoliday),
    });
    if (res.ok) {
      fetchHolidays();
      setShowHolidayModal(false);
      setNewHoliday({ date: '', note: '' });
    }
  }

  async function deleteHoliday(id: string) {
    const res = await fetch(`/api/holidays/${id}`, { method: 'DELETE' });
    if (res.ok) fetchHolidays();
  }

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

  async function handleLogout() {
    const res = await fetch('/api/admin/logout', { method: 'POST' });
    if (res.ok) {
      router.push('/admin-login');
      router.refresh();
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
      <header className="page-header" style={{ position: 'relative' }}>
        <div className="admin-btn">ADMIN</div>
        <h1>Dashboard</h1>
        <p>Manage your bookings, view client details, and track analytics.</p>
        
        <div style={{ position: 'absolute', top: '60px', right: '0', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className={`btn ${holidayMode ? 'btn-danger' : 'btn-secondary'} btn-sm`}
            onClick={toggleHolidayMode}
          >
            {holidayMode ? 'Holiday Mode: ON' : 'Holiday Mode: OFF'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowHolidayModal(true)}>
            Add Holiday
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleLogout}
            style={{ 
              opacity: 0.5, 
              fontSize: '11px', 
              background: 'transparent', 
              border: 'none', 
              padding: '4px 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Holiday Modal */}
      {showHolidayModal && (
        <div className="modal-overlay" onClick={() => setShowHolidayModal(false)}>
          <div className="modal-content card" onClick={e => e.stopPropagation()}>
            <h3>Add Holiday</h3>
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Date</label>
              <input 
                type="date" 
                value={newHoliday.date} 
                onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Note (Optional)</label>
              <input 
                type="text" 
                placeholder="Public Holiday or Vacation"
                value={newHoliday.note}
                onChange={e => setNewHoliday({ ...newHoliday, note: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-primary btn-full" onClick={addHoliday}>Save Holiday</button>
              <button className="btn btn-secondary btn-full" onClick={() => setShowHolidayModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="admin-stats">
        {!analytics ? (
          <>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton stat-card" style={{ height: 100 }} />)}
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
        <div className="search-container-glass">
          <input 
            type="text" 
            placeholder="Search bookings by name, email, date, or company..." 
            className="search-input-glass" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="search-icon-glass">🔍</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', alignSelf: 'center' }}>
            Page {page + 1} of {Math.ceil(totalBookings / limit) || 1}
          </span>
          <button 
            className="btn btn-secondary btn-sm" 
            disabled={(page + 1) * limit >= totalBookings}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming ({upcoming.length})
        </button>
        <button className={`admin-tab ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
          Past ({past.length})
        </button>
        <button className={`admin-tab ${tab === 'holidays' ? 'active' : ''}`} onClick={() => setTab('holidays')}>
          Holidays ({holidays.length})
        </button>
        <button className={`admin-tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>
          Analytics
        </button>
      </div>

      {/* Upcoming */}
      {tab === 'upcoming' && (
        <div className="booking-list">
          {bookingsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton booking-card" style={{ height: 200 }} />)}
            </div>
          ) : upcoming.length === 0 ? (
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
                  <div className="detail"><span className="label">Date</span><span className="value">{formatDate(b.date, adminTz)}</span></div>
                  <div className="detail"><span className="label">Time</span><span className="value">{formatTime12h(b.startTime, b.date, adminTz)} – {formatTime12h(b.endTime, b.date, adminTz)}</span></div>
                  <div className="detail"><span className="label">Client Timezone</span><span className="value">{b.timeZone || 'Unknown timezone'}</span></div>
                  <div className="detail"><span className="label">Type</span><span className="value">{callLabel(b.callType)}</span></div>
                  <div className="detail"><span className="label">Email</span><span className="value">{b.email}</span></div>
                  <div className="detail"><span className="label">Phone</span><span className="value">{b.phone}</span></div>
                  {b.company && <div className="detail"><span className="label">Company</span><span className="value">{b.company}</span></div>}
                </div>
                <div className="qualification-section">
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                    Lead Qualification
                  </h4>
                  <div className="qualification-grid">
                    <div className="qualification-item">
                      <div className="q-label">Problem</div>
                      <div className="q-value">{b.qualification?.problem || 'Not provided'}</div>
                    </div>
                    <div className="qualification-item">
                      <div className="q-label">Discussion</div>
                      <div className="q-value">{b.discussionTopic || 'Not provided'}</div>
                    </div>
                    <div className="qualification-item">
                      <div className="q-label">Budget</div>
                      <div className="q-value">{b.qualification?.budgetRange || 'Not provided'}</div>
                    </div>
                    <div className="qualification-item">
                      <div className="q-label">Timeline</div>
                      <div className="q-value">{b.qualification?.timeline || 'Not provided'}</div>
                    </div>
                    <div className="qualification-item">
                      <div className="q-label">Prior Agency</div>
                      <div className="q-value">{b.qualification?.workedWithAgencyBefore || 'Not provided'}</div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '12px' }}>
                  {b.meetingLink ? (
                    <a href={b.meetingLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                      Join Meeting →
                    </a>
                  ) : (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Meeting link will be generated shortly.
                    </span>
                  )}
                </div>
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
                   <div className="detail"><span className="label">Date</span><span className="value">{formatDate(b.date, adminTz)}</span></div>
                   <div className="detail"><span className="label">Time</span><span className="value">{formatTime12h(b.startTime, b.date, adminTz)}</span></div>
                   <div className="detail"><span className="label">Client Timezone</span><span className="value">{b.timeZone || 'Unknown timezone'}</span></div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Daily Line Chart */}
          <div className="card stats-graph-container">
            <h3>Bookings Over Time</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    interval={4}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--bg-card)', 
                      border: '1px solid var(--border)', 
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'var(--text-primary)'
                    }}
                    itemStyle={{ color: 'var(--accent-primary)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="var(--accent-primary)" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorCount)" 
                    dot={{ fill: 'var(--accent-primary)', strokeWidth: 2, r: 4, stroke: 'var(--bg-primary)' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

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

      {/* Holidays */}
      {tab === 'holidays' && (
        <div className="booking-list">
          {holidays.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🏖️</div>
              <p>No holidays scheduled</p>
              <button className="btn btn-primary" onClick={() => setShowHolidayModal(true)} style={{ marginTop: '16px' }}>
                Add First Holiday
              </button>
            </div>
          ) : (
            holidays.map(h => (
              <div key={h.id} className="booking-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{formatDate(h.date, adminTz)}</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>{h.note || 'No note provided'}</p>
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => deleteHoliday(h.id)}
                  style={{ color: 'var(--danger)' }}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ height: '60px' }} />

    </div>
  );
}
