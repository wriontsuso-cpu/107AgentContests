import { describe, expect, it, vi } from 'vitest'
import { processAvatar } from './avatarProcessor'

describe('processAvatar', () => {
  it('center-crops a decoded image and limits the result to 512px WebP', async () => {
    const drawImage = vi.fn()
    const close = vi.fn()
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toDataURL: vi.fn(() => 'data:image/webp;base64,avatar'),
    }
    const file = new File(['image'], 'campus.png', { type: 'image/png' })

    const result = await processAvatar(file, {
      decode: vi.fn(async () => ({ width: 1024, height: 768, close })),
      createCanvas: () => canvas as unknown as HTMLCanvasElement,
    })

    expect(canvas).toMatchObject({ width: 512, height: 512 })
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 128, 0, 768, 768, 0, 0, 512, 512)
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/webp', 0.82)
    expect(close).toHaveBeenCalled()
    expect(result).toBe('data:image/webp;base64,avatar')
  })

  it('rejects files larger than 5 MB before decoding', async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })
    const decode = vi.fn()

    await expect(processAvatar(file, { decode })).rejects.toThrow('头像文件不能超过 5 MB')
    expect(decode).not.toHaveBeenCalled()
  })
})
