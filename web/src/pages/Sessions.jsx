import React, { useEffect, useState } from 'react'
import SessionTable from '../components/SessionTable.jsx'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetch('/api/sessions?limit=200')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setTotal(d.total || 0) })
      .catch(() => {})
  }, [])

  return (
    <>
      <div className="page-header">
        <div className="page-title">Session Explorer</div>
        <div className="page-subtitle">{total} sessions loaded from Claude Code</div>
      </div>
      <div className="card">
        <div className="card-strip strip-blue" />
        <div className="card-body">
          <SessionTable sessions={sessions} />
        </div>
      </div>
    </>
  )
}
