import React, { useEffect, useState } from 'react'

function fmtTok(n) {
  if (!n) return '0'
  if (n >= 1_000_000_000) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1e3).toFixed(0)}K`
  return `${n}`
}

function shortModel(m) {
  return m.replace('claude-', '').replace(/-20\d{6}$/, '').replace('google/', '').replace('openai/', '').replace('qwen/', '')
}

const MODEL_COLORS = {
  'sonnet': '#1A73E8',
  'haiku': '#00BCD4',
  'opus': '#7B1FA2',
  'gemini': '#4CAF50',
  'gpt': '#FB8C00',
  'qwen': '#F44336',
}

function modelColor(m) {
  const low = m.toLowerCase()
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (low.includes(key)) return color
  }
  return '#9baabf'
}

const TABS = ['Overview', 'Models', 'Todos']

export default function SystemInfoCard() {
  const [info, setInfo] = useState(null)
  const [tab, setTab] = useState('Overview')

  useEffect(() => {
    fetch('/api/system').then(r => r.json()).then(setInfo).catch(() => {})
  }, [])

  if (!info) return null

  const maxModelCost = Math.max(...(info.model_usage || []).map(m => m.est_cost_usd), 1)

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767' }}>Claude Code Config</div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
            {info.first_session_date ? `Since ${info.first_session_date}` : 'From ~/.claude/'}
            {info.total_messages_all_time > 0 && ` · ${info.total_messages_all_time.toLocaleString()} messages`}
          </div>
        </div>
        {info.always_thinking_enabled && (
          <span style={{ background: '#E8F5E9', color: '#2E7D32', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
            Extended Thinking ON
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f0f2f5', margin: '12px -24px 0' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', fontSize: 12, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
            color: tab === t ? '#1A73E8' : '#7b809a',
            borderBottom: tab === t ? '2px solid #1A73E8' : '2px solid transparent',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {/* OVERVIEW TAB */}
        {tab === 'Overview' && (
          <div>
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Session Files', value: info.total_session_files },
                { label: 'Projects', value: info.total_project_dirs },
                { label: 'Plans', value: info.plan_count },
                { label: 'Task Sessions', value: info.task_count },
                { label: 'Paste Cache', value: info.paste_cache_count },
                { label: 'File Versions', value: info.file_history_count },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center', padding: '10px', background: '#fafbfc', borderRadius: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#344767', fontFamily: 'JetBrains Mono' }}>{item.value}</div>
                  <div style={{ fontSize: 9, color: '#9baabf', fontWeight: 700, textTransform: 'uppercase', marginTop: 2, letterSpacing: 0.5 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Plugins */}
            {info.enabled_plugins?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Enabled Plugins</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {info.enabled_plugins.map(p => (
                    <span key={p} style={{ padding: '3px 10px', borderRadius: 6, background: '#EBF4FF', color: '#1A73E8', fontSize: 11, fontWeight: 600 }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* MCP Servers */}
            {info.mcp_servers?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>MCP Servers</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {info.mcp_servers.map(s => (
                    <span key={s} style={{ padding: '3px 10px', borderRadius: 6, background: '#F3E8FF', color: '#7B1FA2', fontSize: 11, fontWeight: 600 }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODELS TAB */}
        {tab === 'Models' && (
          <div>
            <div style={{ fontSize: 11, color: '#7b809a', marginBottom: 14 }}>
              All-time usage from <code style={{ fontFamily: 'JetBrains Mono', fontSize: 10 }}>stats-cache.json</code>
            </div>
            {(info.model_usage || []).map(m => {
              const color = modelColor(m.model)
              const barPct = maxModelCost > 0 ? (m.est_cost_usd / maxModelCost) * 100 : 0
              return (
                <div key={m.model} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#344767' }}>{shortModel(m.model)}</span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#4CAF50', fontWeight: 600 }}>
                      ${m.est_cost_usd.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ height: 5, background: '#f0f2f5', borderRadius: 3, marginBottom: 4 }}>
                    <div style={{ height: '100%', width: `${barPct}%`, background: color, borderRadius: 3 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: 'JetBrains Mono', color: '#9baabf' }}>
                    <span>in: {fmtTok(m.input_tokens)}</span>
                    <span>out: {fmtTok(m.output_tokens)}</span>
                    <span>cache↓: {fmtTok(m.cache_read_input_tokens)}</span>
                    <span>cache↑: {fmtTok(m.cache_creation_input_tokens)}</span>
                  </div>
                </div>
              )
            })}
            {(!info.model_usage || info.model_usage.length === 0) && (
              <div style={{ color: '#9baabf', textAlign: 'center', paddingTop: 20, fontSize: 12 }}>No model data available</div>
            )}
          </div>
        )}

        {/* TODOS TAB */}
        {tab === 'Todos' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: '#E8F5E9', borderRadius: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#2E7D32', fontFamily: 'JetBrains Mono' }}>{info.todos_completed}</div>
                <div style={{ fontSize: 10, color: '#4CAF50', fontWeight: 700, marginTop: 2 }}>COMPLETED</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: '#FFF3E0', borderRadius: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#E65100', fontFamily: 'JetBrains Mono' }}>{info.todos_pending}</div>
                <div style={{ fontSize: 10, color: '#FB8C00', fontWeight: 700, marginTop: 2 }}>PENDING</div>
              </div>
            </div>
            {info.recent_todos?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Recent Tasks</div>
                {info.recent_todos.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '7px 10px', borderRadius: 6, marginBottom: 4,
                    background: t.status === 'completed' ? '#F9FBE7' : '#FFF8E1',
                    border: `1px solid ${t.status === 'completed' ? '#E6EE9C' : '#FFE082'}`
                  }}>
                    <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>
                      {t.status === 'completed' ? '✅' : '⏳'}
                    </span>
                    <span style={{ fontSize: 11, color: '#344767', lineHeight: 1.4 }}>{t.content}</span>
                  </div>
                ))}
              </div>
            )}
            {(!info.recent_todos || info.recent_todos.length === 0) && (
              <div style={{ color: '#9baabf', textAlign: 'center', paddingTop: 20, fontSize: 12 }}>No tasks found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
