import React, { useEffect, useState } from 'react'

function shortModel(m) {
  if (!m) return 'unknown'
  // claude-sonnet-4-6 → Sonnet 4.6
  // claude-opus-4-6 → Opus 4.6
  // claude-3-5-sonnet-20241022 → Sonnet 3.5
  const lower = m.toLowerCase()
  const tier = lower.includes('opus') ? 'Opus'
    : lower.includes('sonnet') ? 'Sonnet'
    : lower.includes('haiku') ? 'Haiku'
    : m

  // Extract version number: prefer x.y pattern, fall back to first digit sequence
  const vMatch = m.match(/(\d+)[.-](\d+)/)
  const version = vMatch ? `${vMatch[1]}.${vMatch[2]}` : ''
  return version ? `${tier} ${version}` : tier
}

const MODEL_COLORS = ['#1A73E8', '#9C27B0', '#00BCD4', '#4CAF50', '#FF7043', '#E91E63']

export default function ByModelPanel({ query = '' }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`/api/stats/by-model${query}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [query])

  const rows = data?.models || []
  const maxOutput = rows.reduce((m, r) => Math.max(m, r.output_tokens), 1)

  function fmtTokens(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return `${n}`
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🤖</span> By Model
          </div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
            {rows.length} model{rows.length !== 1 ? 's' : ''} in use
          </div>
        </div>
        <span style={{ background: '#EDE7F6', color: '#9C27B0', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>OUTPUT</span>
      </div>

      {rows.length === 0 && (
        <div style={{ color: '#9baabf', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No data for this period</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.slice(0, 6).map((row, i) => {
          const color = MODEL_COLORS[i % MODEL_COLORS.length]
          const pct = maxOutput > 0 ? (row.output_tokens / maxOutput) * 100 : 0
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#344767', width: 100, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={row.model}>
                {shortModel(row.model)}
              </span>
              <div style={{ flex: 1, height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600, color: '#344767', width: 46, textAlign: 'right', flexShrink: 0 }}>
                {fmtTokens(row.output_tokens)}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#9baabf', width: 40, textAlign: 'right', flexShrink: 0 }}>
                ${row.cost_usd.toFixed(2)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
