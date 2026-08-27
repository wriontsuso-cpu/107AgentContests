import { createElement, type ElementType, type HTMLAttributes, type PropsWithChildren } from 'react'

interface GlassPanelProps extends PropsWithChildren<HTMLAttributes<HTMLElement>> {
  tone: 'warm' | 'navy'
  as?: ElementType
}

export default function GlassPanel({ tone, as = 'div', className = '', children, ...props }: GlassPanelProps) {
  return createElement(as, { ...props, className: `glass-panel glass-panel--${tone} ${className}`.trim() }, children)
}
