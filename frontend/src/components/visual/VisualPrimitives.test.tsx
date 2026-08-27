import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CanvasPage from './CanvasPage'
import DecorativeArtwork from './DecorativeArtwork'
import GlassPanel from './GlassPanel'

describe('visual primitives', () => {
  it('keeps the source image fully present and exposes a fallback when it fails', () => {
    render(<CanvasPage src="/brand/test.webp" alt="测试场景"><p>内容</p></CanvasPage>)
    const canvas = screen.getByTestId('canvas-page')
    const image = screen.getByRole('img', { name: '测试场景' })
    expect(canvas).toHaveClass('canvas-page')
    expect(image).toHaveClass('canvas-page__image')
    fireEvent.error(image)
    expect(canvas).toHaveClass('canvas-page--fallback')
    expect(screen.getByText('内容')).toBeVisible()
  })

  it('renders named warm and navy glass surfaces', () => {
    const { rerender } = render(<GlassPanel tone="warm">搜索</GlassPanel>)
    expect(screen.getByText('搜索')).toHaveClass('glass-panel', 'glass-panel--warm')
    rerender(<GlassPanel tone="navy" as="aside">分类</GlassPanel>)
    expect(screen.getByText('分类').tagName).toBe('ASIDE')
    expect(screen.getByText('分类')).toHaveClass('glass-panel--navy')
  })

  it('keeps decorative artwork non-semantic and hides it after a load failure', () => {
    const { container } = render(<DecorativeArtwork src="/brand/decorative-cat.svg" className="cat-doodle" />)
    const image = container.querySelector('img')!
    expect(image).toHaveAttribute('alt', '')
    fireEvent.error(image)
    expect(image).not.toBeVisible()
  })
})
