import { createBrowserRouter } from 'react-router-dom'
import AppShell from '@/layout/AppShell'
import AssistantPage from '@/pages/AssistantPage'
import HomePage from '@/pages/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'
import ResourceDetailPage from '@/pages/ResourceDetailPage'
import ResourcesPage from '@/pages/ResourcesPage'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'resources', element: <ResourcesPage /> },
      { path: 'resources/:id', element: <ResourceDetailPage /> },
      { path: 'assistant', element: <AssistantPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
