import React from 'react'
import Icon from './Icon.jsx'

export default function LiveBanner({ session, liveTokens }) {
  if (!session) return null
  const display = liveTokens ?? session.total_usage?.input_tokens ?? 0
  return (
    <div className="live-banner">
      <span className="live-dot" />
      <span className="live-label">Live</span>
      <span className="live-text">
        Active session in <strong>{session.project_dir?.split('/').pop() || 'project'}</strong>
      </span>
      <Icon name="zap" className="icon-sm" />
      <span className="live-token">{display.toLocaleString()} tokens</span>
    </div>
  )
}
