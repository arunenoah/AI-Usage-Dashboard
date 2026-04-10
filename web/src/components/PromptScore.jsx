import React from 'react'

const DIMENSIONS = [
  { label: 'Specificity', score: 82, color: '#4CAF50' },
  { label: 'Context reuse', score: 61, color: '#FB8C00' },
  { label: 'Conciseness', score: 78, color: '#1A73E8' },
  { label: 'Session hygiene', score: 55, color: '#F44336' },
]

const INSIGHTS = [
  {
    icon: '⚠',
    iconBg: '#FFF3E0',
    iconColor: '#FB8C00',
    title: 'High Context Repetition',
    text: 'Re-explained project structure 12x this week. Add a CLAUDE.md to auto-load context.',
    impact: '-22k tok',
    impactColor: '#FB8C00',
  },
  {
    icon: '⚡',
    iconBg: '#FFF8E1',
    iconColor: '#FFC107',
    title: 'Cache Hit Below Optimal',
    text: '61% → can reach 80%+ by keeping system prompts stable between sessions.',
    impact: '-$2.40/mo',
    impactColor: '#FB8C00',
  },
  {
    icon: 'ℹ',
    iconBg: '#E3F2FD',
    iconColor: '#1A73E8',
    title: 'Context Bloat in Long Sessions',
    text: '3 sessions over 2hrs hit 70%+ context. Use /clear between unrelated tasks.',
    impact: null,
  },
  {
    icon: '✓',
    iconBg: '#E8F5E9',
    iconColor: '#4CAF50',
    title: 'Specificity Improving',
    text: 'File path references up from 54% → 82% this month. This reduces search overhead.',
    impact: null,
  },
]

export default function PromptScore({ score = 74 }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767' }}>✦ Prompt Insights</div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>Actionable optimizations</div>
        </div>
        <span style={{ background: '#FFF3E0', color: '#FB8C00', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>4 ACTIONS</span>
      </div>

      {/* Score ring + dimensions */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
        <svg width={108} height={108} viewBox="0 0 108 108" style={{ flexShrink: 0 }}>
          <circle cx={54} cy={54} r={r} fill="none" stroke="#f0f2f5" strokeWidth={9} />
          <circle cx={54} cy={54} r={r} fill="none" stroke="#1A73E8" strokeWidth={9}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 54 54)" />
          <text x={54} y={49} textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: 'Figtree', fontSize: 24, fontWeight: 800, fill: '#344767' }}>{score}</text>
          <text x={54} y={67} textAnchor="middle"
            style={{ fontFamily: 'Figtree', fontSize: 9, fontWeight: 600, fill: '#7b809a', textTransform: 'uppercase', letterSpacing: 1 }}>SCORE</text>
        </svg>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DIMENSIONS.map(d => (
            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#7b809a', width: 110, flexShrink: 0 }}>{d.label}</span>
              <div style={{ flex: 1, height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${d.score}%`, background: d.color, borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: d.color, width: 24, textAlign: 'right', flexShrink: 0 }}>{d.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f0f2f5', marginBottom: 16 }} />

      {/* Insight cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {INSIGHTS.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8, background: item.iconBg,
              color: item.iconColor, display: 'grid', placeItems: 'center',
              fontSize: 13, flexShrink: 0, fontWeight: 700
            }}>{item.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#344767', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{item.title}</span>
                {item.impact && <span style={{ color: item.impactColor, fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{item.impact}</span>}
              </div>
              <div style={{ fontSize: 11, color: '#7b809a', marginTop: 2, lineHeight: 1.4 }}>{item.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
