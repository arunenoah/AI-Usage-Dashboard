import React, { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Sessions from './pages/Sessions.jsx'
import Settings from './pages/Settings.jsx'

const SIDEBAR_EXPANDED = 240
const SIDEBAR_COLLAPSED = 68

export default function App() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sb-collapsed') === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('sb-collapsed', String(collapsed)) } catch {}
  }, [collapsed])

  const sidebarW = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED

  return (
    <div className="layout">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main
        className="main"
        style={{
          marginLeft: sidebarW,
          transition: 'margin-left 280ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
