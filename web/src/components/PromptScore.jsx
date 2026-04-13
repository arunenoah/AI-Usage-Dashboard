import React, { useEffect, useState } from 'react'

const TIER_COLOR = {
  Expert:       '#22c55e',
  Advanced:     '#1A73E8',
  Intermediate: '#f59e0b',
  Beginner:     '#ef4444',
}

const TIER_BG = {
  Expert:       '#F0FDF4',
  Advanced:     '#EBF3FF',
  Intermediate: '#FFF8E6',
  Beginner:     '#FEECEC',
}

const DIMENSION_COLORS = ['#22c55e', '#2563eb', '#f59e0b', '#8b5cf6']

const INSIGHT_STYLE = {
  warning: { icon: '⚠', iconBg: '#FFF3E0', iconColor: '#f59e0b' },
  error:   { icon: '✕', iconBg: '#FEECEC', iconColor: '#ef4444' },
  info:    { icon: 'ℹ', iconBg: '#EFF6FF', iconColor: '#2563eb' },
  success: { icon: '✓', iconBg: '#F0FDF4', iconColor: '#22c55e' },
}

const TIER_CRITERIA = {
  Expert:       'Output >3×  ·  Ownership >25%  ·  Specificity >60%  ·  Avg turns <12',
  Advanced:     'Output >2×  ·  Ownership >15%  ·  Specificity >40%  ·  Avg turns <20',
  Intermediate: 'Output >1×  ·  Ownership >8%   ·  Specificity >20%  ·  Avg turns <35',
  Beginner:     'Below Intermediate thresholds on one or more dimensions',
}

