import React, { useEffect, useState, useRef } from 'react'

function fmtMs(ms) {
  if (!ms) return null
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function fmtTokens(n) {
  if (!n) return '0'
  if (n >= 1_000_000_000) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1000).toFixed(0)}k`
  return `${n}`
}

function calcTurnCost(usage) {
  if (!usage) return 0
  return usage.input_tokens / 1e6 * 3 +
    usage.output_tokens / 1e6 * 15 +
    (usage.cache_read_input_tokens || 0) / 1e6 * 0.30 +
    (usage.cache_creation_input_tokens || 0) / 1e6 * 3.75
}

const TOOL_COLOR = {
  Read: '#1A73E8', Bash: '#FB8C00', Edit: '#4CAF50', Grep: '#00BCD4',
  Glob: '#9C27B0', Write: '#FF7043', Task: '#F44336', Agent: '#E91E63',
  NotebookEdit: '#26A69A',
}

// Derive structured facts from all turns
function analyzeSession(turns) {
  const filesWritten = new Set()
  const filesEdited = new Set()
  const filesRead = new Set()
  const subagents = []
  const bashCommands = []

  turns.forEach(turn => {
    if (turn.role !== 'assistant' || !turn.tool_inputs) return
    Object.entries(turn.tool_inputs).forEach(([key, val]) => {
      if (key.startsWith('Write:')) filesWritten.add(val)
      else if (key.startsWith('Edit:')) filesEdited.add(val)
      else if (key.startsWith('Read:')) filesRead.add(val)
      else if (key.startsWith('Agent:') || key === 'Agent') {
        subagents.push(val)
      } else if (key === 'Bash') bashCommands.push(val)
    })
  })

  return {
    filesWritten: [...filesWritten],
    filesEdited: [...filesEdited],
    filesRead: [...filesRead],
    subagents,
    bashCommands,
  }
}

const TABS = ['Timeline', 'Files', 'Subagents']

export default function SessionDetail({ sessionId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Timeline')

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    setTab('Timeline')
    fetch(`/api/sessions/${sessionId}/turns`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [sessionId])

  const handleBackdrop = e => {
    if (e.target === e.currentTarget) onClose()
  }

  if (!sessionId) return null

  const session = data?.session
  const turns = data?.turns || []
  const totalCost = turns.reduce((acc, t) => acc + calcTurnCost(t.usage), 0)
  const maxDuration = Math.max(...turns.map(t => t.duration_ms || 0))
  const analysis = analyzeSession(turns)

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        zIndex: 500, display: 'flex', justifyContent: 'flex-end'
      }}
    >
      <div style={{
        width: 680, height: '100vh', background: '#fff',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#344767' }}>Session Detail</div>
            {session && (
              <div style={{ fontSize: 11, color: '#7b809a', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                {session.project_dir?.split('/').pop()} · {session.git_branch || 'main'} · {session.model?.split('-').slice(1, 3).join('-') || ''}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ fontSize: 22, color: '#9baabf', padding: '0 4px', lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none' }}>×</button>
        </div>

        {/* Summary strip */}
        {session && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            padding: '12px 24px', background: '#fafbfc',
            borderBottom: '1px solid #f0f2f5', gap: 8
          }}>
            {[
              { label: 'Turns', value: session.user_turns },
              { label: 'Cache Read', value: fmtTokens(session.total_usage?.cache_read_input_tokens) },
              { label: 'Cache Write', value: fmtTokens(session.total_usage?.cache_creation_input_tokens) },
              { label: 'Est. Cost', value: `$${totalCost.toFixed(4)}` },
              { label: 'Slowest Turn', value: fmtMs(session.max_turn_duration_ms) || '—' },
              { label: 'Avg Turn', value: fmtMs(session.avg_turn_duration_ms) || '—' },
              { label: 'Output Tokens', value: fmtTokens(session.total_usage?.output_tokens) },
              { label: 'Fresh Input', value: fmtTokens(session.total_usage?.input_tokens) },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.8 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#344767', fontFamily: 'JetBrains Mono', marginTop: 2 }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f0f2f5', padding: '0 24px' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
              color: tab === t ? '#1A73E8' : '#7b809a',
              borderBottom: tab === t ? '2px solid #1A73E8' : '2px solid transparent',
            }}>
              {t}
              {t === 'Files' && (analysis.filesWritten.length + analysis.filesEdited.length) > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, background: '#EBF4FF', color: '#1A73E8', borderRadius: 10, padding: '1px 6px' }}>
                  {analysis.filesWritten.length + analysis.filesEdited.length}
                </span>
              )}
              {t === 'Subagents' && analysis.subagents.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, background: '#FCE4EC', color: '#E91E63', borderRadius: 10, padding: '1px 6px' }}>
                  {analysis.subagents.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading && <div style={{ color: '#9baabf', textAlign: 'center', paddingTop: 40 }}>Loading…</div>}

          {/* TIMELINE TAB */}
          {!loading && tab === 'Timeline' && turns.map((turn, i) => {
            const isUser = turn.role === 'user'
            const isSlowest = !isUser && turn.duration_ms === maxDuration && maxDuration > 0
            const turnCost = calcTurnCost(turn.usage)

            return (
              <div key={i} style={{
                marginBottom: 12,
                borderRadius: 10,
                border: isSlowest ? '1px solid #FFCDD2' : '1px solid #f0f2f5',
                background: isSlowest ? '#FFF8F8' : isUser ? '#fafbfc' : '#fff',
                overflow: 'hidden'
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  borderBottom: '1px solid #f0f2f5',
                  background: isUser ? 'rgba(26,115,232,0.04)' : 'transparent'
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 4, display: 'grid', placeItems: 'center',
                    background: isUser ? '#EBF4FF' : '#F3E8FF',
                    fontSize: 10, fontWeight: 800,
                    color: isUser ? '#1A73E8' : '#7B1FA2',
                    flexShrink: 0
                  }}>{isUser ? 'U' : 'A'}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#7b809a', flex: 1 }}>
                    {isUser ? 'User' : (turn.model?.includes('sonnet') ? 'Sonnet' : turn.model?.includes('haiku') ? 'Haiku' : 'Claude')}
                    {turn.timestamp && ` · ${new Date(turn.timestamp).toLocaleTimeString()}`}
                  </span>
                  {!isUser && turn.duration_ms > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono',
                      color: isSlowest ? '#F44336' : '#7b809a',
                      background: isSlowest ? '#FFEBEE' : '#f0f2f5',
                      padding: '2px 6px', borderRadius: 4
                    }}>⏱ {fmtMs(turn.duration_ms)}{isSlowest ? ' ← slowest' : ''}</span>
                  )}
                  {!isUser && turnCost > 0 && (
                    <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: '#4CAF50', fontWeight: 600 }}>
                      ${turnCost.toFixed(4)}
                    </span>
                  )}
                </div>

                <div style={{ padding: '10px 12px' }}>
                  {turn.text && (
                    <div style={{ fontSize: 12, color: '#344767', lineHeight: 1.6, marginBottom: turn.tool_calls?.length ? 8 : 0 }}>
                      {turn.text}
                    </div>
                  )}
                  {turn.tool_calls?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {[...new Set(turn.tool_calls)].map((tool, j) => {
                        const count = turn.tool_calls.filter(t => t === tool).length
                        return (
                          <span key={j} style={{
                            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                            background: (TOOL_COLOR[tool] || '#9baabf') + '18',
                            color: TOOL_COLOR[tool] || '#9baabf',
                            fontFamily: 'JetBrains Mono'
                          }}>{tool}{count > 1 ? ` ×${count}` : ''}</span>
                        )
                      })}
                    </div>
                  )}
                  {turn.usage && (
                    <div style={{
                      display: 'flex', gap: 12, marginTop: 8,
                      paddingTop: 8, borderTop: '1px solid #f0f2f5',
                      fontSize: 10, fontFamily: 'JetBrains Mono', color: '#9baabf'
                    }}>
                      <span>in: <strong style={{ color: '#344767' }}>{fmtTokens(turn.usage.input_tokens)}</strong></span>
                      <span>out: <strong style={{ color: '#344767' }}>{fmtTokens(turn.usage.output_tokens)}</strong></span>
                      <span>cache↑: <strong style={{ color: '#FB8C00' }}>{fmtTokens(turn.usage.cache_creation_input_tokens)}</strong></span>
                      <span>cache↓: <strong style={{ color: '#4CAF50' }}>{fmtTokens(turn.usage.cache_read_input_tokens)}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* FILES TAB */}
          {!loading && tab === 'Files' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {analysis.filesWritten.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#FF7043', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📄</span> Created / Written ({analysis.filesWritten.length})
                  </div>
                  {analysis.filesWritten.map((f, i) => (
                    <div key={i} style={{ padding: '7px 12px', borderRadius: 6, background: '#FBE9E7', marginBottom: 4, fontFamily: 'JetBrains Mono', fontSize: 11, color: '#BF360C' }}>
                      {f}
                    </div>
                  ))}
                </div>
              )}
              {analysis.filesEdited.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#4CAF50', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>✏️</span> Edited ({analysis.filesEdited.length})
                  </div>
                  {analysis.filesEdited.map((f, i) => (
                    <div key={i} style={{ padding: '7px 12px', borderRadius: 6, background: '#E8F5E9', marginBottom: 4, fontFamily: 'JetBrains Mono', fontSize: 11, color: '#1B5E20' }}>
                      {f}
                    </div>
                  ))}
                </div>
              )}
              {analysis.filesRead.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1A73E8', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>👁</span> Read ({analysis.filesRead.length})
                  </div>
                  {analysis.filesRead.map((f, i) => (
                    <div key={i} style={{ padding: '7px 12px', borderRadius: 6, background: '#EBF4FF', marginBottom: 4, fontFamily: 'JetBrains Mono', fontSize: 11, color: '#0D47A1' }}>
                      {f}
                    </div>
                  ))}
                </div>
              )}
              {analysis.filesWritten.length === 0 && analysis.filesEdited.length === 0 && analysis.filesRead.length === 0 && (
                <div style={{ color: '#9baabf', textAlign: 'center', paddingTop: 40, fontSize: 13 }}>No file operations recorded</div>
              )}
              {analysis.bashCommands.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#FB8C00', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>$</span> Bash Commands ({analysis.bashCommands.length})
                  </div>
                  {analysis.bashCommands.map((cmd, i) => (
                    <div key={i} style={{ padding: '7px 12px', borderRadius: 6, background: '#FFF3E0', marginBottom: 4, fontFamily: 'JetBrains Mono', fontSize: 11, color: '#E65100' }}>
                      {cmd}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUBAGENTS TAB */}
          {!loading && tab === 'Subagents' && (
            <div>
              {analysis.subagents.length === 0 ? (
                <div style={{ color: '#9baabf', textAlign: 'center', paddingTop: 40, fontSize: 13 }}>
                  No subagents dispatched in this session
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#E91E63', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🤖</span> Subagents dispatched ({analysis.subagents.length})
                  </div>
                  {analysis.subagents.map((desc, i) => (
                    <div key={i} style={{
                      padding: '12px 16px', borderRadius: 8, background: '#FCE4EC',
                      border: '1px solid #F8BBD0', marginBottom: 8
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#880E4F', marginBottom: 4 }}>Agent #{i + 1}</div>
                      <div style={{ fontSize: 12, color: '#C2185B', fontFamily: 'Figtree', lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && turns.length === 0 && tab === 'Timeline' && (
            <div style={{ color: '#9baabf', textAlign: 'center', paddingTop: 40 }}>No turns found</div>
          )}
        </div>
      </div>
    </div>
  )
}
