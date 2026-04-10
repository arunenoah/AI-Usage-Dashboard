import { useCallback, useEffect, useState } from 'react'
import ActivityChart from '../components/ActivityChart.jsx'
import SessionDetail from '../components/SessionDetail.jsx'
import SessionTable from '../components/SessionTable.jsx'
import StatCard from '../components/StatCard.jsx'
import ToolChart from '../components/ToolChart.jsx'
import { useWebSocket } from '../hooks/useWebSocket.js'

// ─── Date range presets ───────────────────────────────────────────────────────
const PRESETS = [
  { label: 'Today',    days: 1 },
  { label: '7 Days',   days: 7 },
  { label: '15 Days',  days: 15 },
  { label: '1 Month',  days: 30 },
  { label: '3 Months', days: 90 },
  { label: 'Custom',   days: null },
  { label: 'All',      days: 0 },
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function buildQuery(filter) {
  if (filter.from && filter.to) return `?from=${filter.from}&to=${filter.to}`
  if (filter.days === 0) return ''
  if (filter.days > 0) return `?days=${filter.days}`
  return '?days=30'
}

// ─── Date filter bar ─────────────────────────────────────────────────────────
function DateFilterBar({ filter, onChange }) {
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState(todayStr())

  function selectPreset(preset) {
    if (preset.days === null) { setShowCustom(true); return }
    setShowCustom(false)
    onChange({ days: preset.days, from: null, to: null })
  }

  function applyCustom() {
    if (!customFrom) return
    onChange({ days: null, from: customFrom, to: customTo || todayStr() })
    setShowCustom(false)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '12px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#7b809a', marginRight: 4 }}>Period:</span>
      <div style={{ display: 'flex', gap: 4, background: '#f0f2f5', borderRadius: 20, padding: '3px', flexWrap: 'wrap' }}>
        {PRESETS.map(p => {
          const isActive = p.days === null ? showCustom : !filter.from && filter.days === p.days
          return (
            <button key={p.label} onClick={() => selectPreset(p)} style={{
              padding: '5px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: isActive ? '#1A73E8' : 'transparent',
              color: isActive ? '#fff' : '#7b809a',
              transition: 'all 0.15s',
            }}>{p.label}</button>
          )
        })}
        {filter.from && (
          <button onClick={() => onChange({ days: 30, from: null, to: null })} style={{
            padding: '5px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, background: '#1A73E8', color: '#fff',
          }}>{filter.from} → {filter.to} ×</button>
        )}
      </div>
      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} max={todayStr()}
            style={{ padding: '4px 8px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12 }} />
          <span style={{ fontSize: 12, color: '#9baabf' }}>→</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} min={customFrom} max={todayStr()}
            style={{ padding: '4px 8px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12 }} />
          <button onClick={applyCustom} disabled={!customFrom}
            style={{ padding: '4px 12px', background: '#1A73E8', color: '#fff', border: 'none', borderRadius: 6, cursor: customFrom ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700 }}>
            Apply
          </button>
          <button onClick={() => setShowCustom(false)}
            style={{ padding: '4px 8px', background: 'none', color: '#9baabf', border: 'none', cursor: 'pointer', fontSize: 12 }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ─── No-data empty state ──────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '40px 32px', textAlign: 'center',
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#344767', marginBottom: 8 }}>No Copilot Chat sessions found</div>
      <div style={{ fontSize: 13, color: '#7b809a', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
        GitHub Copilot Chat sessions are read from VS Code's workspace storage.
        Start a Copilot Chat conversation in VS Code, then refresh this page.
      </div>
      <div style={{ marginTop: 20, padding: '12px 16px', background: '#f0f2f5', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 11, color: '#344767', display: 'inline-block' }}>
        %APPDATA%\Code\User\workspaceStorage\&lt;hash&gt;\chatSessions\
      </div>
    </div>
  )
}

// ─── Copilot page ─────────────────────────────────────────────────────────────
export default function Copilot() {
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [total, setTotal] = useState(0)
  const [selectedSession, setSelectedSession] = useState(null)
  const [filter, setFilter] = useState({ days: 30, from: null, to: null })

  const loadStats = useCallback((f) => {
    const q = buildQuery(f)
    fetch(`/api/copilot/stats${q}`).then(r => r.json()).then(setStats).catch(() => {})
  }, [])

  const load = useCallback(() => {
    loadStats(filter)
    fetch('/api/copilot/sessions?limit=500')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setTotal(d.total || 0) })
      .catch(() => {})
  }, [filter, loadStats])

  useEffect(() => { load() }, [load])

  const handleFilterChange = (f) => {
    setFilter(f)
    loadStats(f)
  }

  useWebSocket((msg) => {
    if (msg.type === 'session_updated' && msg.payload?.source === 'github-copilot') {
      load()
    }
  })

  const periodLabel = filter.from
    ? `${filter.from} → ${filter.to}`
    : filter.days === 0 ? 'All Time'
    : filter.days === 1 ? 'Today'
    : `Last ${filter.days} Days`

  // Unique models from sessions (ToolChart repurposed for model breakdown)
  const modelCounts = sessions.reduce((acc, s) => {
    if (s.model) acc[s.model] = (acc[s.model] || 0) + 1
    return acc
  }, {})

  const totalUserTurns = sessions.reduce((acc, s) => acc + (s.user_turns || 0), 0)
  const uniqueProjects = new Set(sessions.map(s => s.project_dir).filter(Boolean)).size
  const uniqueModels = Object.keys(modelCounts).length

  if (!stats) {
    return (
      <div style={{ padding: 40, color: '#7b809a', fontFamily: 'Figtree', fontSize: 14 }}>
        Loading Copilot sessions…
      </div>
    )
  }

  const hasData = (stats.total_all_sessions || 0) > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page title */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#344767' }}>GitHub Copilot</div>
          <span style={{ padding: '3px 10px', borderRadius: 6, background: '#E8F0FE', color: '#1A73E8', fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>ACTIVE</span>
        </div>
        <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
          Copilot Chat session analytics · <span style={{ color: '#1A73E8', fontWeight: 600 }}>{periodLabel}</span>
        </div>
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Date filter */}
          <DateFilterBar filter={filter} onChange={handleFilterChange} />

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            <StatCard
              label="Chat Sessions"
              value={stats.total_sessions}
              icon="box"
              colorClass="si-blue"
              delta={`of ${stats.total_all_sessions} total`}
            />
            <StatCard
              label="User Turns"
              value={totalUserTurns}
              icon="list"
              colorClass="si-purple"
              delta={`across ${stats.total_sessions} sessions`}
            />
            <StatCard
              label="Models Used"
              value={uniqueModels}
              icon="cpu"
              colorClass="si-orange"
              delta={Object.keys(modelCounts).join(', ').substring(0, 30) || '—'}
            />
            <StatCard
              label="Projects"
              value={uniqueProjects}
              icon="globe"
              colorClass="si-teal"
              delta="unique workspaces"
            />
          </div>

          {/* Session table */}
          <SessionTable
            sessions={sessions}
            total={total || stats.total_all_sessions}
            onSessionClick={setSelectedSession}
            projects={stats.projects || []}
          />

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <ToolChart toolCounts={stats.tool_counts || {}} />
            <ActivityChart sessions={sessions} />
          </div>

          {/* Model breakdown */}
          {Object.keys(modelCounts).length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#344767', marginBottom: 16 }}>Model Distribution</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(modelCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([model, count]) => {
                    const pct = Math.round(count / sessions.length * 100)
                    return (
                      <div key={model}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#344767' }}>
                          <span style={{ fontFamily: 'JetBrains Mono' }}>{model}</span>
                          <span style={{ color: '#7b809a' }}>{count} sessions ({pct}%)</span>
                        </div>
                        <div style={{ height: 6, background: '#f0f2f5', borderRadius: 3 }}>
                          <div style={{ height: 6, background: '#1A73E8', borderRadius: 3, width: `${pct}%`, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Session detail drawer — uses Copilot-specific turns endpoint */}
      {selectedSession && (
        <SessionDetail
          sessionId={selectedSession}
          onClose={() => setSelectedSession(null)}
          turnsApiBase="/api/copilot/sessions"
        />
      )}
    </div>
  )
}
