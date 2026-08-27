import { Link } from 'react-router-dom'
import { assetUrl } from '@/lib/assetUrl'

interface BrandMarkProps {
  inverse?: boolean
}

export default function BrandMark({ inverse = false }: BrandMarkProps) {
  return (
    <Link className={`brand-mark${inverse ? ' brand-mark--inverse' : ''}`} to="/" aria-label="USTC Navigator 首页">
      <img src={assetUrl('/brand/ustc-mark.webp')} alt="中国科学技术大学校徽" />
      <span className="brand-mark__type">
        <strong>USTC Navigator</strong>
        <small>科大校园资源导航</small>
      </span>
    </Link>
  )
}