export default function PromptScore({ days = 30 }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiExpanded, setAiExpanded] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  function fetchInsights(refresh = false) {
    setLoading(!data) // only full-screen load on first fetch
    const url = `/api/insights?days=${days}${refresh ? '&refresh=1' : ''}`
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); setRefreshing(false) })
      .catch(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { fetchInsights() }, [days])

  // Poll until AI analysis arrives (ai_loading = true means background job running)
  useEffect(() => {
    if (!data?.ai_loading) return
    const timer = setTimeout(() => fetchInsights(), 6000)
    return () => clearTimeout(timer)
  }, [data?.ai_loading])

  if (loading) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ fontSize: 12, color: '#9baabf' }}>Computing insights…</span>
      </div>
    )
  }
  if (!data) return null

  const tier = data.tier || 'Beginner'
  const score = data.score || 25
  const tierColor = TIER_COLOR[tier] || '#9baabf'
  const tierBg = TIER_BG[tier] || '#f8f9fa'

  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

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
        <span style={{
          background: tierBg, color: tierColor,
          fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 20,
          letterSpacing: 0.3,
        }}>
          {tier.toUpperCase()}
        </span>
      </div>

      {/* Score ring + dimensions */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={108} height={108} viewBox="0 0 108 108">
            <circle cx={54} cy={54} r={r} fill="none" stroke="#f0f2f5" strokeWidth={9} />
            <circle cx={54} cy={54} r={r} fill="none" stroke={tierColor} strokeWidth={9}
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 54 54)" />
            <text x={54} y={46} textAnchor="middle"
              style={{ fontFamily: 'Figtree', fontSize: 11, fontWeight: 700, fill: tierColor }}>{tier}</text>
            <text x={54} y={62} textAnchor="middle"
              style={{ fontFamily: 'Figtree', fontSize: 9, fontWeight: 600, fill: '#9baabf', letterSpacing: 0.5 }}>TIER</text>
          </svg>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {(data.dimensions || []).map((d, i) => (
            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: '#7b809a' }}>{d.label}</span>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 700, color: DIMENSION_COLORS[i % 4] }}>{d.value}</span>
                    <span style={{
                      fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 8,
                      background: (TIER_COLOR[d.tier] || '#9baabf') + '18', color: TIER_COLOR[d.tier] || '#9baabf',
                    }}>{d.tier}</span>
                  </div>
                </div>
                <div style={{ height: 5, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${d.score}%`,
                    background: DIMENSION_COLORS[i % 4], borderRadius: 3,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier criteria */}
      <div style={{ background: tierBg, borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
        <span style={{ fontSize: 10, color: tierColor, fontWeight: 600 }}>
          {tier} criteria: </span>
        <span style={{ fontSize: 10, color: '#7b809a' }}>{TIER_CRITERIA[tier]}</span>
        {actionCount > 0 && (
          <span style={{ marginLeft: 8, background: '#FFF3E0', color: '#f59e0b', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8 }}>
            {actionCount} action{actionCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Raw metric pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <MetaPill label="Output ratio" value={`${data.output_ratio}×`} color="#2563eb" />
        <MetaPill label="Avg turns" value={data.avg_turns} color="#8b5cf6" />
        <MetaPill label="Specific" value={`${data.specific_pct}%`} color="#22c55e" />
        {data.high_ctx_sessions > 0 && (
          <MetaPill label="Long sessions" value={data.high_ctx_sessions} color="#ef4444" />
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f0f2f5', marginBottom: 16 }} />

      {/* Insight cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
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

      {/* AI Analysis section */}
      <div style={{ borderTop: '1px solid #f0f2f5', paddingTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <button
            onClick={() => setAiExpanded(x => !x)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#344767' }}>✦ AI Analysis</span>
            <span style={{ fontSize: 10, color: '#9baabf' }}>{aiExpanded ? '▲' : '▼'}</span>
          </button>
          <button
            onClick={() => { setRefreshing(true); fetchInsights(true) }}
            disabled={refreshing}
            style={{
              fontSize: 10, fontWeight: 600, color: refreshing ? '#9baabf' : '#1A73E8',
              background: 'none', border: 'none', cursor: refreshing ? 'default' : 'pointer',
            }}
          >
            {refreshing ? 'Analyzing…' : '↻ Refresh'}
          </button>
        </div>

        {aiExpanded && (
          <>
            {data.ai_loading && !data.ai_analysis && (
              <div style={{ padding: '16px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#9baabf', marginBottom: 4 }}>Haiku is analyzing your prompts…</div>
                <div style={{ fontSize: 10, color: '#c4cdd6' }}>This takes ~10 seconds. Refresh in a moment.</div>
              </div>
            )}

            {data.ai_analysis && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Tier justification */}
                {data.ai_analysis.tier_justification && (
                  <div style={{ fontSize: 11, color: '#7b809a', fontStyle: 'italic', lineHeight: 1.5, background: '#f8f9fa', borderRadius: 8, padding: '8px 12px' }}>
                    "{data.ai_analysis.tier_justification}"
                  </div>
                )}

                {/* Top improvements */}
                {(data.ai_analysis.top_improvements || []).map((imp, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, background: imp.impact === 'high' ? '#FFF3E0' : '#EFF6FF',
                      color: imp.impact === 'high' ? '#f59e0b' : '#2563eb',
                      display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#344767', marginBottom: 3 }}>{imp.pattern}</div>
                      {imp.example_fix && (
                        <div style={{ fontSize: 10, color: '#7b809a', fontFamily: 'JetBrains Mono', lineHeight: 1.5, background: '#f8f9fa', borderRadius: 6, padding: '4px 8px' }}>
                          {imp.example_fix}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Rewrite */}
                {data.ai_analysis.rewrite && (
                  <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Example Rewrite</div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>BEFORE</div>
                      <div style={{ fontSize: 11, color: '#7b809a', fontFamily: 'JetBrains Mono', lineHeight: 1.5 }}>{data.ai_analysis.rewrite.original}</div>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', marginBottom: 3 }}>AFTER</div>
                      <div style={{ fontSize: 11, color: '#344767', fontFamily: 'JetBrains Mono', lineHeight: 1.5 }}>{data.ai_analysis.rewrite.improved}</div>
                    </div>
                    {data.ai_analysis.rewrite.why && (
                      <div style={{ fontSize: 10, color: '#9baabf', marginTop: 6, fontStyle: 'italic' }}>{data.ai_analysis.rewrite.why}</div>
                    )}
                  </div>
                )}

                {/* Strengths */}
                {(data.ai_analysis.strengths || []).length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Strengths</div>
                    {data.ai_analysis.strengths.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ color: '#22c55e', fontSize: 11, marginTop: 1 }}>✓</span>
                        <span style={{ fontSize: 11, color: '#7b809a', lineHeight: 1.4 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Analysis timestamp */}
                {data.ai_analysis.analyzed_at && (
                  <div style={{ fontSize: 9, color: '#c4cdd6', textAlign: 'right' }}>
                    Analyzed {new Date(data.ai_analysis.analyzed_at).toLocaleString()} · {data.ai_analysis.prompt_count} prompts sampled
                  </div>
                )}
              </div>
            )}
          </>
        )}
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
