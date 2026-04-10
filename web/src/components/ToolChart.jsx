import React from 'react'

const TOOL_COLORS = {
  Read:  '#1A73E8',
  Bash:  '#FB8C00',
  Edit:  '#4CAF50',
  Grep:  '#00BCD4',
  Glob:  '#9C27B0',
  Write: '#9baabf',
  Task:  '#F44336',
  Agent: '#E91E63',
}

function getColor(name) {
  return TOOL_COLORS[name] || '#7b809a'
}

export default function ToolChart({ toolCounts = {} }) {
  const total = Object.values(toolCounts).reduce((a, b) => a + b, 0)
  const sorted = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const max = sorted[0]?.[1] || 1

  // Anti-pattern detection: Bash:Grep ratio
  const bash = toolCounts['Bash'] || 0
  const grep = toolCounts['Grep'] || 0
  const bashGrepRatio = grep > 0 ? (bash / grep).toFixed(1) : null
  const showAntiPattern = bash > 0 && grep > 0 && bash / grep > 1.3

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>⊞</span> Tool Usage
          </div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>{total.toLocaleString()} total calls this month</div>
        </div>
        <span style={{ background: '#EBF4FF', color: '#1A73E8', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>MONTHLY</span>
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sorted.map(([name, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const color = getColor(name)
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ width: 44, fontSize: 13, fontWeight: 600, color: '#344767', flexShrink: 0 }}>{name}</span>
              <div style={{ flex: 1, height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: color, borderRadius: 3 }} />
              </div>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: '#344767', width: 40, textAlign: 'right', flexShrink: 0 }}>{count.toLocaleString()}</span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#9baabf', width: 32, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
            </div>
          )
        })}
      </div>

      {/* Anti-pattern warning */}
      {showAntiPattern && (
        <div style={{ marginTop: 20, padding: '10px 14px', background: '#FFFDE7', border: '1px solid #FFE082', borderRadius: 8, fontSize: 12, color: '#F57F17' }}>
          <strong>Anti-pattern detected:</strong> Bash:Grep ratio {bashGrepRatio}x — use the Grep tool instead of rg via Bash to save ~18% tokens.
        </div>
      )}
    </div>
  )
}
