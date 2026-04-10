import React from 'react'

function contextFillPct(session) {
  // Estimate context fill: total tokens used / 200k context window
  const totalTokens = (session.total_usage?.input_tokens || 0) +
                      (session.total_usage?.output_tokens || 0)
  return Math.min(100, Math.round((totalTokens / 200_000) * 100))
}

function fillColor(pct) {
  if (pct >= 80) return '#F44336'
  if (pct >= 50) return '#FB8C00'
  return '#4CAF50'
}

function relTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (m < 2) return 'now'
  if (h < 1) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  return `${d}d`
}

export default function ContextHealth({ sessions = [] }) {
  // Take top 5 most recent sessions
  const top5 = sessions.slice(0, 5)
  const criticals = top5.filter(s => contextFillPct(s) >= 90)

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>◑</span> Context Health
          </div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>Window fill per session</div>
        </div>
        <span style={{ background: '#E0F7FA', color: '#00ACC1', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>LIVE</span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f0f2f5', marginBottom: 16 }} />

      {/* Session fill rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {top5.map((s, i) => {
          const pct = contextFillPct(s)
          const color = fillColor(pct)
          const branch = s.project_dir?.split('/').pop() || s.id?.slice(0, 8) || '—'
          const time = relTime(s.end_time || s.start_time)
          return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0',
              borderBottom: i < top5.length - 1 ? '1px solid #f0f2f5' : 'none'
            }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#7b809a', width: 150, flexShrink: 0 }}>
                {branch} · {time}
              </span>
              <div style={{ flex: 1, height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
              </div>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color, width: 36, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
            </div>
          )
        })}
      </div>

      {/* Warning for critical sessions */}
      {criticals.length > 0 && (
        <div style={{
          marginTop: 16, padding: '12px 14px',
          background: '#FFF5F5', border: '1px solid #FFCDD2',
          borderRadius: 10
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#C62828', marginBottom: 4 }}>
            ⚠ {contextFillPct(criticals[0])}% context on {criticals[0].project_dir?.split('/').pop() || 'session'}
          </div>
          <div style={{ fontSize: 12, color: '#E53935', lineHeight: 1.5 }}>
            Session likely truncated. Use{' '}
            <code style={{
              background: '#FFEBEE', color: '#C62828', padding: '1px 6px',
              borderRadius: 4, fontFamily: 'JetBrains Mono', fontSize: 11
            }}>/clear</code>
            {' '}between unrelated tasks.
          </div>
        </div>
      )}
    </div>
  )
}
