import { Filter, Search, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import type { ResourceCategoryId } from '@/domain/categories'
import CategoryTree from './CategoryTree'

interface ResourceFiltersProps {
  query: string
  category?: ResourceCategoryId
  onSearch: (query: string) => void
  onCategoryChange: (category?: ResourceCategoryId) => void
  onClear: () => void
}

export default function ResourceFilters({ query, category, onSearch, onCategoryChange, onClear }: ResourceFiltersProps) {
  const [draft, setDraft] = useState(query)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => setDraft(query), [query])

  function submit(event: FormEvent) {
    event.preventDefault()
    onSearch(draft)
  }

  return (
    <>
      <form className="resource-search" role="search" onSubmit={submit}>
        <Search size={19} aria-hidden="true" />
        <input
          type="search"
          aria-label="搜索资源"
          value={draft}
          placeholder="搜索资源名称、用途或发布单位"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">搜索</button>
      </form>
      <button
        className="mobile-filter-button"
        type="button"
        aria-label={drawerOpen ? '关闭分类筛选' : '打开分类筛选'}
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen((open) => !open)}
      >
        {drawerOpen ? <X size={18} /> : <Filter size={18} />}
        分类筛选
      </button>
      <aside className={`resource-sidebar${drawerOpen ? ' resource-sidebar--open' : ''}`} aria-label="资源分类">
        <div className="resource-sidebar__heading">
          <span>按分类浏览</span>
          {(query || category) && <button type="button" onClick={() => { setDraft(''); onClear() }}>清除筛选</button>}
        </div>
        <CategoryTree selected={category} onSelect={(value) => { onCategoryChange(value); setDrawerOpen(false) }} />
      </aside>
    </>
  )
}
