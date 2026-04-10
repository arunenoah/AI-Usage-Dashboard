import React from 'react'
import iconSprite from '../assets/icons.svg'

export default function Icon({ name, className = 'icon', style }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <use href={`${iconSprite}#ico-${name}`} />
    </svg>
  )
}
