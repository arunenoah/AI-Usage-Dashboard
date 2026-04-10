import React from 'react'
import { NavLink } from 'react-router-dom'
import Icon from './Icon.jsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'home' },
  { to: '/sessions', label: 'Sessions', icon: 'list' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export default function Sidebar({ source = 'Claude Code' }) {
  return (
    <aside className="sidebar">
      <div className="sb-logo">
        <div className="sb-logo-icon">
          <Icon name="activity" className="icon-md" />
        </div>
        <div>
          <div className="sb-brand">ai-sessions</div>
          <div className="sb-brand-sub">Developer Analytics</div>
        </div>
      </div>
      <div className="sb-section">
        <span className="sb-section-label">Navigation</span>
      </div>
      <nav>
        <ul className="sb-nav">
          {navItems.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon-box">
                  <Icon name={icon} className="icon-sm" />
                </span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sb-footer">
        <div className="sb-source-badge">Source: {source}</div>
      </div>
    </aside>
  )
}
