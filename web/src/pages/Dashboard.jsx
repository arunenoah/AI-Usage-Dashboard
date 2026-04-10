import React, { useEffect, useState } from 'react'
import StatCard from '../components/StatCard.jsx'
import TokenChart from '../components/TokenChart.jsx'
import CostChart from '../components/CostChart.jsx'
import ToolChart from '../components/ToolChart.jsx'
import PromptScore from '../components/PromptScore.jsx'
import ActivityChart from '../components/ActivityChart.jsx'
import LiveBanner from '../components/LiveBanner.jsx'
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
  const [liveTokens, setLiveTokens] = useState(null)

  const load = () => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {})
    fetch('/api/sessions?limit=200').then(r => r.json()).then(d => setSessions(d.sessions || [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  useWebSocket((msg) => {
    if (msg.type === 'session_updated') {
      setLiveTokens(msg.payload.input_tokens)
      load()
    }
  })

  if (!stats) return <div style={{ padding: 40, color: '#7b809a', fontFamily: 'Figtree' }}>Loading sessions…</div>

  return (
    <>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">AI session analytics — Claude Code</div>
      </div>

      <LiveBanner session={stats.active_session} liveTokens={liveTokens} />

      <div className="stat-grid">
        <StatCard label="Total Sessions" value={stats.total_sessions} icon="box" colorClass="si-blue" />
        <StatCard label="Input Tokens" value={fmt(stats.total_input_tokens)} icon="bar-chart" colorClass="si-teal" />
        <StatCard label="Output Tokens" value={fmt(stats.total_output_tokens)} icon="cpu" colorClass="si-orange" />
        <StatCard label="Est. Cost" value={`$${(stats.total_cost_usd || 0).toFixed(2)}`} icon="credit-card" colorClass="si-purple" />
      </div>

      <div className="card-grid-2">
        <div className="card">
          <div className="card-strip strip-blue" />
          <div className="card-body">
            <div className="card-title">Token Usage</div>
            <div className="card-sub">Input · Output · Cache — last 30 days</div>
            <TokenChart daily={stats.daily || []} />
          </div>
        </div>
        <div className="card">
          <div className="card-strip strip-teal" />
          <div className="card-body">
            <div className="card-title">Estimated Cost</div>
            <div className="card-sub">USD per day (Sonnet pricing)</div>
            <CostChart daily={stats.daily || []} />
          </div>
        </div>
      </div>

      <div className="card-grid-2">
        <div className="card">
          <div className="card-strip strip-orange" />
          <div className="card-body">
            <div className="card-title">Prompt Optimization Score</div>
            <div className="card-sub">Based on specificity, context reuse, and session hygiene</div>
            <PromptScore score={74} />
          </div>
        </div>
        <div className="card">
          <div className="card-strip strip-purple" />
          <div className="card-body">
            <div className="card-title">Tool Distribution</div>
            <div className="card-sub">Most used tools across all sessions</div>
            <ToolChart toolCounts={stats.tool_counts || {}} />
          </div>
        </div>
      </div>

      <div className="card card-mb">
        <div className="card-strip strip-blue" />
        <div className="card-body">
          <div className="card-title">Hourly Activity</div>
          <div className="card-sub">Session starts by hour of day</div>
          <ActivityChart sessions={sessions} />
        </div>
      </div>
    </>
  )
}
