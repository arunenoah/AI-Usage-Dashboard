import React, { useEffect, useState } from 'react'

function shortName(dir) {
  if (!dir || dir === 'unknown') return 'unknown'
  return dir.split('/').filter(Boolean).pop() || dir
}

export default function ByProjectPanel({ query = '' }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`/api/stats/by-project${query}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [query])

  const rows = data?.projects || []
  const max = rows[0]?.cost_usd || 1
  const totalCost = rows.reduce((s, r) => s + r.cost_usd, 0)

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>📁</span> By Project
          </div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
            {rows.length} project{rows.length !== 1 ? 's' : ''} · <span style={{ fontFamily: 'JetBrains Mono', color: '#344767', fontWeight: 600 }}>${totalCost.toFixed(2)}</span> total
          </div>
        </div>
        <span style={{ background: '#FFF3E0', color: '#FB8C00', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>COST</span>
      </div>

      {rows.length === 0 && (
        <div style={{ color: '#9baabf', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No data for this period</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.slice(0, 8).map((row, i) => {
          const pct = max > 0 ? (row.cost_usd / max) * 100 : 0
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FB8C00', flexShrink: 0, opacity: Math.max(0.3, 1 - i * 0.1) }} />
              <span
                style={{ fontSize: 12, fontWeight: 600, color: '#344767', width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={row.project}
              >
                {shortName(row.project)}
              </span>
              <div style={{ flex: 1, height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#FB8C00', borderRadius: 3, transition: 'width 0.3s', opacity: Math.max(0.4, 1 - i * 0.08) }} />
              </div>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600, color: '#344767', width: 46, textAlign: 'right', flexShrink: 0 }}>
                ${row.cost_usd.toFixed(2)}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#9baabf', width: 28, textAlign: 'right', flexShrink: 0 }}>
                {row.sessions}s
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
