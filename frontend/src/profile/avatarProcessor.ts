interface AvatarBitmap {
  width: number
  height: number
  close?: () => void
}

interface AvatarProcessingOptions {
  decode?: (file: File) => Promise<AvatarBitmap>
  createCanvas?: () => HTMLCanvasElement
}

export async function processAvatar(_file: File, _options: AvatarProcessingOptions = {}): Promise<string> {
  const file = _file
  const options = _options
  if (file.size > 5 * 1024 * 1024) throw new Error('头像文件不能超过 5 MB')
  if (!file.type.startsWith('image/')) throw new Error('请选择可以读取的图片文件')

  const decode = options.decode ?? ((source: File) => createImageBitmap(source))
  let bitmap: AvatarBitmap
  try {
    bitmap = await decode(file)
  } catch {
    throw new Error('无法读取这张图片，请重新选择')
  }

  try {
    if (!bitmap.width || !bitmap.height) throw new Error('无法读取这张图片，请重新选择')
    const cropSize = Math.min(bitmap.width, bitmap.height)
    const outputSize = Math.min(512, cropSize)
    const sourceX = (bitmap.width - cropSize) / 2
    const sourceY = (bitmap.height - cropSize) / 2
    const canvas = options.createCanvas?.() ?? document.createElement('canvas')
    canvas.width = outputSize
    canvas.height = outputSize
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法处理头像')
    context.drawImage(bitmap as CanvasImageSource, sourceX, sourceY, cropSize, cropSize, 0, 0, outputSize, outputSize)
    return canvas.toDataURL('image/webp', 0.82)
  } finally {
    bitmap.close?.()
  }
}
