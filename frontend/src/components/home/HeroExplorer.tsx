import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { totalResourceCount } from '@/data/catalogMetadata'

export default function HeroExplorer() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = query.trim()
    navigate(normalized ? `/resources?q=${encodeURIComponent(normalized)}` : '/resources')
  }

  return (
    <section className="home-snow-hero shell-width" aria-labelledby="hero-title">
      <div className="photo-entry__copy">
        <span className="photo-entry__eyebrow">USTC CAMPUS GUIDE · 校园生活指南</span>
        <h1 id="hero-title" aria-label="今天，想在科大做点什么？">
          <span className="headline-line" data-testid="headline-line">今天，想在科大</span>
          <span className="headline-line" data-testid="headline-line">做点什么？</span>
        </h1>
      </div>
      <div className="photo-entry__actions">
        <form className="hero-search" role="search" onSubmit={handleSubmit}>
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            value={query}
            aria-label="搜索校园资源"
            placeholder="试试“图书馆预约”或“参加科创竞赛”"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" aria-label="搜索">
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </form>
        <div className="hero__under-search">
          <span>已整理 {totalResourceCount.toLocaleString('zh-CN')} 条校园资源</span>
          <Link to="/assistant">
            <Sparkles size={15} aria-hidden="true" />
            让 AI 帮我梳理
          </Link>
        </div>
      </div>
    </section>
  )
}
