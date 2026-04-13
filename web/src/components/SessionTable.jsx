import React, { useState, useMemo } from 'react'

const TOOL_BADGE = {
  'claude-code': { label: 'CLAUDE', bg: '#EDE7F6', color: '#7B1FA2' },
  cursor:        { label: 'CURSOR', bg: '#E3F2FD', color: '#1565C0' },
  copilot:       { label: 'COPILOT', bg: '#F5F5F5', color: '#616161' },
  windsurf:      { label: 'WINDSURF', bg: '#E8F5E9', color: '#2E7D32' },
}

function toolBadge(source) {
  const b = TOOL_BADGE[source] || TOOL_BADGE['claude-code']
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: b.bg, color: b.color, fontSize: 10, fontWeight: 800, fontFamily: 'Figtree', letterSpacing: 0.5 }}>
      {b.label}
    </span>
  )
}

function branchBadge(branch) {
  const isMain = branch === 'main' || branch === 'master'
  const isFeat = branch?.startsWith('feat') || branch?.startsWith('fix')
  const bg = isMain ? '#F5F5F5' : isFeat ? '#E8F5E9' : '#EBF4FF'
  const color = isMain ? '#616161' : isFeat ? '#2E7D32' : '#1565C0'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: bg, color, fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
      {branch || 'main'}
    </span>
  )
}

function scoreColor(score) {
  if (score >= 75) return '#4CAF50'
  if (score >= 55) return '#FB8C00'
  return '#F44336'
}

function fmtTokens(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

function calcCost(usage) {
  if (!usage) return 0
  return usage.input_tokens / 1e6 * 3 +
         usage.output_tokens / 1e6 * 15 +
         (usage.cache_read_input_tokens || 0) / 1e6 * 0.30 +
         (usage.cache_creation_input_tokens || 0) / 1e6 * 3.75
}

function calcScore(session) {
  const turns = session.user_turns || 1
  const tokens = session.total_usage?.input_tokens || 0
  const tokPerTurn = tokens / turns
  let score = 80
  if (turns > 60) score -= 20
  else if (turns > 30) score -= 10
  if (tokPerTurn > 50000) score -= 15
  if (session.total_usage?.cache_read_input_tokens > session.total_usage?.input_tokens * 0.3) score += 10
  return Math.max(20, Math.min(99, score))
}

function shortProject(dir) {
  if (!dir) return '—'
  const parts = dir.replace(/^\//, '').split('/')
  return parts[parts.length - 1] || dir
}

export default function SessionTable({ sessions = [], total = 0, onSessionClick, projects = [] }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('All')
  const [selectedProject, setSelectedProject] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  const tabs = ['All', 'Claude', 'Cursor', 'Copilot']

  const filtered = useMemo(() => sessions.filter(s => {
    const q = query.toLowerCase()
    const matchQ = !q || s.project_dir?.toLowerCase().includes(q) || s.first_prompt?.toLowerCase().includes(q) || s.git_branch?.toLowerCase().includes(q)
    const matchTab = tab === 'All' ||
      (tab === 'Claude' && s.source === 'claude-code') ||
      (tab === 'Cursor' && s.source === 'cursor') ||
      (tab === 'Copilot' && s.source === 'copilot')
    const matchProject = selectedProject === 'all' || s.project_dir === selectedProject
    return matchQ && matchTab && matchProject
  }), [sessions, query, tab, selectedProject])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleProjectChange = (p) => {
    setSelectedProject(p)
    setPage(1)
  }

  // Unique sorted project names for the dropdown
  const projectOptions = useMemo(() => {
    const dirs = [...new Set(sessions.map(s => s.project_dir).filter(Boolean))]
    return dirs.sort()
  }, [sessions])

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767' }}>Session Explorer</div>
          <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
            {selectedProject === 'all' ? 'All projects' : shortProject(selectedProject)} — {filtered.length} sessions
          </div>
        </div>
        <span style={{ background: '#EBF4FF', color: '#1A73E8', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>
          {total} TOTAL
        </span>
      </div>

      {/* Project filter dropdown */}
      <div style={{ marginBottom: 12 }}>
        <select
          value={selectedProject}
          onChange={e => handleProjectChange(e.target.value)}
          style={{
            width: '100%', padding: '7px 10px', border: '1px solid #f0f2f5', borderRadius: 8,
            fontSize: 12, color: '#344767', outline: 'none', background: '#fafbfc',
            fontFamily: 'Figtree', cursor: 'pointer',
          }}
        >
          <option value="all">All Projects ({sessions.length})</option>
          {projectOptions.map(p => (
            <option key={p} value={p}>
              {shortProject(p)} ({sessions.filter(s => s.project_dir === p).length})
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #f0f2f5', marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1) }} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
            color: tab === t ? '#1A73E8' : '#7b809a',
            borderBottom: tab === t ? '2px solid #1A73E8' : '2px solid transparent',
            marginBottom: -2, transition: 'all 0.15s'
          }}>{t}</button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9baabf', fontSize: 13 }}>#</span>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search by prompt, branch, project..."
            style={{
              width: '100%', padding: '7px 12px 7px 26px',
              border: '1px solid #f0f2f5', borderRadius: 8,
              fontSize: 12, color: '#344767', outline: 'none',
              background: '#fafbfc', fontFamily: 'Figtree',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['TOOL', 'FIRST MESSAGE', 'PROJECT', 'BRANCH', 'COST', 'SCORE'].map(col => (
                <th key={col} style={{
                  padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                  color: '#9baabf', letterSpacing: 0.8, borderBottom: '1px solid #f0f2f5',
                  whiteSpace: 'nowrap'
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map(s => {
              const cost = calcCost(s.total_usage)
              const score = calcScore(s)
              const branch = s.git_branch || 'main'
              return (
                <tr key={s.id}
                  onClick={() => onSessionClick?.(s.id)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '10px 10px' }}>{toolBadge(s.source)}</td>
                  <td style={{ padding: '10px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#344767' }}>
                    {s.first_prompt || '—'}
                  </td>
                  <td style={{ padding: '10px 10px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, color: '#7b809a', fontFamily: 'JetBrains Mono' }}>
                      {shortProject(s.project_dir)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 10px' }}>{branchBadge(branch)}</td>
                  <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', fontSize: 11, color: '#4CAF50', fontWeight: 600 }}>
                    ${cost.toFixed(3)}
                  </td>
                  <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: scoreColor(score) }}>
                    {score}
                  </td>
                </tr>
              )
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#9baabf', fontSize: 12 }}>
                  No sessions match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '4px 12px', border: '1px solid #f0f2f5', borderRadius: 6, background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#9baabf' : '#344767', fontSize: 12 }}>
            ‹ Prev
          </button>
          <span style={{ fontSize: 12, color: '#7b809a' }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ padding: '4px 12px', border: '1px solid #f0f2f5', borderRadius: 6, background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#9baabf' : '#344767', fontSize: 12 }}>
            Next ›
          </button>
        </div>
      )}
    </div>
  )
}
