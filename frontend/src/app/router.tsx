import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import AppShell from '@/layout/AppShell'

const AssistantPage = lazy(() => import('@/pages/AssistantPage'))
const HomePage = lazy(() => import('@/pages/HomePage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const ResourceDetailPage = lazy(() => import('@/pages/ResourceDetailPage'))
const ResourcesPage = lazy(() => import('@/pages/ResourcesPage'))

function page(element: ReactNode) {
  return <Suspense fallback={<div className="route-loading" role="status">正在准备页面…</div>}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: page(<HomePage />) },
      { path: 'resources', element: page(<ResourcesPage />) },
      { path: 'resources/:id', element: page(<ResourceDetailPage />) },
      { path: 'assistant', element: page(<AssistantPage />) },
      { path: '*', element: page(<NotFoundPage />) },
    ],
  },
])
