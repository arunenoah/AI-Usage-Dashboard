import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STATUS_COLOR = {
  completed:   '#22c55e',
  in_progress: '#1A73E8',
  pending:     '#9baabf',
}

const STATUS_LABEL = {
  completed:   'Done',
  in_progress: 'Active',
  pending:     'Pending',
}

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || '#9baabf'
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: color + '18', color, textTransform: 'uppercase', letterSpacing: 0.5,
      flexShrink: 0,
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export default function TasksPanel() {
  const [data, setData] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) return null
  const { summary, projects } = data
  if (summary.total === 0) return null

  // Top in-progress tasks across all projects
  const activeTasks = projects
    .flatMap(p => p.tasks.filter(t => t.status === 'in_progress').map(t => ({ ...t, _proj: p.project_dir })))
    .slice(0, 3)

  // Completion ring
  const pct = summary.total > 0 ? Math.round(summary.completed / summary.total * 100) : 0
  const r = 26
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767' }}>Tasks</div>
          <div style={{ fontSize: 11, color: '#7b809a', marginTop: 2 }}>
            Across {projects.length} project{projects.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={() => navigate('/tasks')}
          style={{ fontSize: 11, fontWeight: 600, color: '#1A73E8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          View all →
        </button>
      </div>

      {/* Ring + counters */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <svg width={68} height={68} viewBox="0 0 68 68" style={{ flexShrink: 0 }}>
          <circle cx={34} cy={34} r={r} fill="none" stroke="#f0f2f5" strokeWidth={6} />
          <circle cx={34} cy={34} r={r} fill="none" stroke="#22c55e" strokeWidth={6}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 34 34)" />
          <text x={34} y={31} textAnchor="middle" style={{ fontFamily: 'Figtree', fontSize: 14, fontWeight: 800, fill: '#344767' }}>{pct}%</text>
          <text x={34} y={44} textAnchor="middle" style={{ fontFamily: 'Figtree', fontSize: 8, fontWeight: 600, fill: '#9baabf' }}>DONE</text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Completed', count: summary.completed, color: '#22c55e' },
            { label: 'In progress', count: summary.in_progress, color: '#1A73E8' },
            { label: 'Pending', count: summary.pending, color: '#9baabf' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#7b809a', width: 74 }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#344767' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <>
          <div style={{ height: 1, background: '#f0f2f5', marginBottom: 12 }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            In Progress
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeTasks.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A73E8', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#344767', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.subject}
                  </div>
                  <div style={{ fontSize: 10, color: '#9baabf', marginTop: 1 }}>
                    {t._proj.split('/').pop()}
                    {t.session_date && ` · ${t.session_date}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
