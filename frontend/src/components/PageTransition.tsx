import type { PropsWithChildren } from 'react'

export default function PageTransition({ children }: PropsWithChildren) {
  return <div className="page-enter">{children}</div>
}
