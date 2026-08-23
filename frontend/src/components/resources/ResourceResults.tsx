import { ArrowLeft, ArrowRight, SearchX } from 'lucide-react'
import type { Resource } from '@/domain/resource'
import ResourceCard from './ResourceCard'

interface ResourceResultsProps {
  resources: Resource[]
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onClear: () => void
}

export default function ResourceResults({ resources, total, page, totalPages, onPageChange, onClear }: ResourceResultsProps) {
  if (total === 0) {
    return (
      <div className="resource-empty">
        <SearchX size={32} strokeWidth={1.5} aria-hidden="true" />
        <h2>没有找到匹配的资源</h2>
        <p>换一个更短的关键词，或清除分类后再试试。</p>
        <button type="button" onClick={onClear}>清除筛选</button>
      </div>
    )
  }

  return (
    <div>
      <div className="resource-results__meta">
        <span><strong>{total}</strong> 条结果</span>
        <span>第 {page} / {totalPages} 页</span>
      </div>
      <div className="resource-results__list">
        {resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}
      </div>
      {totalPages > 1 && (
        <nav className="pagination" aria-label="资源结果分页">
          <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ArrowLeft size={16} /> 上一页
          </button>
          <span>{page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            下一页 <ArrowRight size={16} />
          </button>
        </nav>
      )}
    </div>
  )
}
