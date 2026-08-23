import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function HeroExplorer() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = query.trim()
    navigate(normalized ? `/resources?q=${encodeURIComponent(normalized)}` : '/resources')
  }

  return (
    <section className="hero" aria-labelledby="hero-title">
      <img className="hero__image" src="/brand/campus-hero.webp" alt="雪后的中国科学技术大学校园与勤奋学习红专并进石碑" />
      <div className="hero__veil" />
      <div className="hero__route" aria-hidden="true">
        <span className="hero__route-line" />
        <i className="hero__node hero__node--one" />
        <i className="hero__node hero__node--two" />
        <i className="hero__node hero__node--three" />
      </div>
      <div className="hero__content shell-width">
        <div className="hero__copy">
          <span className="hero__eyebrow">USTC CAMPUS RESOURCE ATLAS · 2026</span>
          <h1 id="hero-title">从一个需要，<br />抵达一处资源。</h1>
          <p>不必先知道部门名称。说出你想做什么，我们帮你找到科大校园里真正可用的入口。</p>
        </div>
        <div className="hero__actions">
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
            <span>已整理 1,295 条校园资源</span>
            <Link to="/assistant">
              <Sparkles size={15} aria-hidden="true" />
              让 AI 帮我梳理
            </Link>
          </div>
        </div>
      </div>
      <div className="hero__caption">东校区 · 校园风光 / 官方影像</div>
    </section>
  )
}
