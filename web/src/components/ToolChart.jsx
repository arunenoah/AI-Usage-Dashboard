import React, { useState } from 'react'

const TOOL_COLORS = {
  Read:  '#1A73E8',
  Bash:  '#FB8C00',
  Edit:  '#4CAF50',
  Grep:  '#00BCD4',
  Glob:  '#9C27B0',
  Write: '#FF7043',
  Task:  '#F44336',
  Agent: '#E91E63',
  NotebookEdit: '#26A69A',
}

function getColor(name) {
  return TOOL_COLORS[name] || '#7b809a'
}

function ToolSamplePanel({ tool, onClose }) {
  const [data, setData] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch(`/api/tools/${tool}/samples`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tool])

  const color = getColor(tool)
  const samples = data?.samples || []

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      zIndex: 500, display: 'flex', justifyContent: 'flex-end'
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: 520, height: '100vh', background: '#fff',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f0f2f5',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'block' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#344767' }}>{tool}</div>
              <div style={{ fontSize: 11, color: '#7b809a', marginTop: 2 }}>
                {data ? `${data.total?.toLocaleString()} total calls` : 'Loading…'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: 22, color: '#9baabf', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading && <div style={{ color: '#9baabf', textAlign: 'center', paddingTop: 40 }}>Loading samples…</div>}

          {!loading && samples.length === 0 && (
            <div style={{ color: '#9baabf', textAlign: 'center', paddingTop: 40, fontSize: 13 }}>
              No sample data captured yet.<br />
              <span style={{ fontSize: 12 }}>New sessions will be tracked automatically.</span>
            </div>
          )}

          {!loading && samples.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#344767', marginBottom: 12 }}>
                Recent {tool} calls ({samples.length} unique)
              </div>
              {samples.map((s, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 8,
                  background: color + '10', border: `1px solid ${color}30`
                }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono', fontSize: 11, color: '#344767',
                    wordBreak: 'break-all', lineHeight: 1.5
                  }}>{s.sample}</div>
                  <div style={{ fontSize: 10, color: '#9baabf', marginTop: 6 }}>
                    {s.project?.split('/').pop()} · {s.timestamp ? new Date(s.timestamp).toLocaleDateString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ToolChart({ toolCounts = {} }) {
  const [selectedTool, setSelectedTool] = useState(null)

  const total = Object.values(toolCounts).reduce((a, b) => a + b, 0)
  const sorted = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const max = sorted[0]?.[1] || 1

  const bash = toolCounts['Bash'] || 0
  const grep = toolCounts['Grep'] || 0
  const bashGrepRatio = grep > 0 ? (bash / grep).toFixed(1) : null
  const showAntiPattern = bash > 0 && grep > 0 && bash / grep > 1.3

  return (
    <>
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#344767', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>⊞</span> Tool Usage
            </div>
            <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
              {total.toLocaleString()} total calls · <span style={{ color: '#1A73E8' }}>click any tool to see details</span>
            </div>
          </div>
          <span style={{ background: '#EBF4FF', color: '#1A73E8', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>ALL TIME</span>
        </div>

        {/* Bars — clickable */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sorted.map(([name, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            const color = getColor(name)
            return (
              <div
                key={name}
                onClick={() => setSelectedTool(name)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 6, padding: '4px 6px', margin: '-4px -6px', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span style={{ width: 44, fontSize: 13, fontWeight: 600, color: '#344767', flexShrink: 0 }}>{name}</span>
                <div style={{ flex: 1, height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: '#344767', width: 40, textAlign: 'right', flexShrink: 0 }}>{count.toLocaleString()}</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#9baabf', width: 32, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                <span style={{ fontSize: 10, color: '#9baabf' }}>›</span>
              </div>
            )
          })}
        </div>

        {showAntiPattern && (
          <div style={{ marginTop: 20, padding: '10px 14px', background: '#FFFDE7', border: '1px solid #FFE082', borderRadius: 8, fontSize: 12, color: '#F57F17' }}>
            <strong>Anti-pattern:</strong> Bash:Grep ratio {bashGrepRatio}× — prefer the Grep tool over <code>rg</code> via Bash to save ~18% tokens.
          </div>
        )}
      </div>

      {selectedTool && (
        <ToolSamplePanel tool={selectedTool} onClose={() => setSelectedTool(null)} />
      )}
    </>
  )
}
