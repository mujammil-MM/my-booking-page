'use client';

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { AnalyticsData } from '@/lib/types';
import { formatTime12h } from '@/lib/utils';

interface Props {
  analytics: AnalyticsData | null;
  analyticsLoading: boolean;
  dailyData: { date: string; count: number; displayDate: string }[];
}

function callLabel(type: string): string {
  return type === 'INTRO_15'
    ? '15 Min Intro'
    : type === 'CONSULT_30'
      ? '30 Min Consult'
      : '60 Min Strategy';
}

export default function AdminAnalyticsPanel({ analytics, analyticsLoading, dailyData }: Props) {
  if (analyticsLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)}
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="empty-state">
        <div className="emoji">Data</div>
        <p>No analytics data available yet</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="card stats-graph-container">
        <h3>Bookings Over Time</h3>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
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
                  color: 'var(--text-primary)',
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
  );
}
