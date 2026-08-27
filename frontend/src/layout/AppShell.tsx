import { Menu, Sparkles, UserRound, X } from 'lucide-react'
import { type PropsWithChildren, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import BrandMark from '@/components/BrandMark'
import { useProfile } from '@/profile/ProfileContext'

const navigation = [
  { to: '/', label: '首页', end: true },
  { to: '/resources', label: '资源大厅', end: false },
  { to: '/assistant', label: 'AI 导航', end: false },
]

export default function AppShell({ children }: PropsWithChildren) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { activeProfile } = useProfile()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="site-header">
        <div className="shell-width site-header__inner">
          <BrandMark />
          <nav className={`site-nav${menuOpen ? ' site-nav--open' : ''}`} aria-label="主要导航">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => isActive ? 'site-nav__link site-nav__link--active' : 'site-nav__link'}
              >
                {item.label}
              </NavLink>
            ))}
            <NavLink className="site-nav__assistant" to="/assistant" onClick={() => setMenuOpen(false)}>
              <Sparkles size={16} aria-hidden="true" />
              帮我找资源
            </NavLink>
            <NavLink className="site-nav__profile" to="/profile" onClick={() => setMenuOpen(false)}>
              <UserRound size={16} aria-hidden="true" />
              {activeProfile?.nickname ?? '创建档案'}
            </NavLink>
          </nav>
          <button
            className="menu-button"
            type="button"
            aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children ?? <Outlet />}
      </main>
      <footer className="site-footer">
        <div className="shell-width site-footer__inner">
          <div>
            <strong>USTC Navigator</strong>
            <p>让校园资源更容易被看见、理解和使用。</p>
          </div>
          <div className="site-footer__meta">
            <span>学生参赛项目 · 非正式校务系统</span>
            <span>资源信息以原发布单位页面为准</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
