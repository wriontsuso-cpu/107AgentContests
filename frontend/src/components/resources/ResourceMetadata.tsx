import { BadgeCheck, CalendarDays, CircleDollarSign, Waypoints } from 'lucide-react'
import type { Resource } from '@/domain/resource'

function formatDate(value?: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}

export default function ResourceMetadata({ resource }: { resource: Resource }) {
  const date = formatDate(resource.publishedAt ?? resource.updatedAt)
  const items = [
    { icon: BadgeCheck, label: '信息来源', value: resource.source.label, note: resource.source.authority },
    ...(date ? [{ icon: CalendarDays, label: resource.publishedAt ? '发布日期' : '数据更新', value: date }] : []),
    ...(resource.cost ? [{ icon: CircleDollarSign, label: '费用说明', value: resource.cost }] : []),
    ...(resource.accessType ? [{ icon: Waypoints, label: '访问方式', value: resource.accessType }] : []),
  ]

  return (
    <dl className="resource-metadata">
      {items.map(({ icon: Icon, label, value, note }) => (
        <div key={label}>
          <dt><Icon size={17} strokeWidth={1.7} />{label}</dt>
          <dd>{value}{note && <small>{note}</small>}</dd>
        </div>
      ))}
    </dl>
  )
}
