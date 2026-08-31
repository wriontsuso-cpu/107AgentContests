import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <section className="detail-missing shell-width" role="alert">
        <h1>页面暂时打不开</h1>
        <p>刚才这次加载卡住了。刷新后可以继续查找校园资源。</p>
        <button className="button button--primary" type="button" onClick={() => window.location.reload()}>
          刷新页面
        </button>
      </section>
    )
  }
}
