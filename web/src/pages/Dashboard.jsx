import React, { useEffect, useState, useCallback } from 'react'
import StatCard from '../components/StatCard.jsx'
import TokenChart from '../components/TokenChart.jsx'
import ToolChart from '../components/ToolChart.jsx'
import PromptScore from '../components/PromptScore.jsx'
import ActivityChart from '../components/ActivityChart.jsx'
import LiveBanner from '../components/LiveBanner.jsx'
import SessionTable from '../components/SessionTable.jsx'
import ContextHealth from '../components/ContextHealth.jsx'
import SessionDetail from '../components/SessionDetail.jsx'
import SystemInfoCard from '../components/SystemInfoCard.jsx'
import RecentPrompts from '../components/RecentPrompts.jsx'
import { useWebSocket } from '../hooks/useWebSocket.js'

// ─── Date range presets ───────────────────────────────────────────────────────
const PRESETS = [
  { label: 'Today',   days: 1 },
  { label: '7 Days',  days: 7 },
  { label: '15 Days', days: 15 },
  { label: '1 Month', days: 30 },
  { label: '3 Months',days: 90 },
  { label: 'Custom',  days: null },
  { label: 'All',     days: 0 },
]

function fmt(n) {
  if (!n) return '0'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

// Build query string from date filter state
function buildQuery(filter) {
  if (filter.from && filter.to) {
    return `?from=${filter.from}&to=${filter.to}`
  }
  if (filter.days === 0) return '' // all time
  if (filter.days > 0) return `?days=${filter.days}`
  return '?days=30' // fallback
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ─── Date filter bar ─────────────────────────────────────────────────────────
function DateFilterBar({ filter, onChange }) {
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState(todayStr())

  const activeLabel = filter.from
    ? `${filter.from} → ${filter.to || 'today'}`
    : PRESETS.find(p => p.days === filter.days)?.label || 'All'

  function selectPreset(preset) {
    if (preset.days === null) {
      setShowCustom(true)
      return
    }
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
          const isActive = p.days === null
            ? showCustom
            : !filter.from && filter.days === p.days
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
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            max={todayStr()}
            style={{ padding: '4px 8px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
          <span style={{ fontSize: 12, color: '#9baabf' }}>→</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            min={customFrom} max={todayStr()}
            style={{ padding: '4px 8px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [total, setTotal] = useState(0)
  const [liveTokens, setLiveTokens] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [filter, setFilter] = useState({ days: 30, from: null, to: null })

  const loadStats = useCallback((f) => {
    const q = buildQuery(f)
    fetch(`/api/stats${q}`).then(r => r.json()).then(setStats).catch(() => {})
  }, [])

  const load = useCallback(() => {
    loadStats(filter)
    fetch('/api/sessions?limit=500')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setTotal(d.total || 0) })
      .catch(() => {})
  }, [filter, loadStats])

  useEffect(() => { load() }, [load])

  const handleFilterChange = (f) => {
    setFilter(f)
    loadStats(f)
  }

  // Token chart date range comes from the global filter
  const handleChartRangeChange = (days) => {
    const f = { days, from: null, to: null }
    setFilter(f)
    loadStats(f)
  }

  useWebSocket((msg) => {
    if (msg.type === 'session_updated') {
      setLiveTokens(msg.payload.input_tokens)
      load()
    }
  })

  if (!stats) return (
    <div style={{ padding: 40, color: '#7b809a', fontFamily: 'Figtree', fontSize: 14 }}>Loading sessions…</div>
  )

  const totalTokens = (stats.total_cache_read_tokens || 0) + (stats.total_cache_creation_tokens || 0) +
    (stats.total_input_tokens || 0) + (stats.total_output_tokens || 0)

  const periodLabel = filter.from
    ? `${filter.from} → ${filter.to}`
    : filter.days === 0 ? 'All Time'
    : filter.days === 1 ? 'Today'
    : `Last ${filter.days} Days`

  // Useful derived metrics
  const cacheEfficiency = stats.total_cache_read_tokens > 0
    ? Math.round((stats.total_cache_read_tokens / (stats.total_cache_read_tokens + stats.total_input_tokens)) * 100)
    : 0

  const currentDays = filter.from ? null : filter.days

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page title */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#344767' }}>Dashboard</div>
        <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
          AI session analytics — Claude Code · <span style={{ color: '#1A73E8', fontWeight: 600 }}>{periodLabel}</span>
        </div>
      </div>

      {/* Global date filter */}
      <DateFilterBar filter={filter} onChange={handleFilterChange} />

      <LiveBanner session={stats.active_session} liveTokens={liveTokens} />

      {/* Stat cards — developer-meaningful metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        <StatCard
          label="Sessions"
          value={stats.total_sessions}
          icon="box"
          colorClass="si-blue"
          delta={filter.days !== 0 ? `of ${stats.total_all_sessions} total` : undefined}
        />
        <StatCard
          label="Total Spend"
          value={`$${(stats.total_cost_usd || 0).toFixed(2)}`}
          icon="credit-card"
          colorClass="si-purple"
          delta={`avg $${(stats.avg_session_cost_usd || 0).toFixed(2)} / session`}
        />
        <StatCard
          label="Output Generated"
          value={fmt(stats.total_output_tokens)}
          icon="cpu"
          colorClass="si-orange"
          delta={`${fmt(stats.total_input_tokens)} fresh input`}
        />
        <StatCard
          label="Cache Efficiency"
          value={`${cacheEfficiency}%`}
          icon="bar-chart"
          colorClass="si-teal"
          delta={`${fmt(stats.total_cache_read_tokens)} tokens reused`}
        />
      </div>

      {/* Token chart — synced with global date filter */}
      <TokenChart
        daily={stats.daily || []}
        totalTokens={totalTokens}
        currentDays={currentDays}
        onRangeChange={handleChartRangeChange}
      />

      {/* Session explorer + Prompt insights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20 }}>
        <SessionTable
          sessions={sessions}
          total={total || stats.total_sessions}
          onSessionClick={setSelectedSession}
          projects={stats.projects || []}
        />
        <PromptScore score={74} />
      </div>

      {/* Tool usage + Hourly activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ToolChart toolCounts={stats.tool_counts || {}} />
        <ActivityChart sessions={sessions} />
      </div>

      {/* Conversations */}
      <RecentPrompts onSessionClick={setSelectedSession} />

      {/* Context health + System info */}
      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20 }}>
        <ContextHealth sessions={sessions} />
        <SystemInfoCard />
      </div>

      {/* Session detail drawer */}
      {selectedSession && (
        <SessionDetail sessionId={selectedSession} onClose={() => setSelectedSession(null)} />
      )}
    </div>
  )
}
