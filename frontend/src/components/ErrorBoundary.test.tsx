import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function Boom(): null {
  throw new Error('render failed')
}

describe('ErrorBoundary', () => {
  it('shows a recoverable state instead of an empty screen', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('页面暂时打不开')
    expect(screen.getByRole('button', { name: '刷新页面' })).toBeInTheDocument()
  })
})
