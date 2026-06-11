const DEFAULT_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234a90d9'/%3E%3Cstop offset='100%25' style='stop-color:%23357abd'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='46' fill='url(%23g)'/%3E%3Ccircle cx='50' cy='50' r='32' fill='none' stroke='white' stroke-width='3' opacity='0.9'/%3E%3Ccircle cx='50' cy='50' r='4' fill='white'/%3E%3Cline x1='50' y1='18' x2='50' y2='14' stroke='white' stroke-width='3' stroke-linecap='round' opacity='0.8'/%3E%3C/svg%3E"

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
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  if (!url) {
    link.href = DEFAULT_FAVICON
    link.type = 'image/svg+xml'
    return
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

export { DEFAULT_FAVICON, detectFaviconType, updateFavicon, SITE_CACHE_KEY, getCachedSiteConfig }