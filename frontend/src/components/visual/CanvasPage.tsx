import { useState, type PropsWithChildren } from 'react'

interface CanvasPageProps extends PropsWithChildren {
  src: string
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
  focalPoint?: string
}

export default function CanvasPage({ src, alt, className = '', loading = 'eager', focalPoint = 'center', children }: CanvasPageProps) {
  const [failed, setFailed] = useState(false)

  return (
    <div className={`canvas-page${failed ? ' canvas-page--fallback' : ''} ${className}`.trim()} data-testid="canvas-page">
      {!failed && (
        <img
          className="canvas-page__image"
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          style={{ objectPosition: focalPoint }}
          onError={() => setFailed(true)}
        />
      )}
      <div className="canvas-page__shade" aria-hidden="true" />
      <div className="canvas-page__content">{children}</div>
    </div>
  )
}
