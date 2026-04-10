import React, { useEffect, useState } from 'react'
import StatCard from '../components/StatCard.jsx'
import TokenChart from '../components/TokenChart.jsx'
import ToolChart from '../components/ToolChart.jsx'
import PromptScore from '../components/PromptScore.jsx'
import ActivityChart from '../components/ActivityChart.jsx'
import LiveBanner from '../components/LiveBanner.jsx'
import SessionTable from '../components/SessionTable.jsx'
import ContextHealth from '../components/ContextHealth.jsx'
import { useWebSocket } from '../hooks/useWebSocket.js'

function fmt(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [total, setTotal] = useState(0)
  const [liveTokens, setLiveTokens] = useState(null)

  const load = () => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {})
    fetch('/api/sessions?limit=200')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setTotal(d.total || 0) })
      .catch(() => {})
  }

  useEffect(() => { load() }, [])

  useWebSocket((msg) => {
    if (msg.type === 'session_updated') {
      setLiveTokens(msg.payload.input_tokens)
      load()
    }
  })

  if (!stats) return (
    <div style={{ padding: 40, color: '#7b809a', fontFamily: 'Figtree', fontSize: 14 }}>
      Loading sessions…
    </div>
  )

  const totalTokens = (stats.total_input_tokens || 0) + (stats.total_output_tokens || 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#344767' }}>Dashboard</div>
        <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>AI session analytics — Claude Code</div>
      </div>

      {/* Live banner */}
      <LiveBanner session={stats.active_session} liveTokens={liveTokens} />

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        <StatCard label="Total Sessions" value={total || stats.total_sessions} icon="box" colorClass="si-blue" />
        <StatCard label="Input Tokens" value={fmt(stats.total_input_tokens)} icon="bar-chart" colorClass="si-teal" />
        <StatCard label="Output Tokens" value={fmt(stats.total_output_tokens)} icon="cpu" colorClass="si-orange" />
        <StatCard label="Est. Cost" value={`$${(stats.total_cost_usd || 0).toFixed(2)}`} icon="credit-card" colorClass="si-purple" />
      </div>

      {/* Token usage chart — full width */}
      <TokenChart daily={stats.daily || []} totalTokens={totalTokens} />

      {/* Session explorer + Prompt insights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20 }}>
        <SessionTable sessions={sessions} total={total || stats.total_sessions} />
        <PromptScore score={74} />
      </div>

      {/* Tool usage + Hourly activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ToolChart toolCounts={stats.tool_counts || {}} />
        <ActivityChart sessions={sessions} />
      </div>

      {/* Context health */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20 }}>
        <ContextHealth sessions={sessions} />
        <div />
      </div>
    </div>
  )
}
