import { createBrowserRouter } from 'react-router-dom'
import AppShell from '@/layout/AppShell'
import HomePage from '@/pages/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="empty-page shell-width">
      <span className="eyebrow">USTC Navigator</span>
      <h1>{title}</h1>
    </section>
  )
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'resources', element: <PlaceholderPage title="资源大厅" /> },
      { path: 'resources/:id', element: <PlaceholderPage title="资源详情" /> },
      { path: 'assistant', element: <PlaceholderPage title="AI 导航助手" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
