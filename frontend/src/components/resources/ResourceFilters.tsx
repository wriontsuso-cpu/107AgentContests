import { Clock3, Filter, Search, Trash2, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import type { ResourceCategoryId } from '@/domain/categories'
import type { LocalSearchRecord } from '@/profile/types'
import CategoryTree from './CategoryTree'

interface ResourceFiltersProps {
  query: string
  category?: ResourceCategoryId
  group?: string
  tag?: string
  tags: string[]
  onSearch: (query: string) => void
  onCategoryChange: (category?: ResourceCategoryId) => void
  onGroupChange: (group?: string) => void
  onTagChange: (tag?: string) => void
  onClear: () => void
  recentSearches?: LocalSearchRecord[]
  onDeleteSearch?: (searchId: string) => void
}

export default function ResourceFilters({ query, category, group, tag, tags, onSearch, onCategoryChange, onGroupChange, onTagChange, onClear, recentSearches = [], onDeleteSearch }: ResourceFiltersProps) {
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
      {recentSearches.length > 0 && <section className="resource-search-history" aria-label="最近搜索">
        <header><Clock3 size={14} /><span>最近搜索</span></header>
        <ul>{recentSearches.slice(0, 6).map((search) => <li key={search.id}>
          <button type="button" onClick={() => { setDraft(search.query); onSearch(search.query) }}>{search.query}</button>
          <button type="button" title="删除搜索记录" aria-label={`删除搜索记录：${search.query}`} onClick={() => onDeleteSearch?.(search.id)}><Trash2 size={13} /></button>
        </li>)}</ul>
      </section>}
      <div className="resource-tag-filter">
        <label htmlFor="resource-tag">标签</label>
        <select id="resource-tag" value={tag ?? ''} onChange={(event) => onTagChange(event.target.value || undefined)}>
          <option value="">全部标签</option>
          {tags.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
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
          {(query || category || group || tag) && <button type="button" onClick={() => { setDraft(''); onClear() }}>清除筛选</button>}
        </div>
        <CategoryTree selected={category} selectedGroup={group}
          onSelect={(value) => { onCategoryChange(value); if (!value) setDrawerOpen(false) }}
          onSelectGroup={(value) => { onGroupChange(value); setDrawerOpen(false) }} />
      </aside>
    </>
  )
}
