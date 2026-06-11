function detectFaviconType(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'svg': return 'image/svg+xml'
    case 'png': return 'image/png'
    case 'ico': return 'image/x-icon'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    default: return ''
  }
}

function updateFavicon(url: string) {
  let link = document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null
  if (!url) {
    if (link) link.remove()
    return
  }
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  const detectedType = detectFaviconType(url)
  if (detectedType) {
    link.type = detectedType
  }
  const separator = url.includes('?') ? '&' : '?'
  link.href = url + separator + '_t=' + Date.now()
}

const SITE_CACHE_KEY = 'sun-panel-site-config'

function getCachedSiteConfig(): Panel.SiteConfig {
  try {
    const cached = localStorage.getItem(SITE_CACHE_KEY)
    if (cached) return JSON.parse(cached) as Panel.SiteConfig
  } catch { /* ignore */ }
  return {}
}

export { detectFaviconType, updateFavicon, SITE_CACHE_KEY, getCachedSiteConfig }