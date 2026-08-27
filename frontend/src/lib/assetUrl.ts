export function joinBasePath(basePath: string, assetPath: string) {
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`
  return `${normalizedBase}${assetPath.replace(/^\/+/, '')}`
}

export function assetUrl(assetPath: string) {
  return joinBasePath(import.meta.env.BASE_URL, assetPath)
}
