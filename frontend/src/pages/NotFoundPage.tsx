import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageTransition from '@/components/PageTransition'

export default function NotFoundPage() {
  return (
    <PageTransition>
      <section className="empty-page shell-width">
        <span className="eyebrow">404 · 路径暂未收录</span>
        <h1>这条校园路径还没有被找到。</h1>
        <p>你可以回到首页自由探索，或让 AI 导航助手从需求出发帮你寻找。</p>
        <Link className="button button--primary" to="/">
          <ArrowLeft size={18} aria-hidden="true" />
          返回首页
        </Link>
      </section>
    </PageTransition>
  )
}
