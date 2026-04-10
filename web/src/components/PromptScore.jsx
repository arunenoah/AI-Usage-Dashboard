import React from 'react'

const INSIGHTS = [
  { color: '#F44336', text: 'Add more context to prompts — average specificity score is low.' },
  { color: '#FB8C00', text: 'Sessions exceed 60 turns. Consider starting fresh sessions to reduce cache misses.' },
  { color: '#4CAF50', text: 'Cache reuse is healthy — keep priming context at session start.' },
  { color: '#1A73E8', text: 'Use clearer tool intent: "Read file X to find Y" outperforms vague reads.' },
]

export default function PromptScore({ score = 74 }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div className="score-ring-wrap">
      <svg width={132} height={132} viewBox="0 0 132 132" style={{ flexShrink: 0 }}>
        <circle cx={66} cy={66} r={r} fill="none" stroke="#f0f2f5" strokeWidth={10} />
        <circle cx={66} cy={66} r={r} fill="none" stroke="#1A73E8" strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 66 66)" />
        <text x={66} y={60} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: 'JetBrains Mono', fontSize: 28, fontWeight: 700, fill: '#344767' }}>{score}</text>
        <text x={66} y={82} textAnchor="middle"
          style={{ fontFamily: 'Figtree', fontSize: 10, fontWeight: 600, fill: '#7b809a' }}>/ 100</text>
      </svg>
      <ul className="insights">
        {INSIGHTS.map((item, i) => (
          <li key={i} className="insight-item">
            <span className="insight-dot" style={{ background: item.color }} />
            <span className="insight-text">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
