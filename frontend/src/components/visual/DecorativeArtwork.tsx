import { useState } from 'react'
import { assetUrl } from '@/lib/assetUrl'

export default function DecorativeArtwork({ src, className = '' }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false)

  return (
    <img
      src={assetUrl(src)}
      alt=""
      role="presentation"
      aria-hidden="true"
      className={`decorative-artwork ${className}`.trim()}
      hidden={failed}
      onError={() => setFailed(true)}
    />
  )
}
