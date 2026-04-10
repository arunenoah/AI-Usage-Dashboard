import React, { useEffect, useState } from 'react'

const DIMENSION_COLORS = ['#22c55e', '#2563eb', '#f59e0b', '#8b5cf6']

const INSIGHT_STYLE = {
  warning: { icon: '⚠', iconBg: '#FFF3E0', iconColor: '#f59e0b' },
  error:   { icon: '✕', iconBg: '#FEECEC', iconColor: '#ef4444' },
  info:    { icon: 'ℹ', iconBg: '#EFF6FF', iconColor: '#2563eb' },
  success: { icon: '✓', iconBg: '#F0FDF4', iconColor: '#22c55e' },
}

function scoreColor(s) {
  if (s >= 75) return '#22c55e'
  if (s >= 55) return '#f59e0b'
  return '#ef4444'
}

export default function PromptScore({ days = 30 }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/insights?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days])

  if (loading || !data) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ fontSize: 12, color: '#9baabf' }}>Computing insights…</span>
      </div>
    )
  }

  const score = data.score || 0
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const sc = scoreColor(score)
  const actionCount = (data.insights || []).filter(i => i.type === 'warning' || i.type === 'error').length

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767' }}>✦ Prompt Insights</div>
          <div style={{ fontSize: 11, color: '#7b809a', marginTop: 2 }}>
            {data.total_sessions} sessions · last {days} days
          </div>
        </div>
        {actionCount > 0 && (
          <span style={{ background: '#FFF3E0', color: '#f59e0b', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>
            {actionCount} ACTION{actionCount !== 1 ? 'S' : ''}
          </span>
        )}
        {actionCount === 0 && (
          <span style={{ background: '#F0FDF4', color: '#22c55e', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>
            ALL GOOD
          </span>
        )}
      </div>

      {/* Score ring + dimensions */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
        <svg width={108} height={108} viewBox="0 0 108 108" style={{ flexShrink: 0 }}>
          <circle cx={54} cy={54} r={r} fill="none" stroke="#f0f2f5" strokeWidth={9} />
          <circle cx={54} cy={54} r={r} fill="none" stroke={sc} strokeWidth={9}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 54 54)" />
          <text x={54} y={49} textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: 'Figtree', fontSize: 24, fontWeight: 800, fill: '#344767' }}>{score}</text>
          <text x={54} y={67} textAnchor="middle"
            style={{ fontFamily: 'Figtree', fontSize: 9, fontWeight: 600, fill: '#7b809a', textTransform: 'uppercase', letterSpacing: 1 }}>SCORE</text>
        </svg>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(data.dimensions || []).map((d, i) => (
            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#7b809a', width: 100, flexShrink: 0 }}>{d.label}</span>
              <div style={{ flex: 1, height: 5, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${d.score}%`, background: DIMENSION_COLORS[i % DIMENSION_COLORS.length], borderRadius: 3, transition: 'width 0.6s ease' }} />
              </div>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: DIMENSION_COLORS[i % DIMENSION_COLORS.length], width: 24, textAlign: 'right', flexShrink: 0 }}>{d.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Raw metric pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <MetaPill label="Cache" value={`${data.cache_pct}%`} color="#2563eb" />
        <MetaPill label="Avg turns" value={data.avg_turns} color="#8b5cf6" />
        <MetaPill label="Specific" value={`${data.specific_pct}%`} color="#22c55e" />
        {data.high_ctx_sessions > 0 && (
          <MetaPill label="Long sessions" value={data.high_ctx_sessions} color="#ef4444" />
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f0f2f5', marginBottom: 16 }} />

      {/* Insight cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data.insights || []).map((item, i) => {
          const style = INSIGHT_STYLE[item.type] || INSIGHT_STYLE.info
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                width: 26, height: 26, borderRadius: 7, background: style.iconBg,
                color: style.iconColor, display: 'grid', placeItems: 'center',
                fontSize: 12, flexShrink: 0, fontWeight: 700,
              }}>{style.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#344767', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{item.title}</span>
                  {item.impact && (
                    <span style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{item.impact}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#7b809a', marginTop: 2, lineHeight: 1.4 }}>{item.text}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MetaPill({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: color + '10', border: `1px solid ${color}20`,
      borderRadius: 20, padding: '3px 8px',
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono', color }}>{value}</span>
    </div>
  )
}
