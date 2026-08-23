import {
  ArrowUpRight,
  Atom,
  BookOpen,
  Coffee,
  HeartPulse,
  Landmark,
  Route,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { resourceCounts } from '@/data/resources'
import { RESOURCE_CATEGORIES } from '@/domain/categories'

const icons: Record<string, LucideIcon> = {
  landmark: Landmark,
  'book-open': BookOpen,
  atom: Atom,
  trophy: Trophy,
  'users-round': UsersRound,
  coffee: Coffee,
  'heart-pulse': HeartPulse,
  route: Route,
}

export default function CategoryAtlas() {
  return (
    <section className="atlas shell-width" aria-labelledby="atlas-title">
      <header className="section-heading">
        <div>
          <span className="eyebrow">EXPLORE BY NEED · 按需求探索</span>
          <h2 id="atlas-title">科大很大，入口可以很清楚。</h2>
        </div>
        <p>从八个方向自由探索。每一条路径最终都回到资源原页面，让信息可追溯、可确认。</p>
      </header>
      <div className="atlas__grid">
        {RESOURCE_CATEGORIES.map((category, index) => {
          const Icon = icons[category.icon]
          return (
            <Link
              key={category.id}
              className={`category-tile category-tile--${index + 1}`}
              to={`/resources?category=${category.id}`}
              style={{ '--category-accent': category.accent } as CSSProperties}
            >
              <div className="category-tile__topline">
                <span>{category.index}</span>
                <Icon size={24} strokeWidth={1.6} aria-hidden="true" />
              </div>
              <div>
                <h3>{category.label}</h3>
                <p>{category.description}</p>
              </div>
              <div className="category-tile__footer">
                <span>{resourceCounts[category.id]} 项资源</span>
                <ArrowUpRight size={19} aria-hidden="true" />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
