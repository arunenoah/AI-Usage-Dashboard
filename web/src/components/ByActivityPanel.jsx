import React, { useEffect, useState } from 'react'

const ACTIVITY_COLORS = {
  'Coding':      '#1A73E8',
  'Debugging':   '#F44336',
  'Feature Dev': '#4CAF50',
  'Exploration': '#00BCD4',
  'Refactoring': '#FF9800',
  'Testing':     '#9C27B0',
  'Delegation':  '#E91E63',
  'Other':       '#9baabf',
}

export default function ByActivityPanel({ query = '' }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`/api/stats/by-activity${query}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [query])

  const rows = data?.activities || []
  const total = data?.total || 0

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>⚡</span> By Activity
          </div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
            {total} session{total !== 1 ? 's' : ''} classified by work type
          </div>
        </div>
        <span style={{ background: '#E8F5E9', color: '#388E3C', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>SESSIONS</span>
      </div>

      {rows.length === 0 && (
        <div style={{ color: '#9baabf', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No data for this period</div>
      )}

      {/* Stacked bar */}
      {rows.length > 0 && (
        <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 20 }}>
          {rows.map((row, i) => (
            <div
              key={i}
              style={{ width: `${row.pct}%`, background: ACTIVITY_COLORS[row.activity] || '#9baabf', transition: 'width 0.4s' }}
              title={`${row.activity}: ${row.pct}%`}
            />
          ))}
        </div>
      )}

      {/* Legend rows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
        {rows.map((row, i) => {
          const color = ACTIVITY_COLORS[row.activity] || '#9baabf'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#344767', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.activity}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: '#344767', flexShrink: 0 }}>
                {row.sessions}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#9baabf', width: 36, textAlign: 'right', flexShrink: 0 }}>
                {row.pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
