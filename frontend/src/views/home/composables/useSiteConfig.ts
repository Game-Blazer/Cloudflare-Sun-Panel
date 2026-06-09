import { ref } from 'vue'
import { getAbout } from '@/api/index'
import { cachedRequest } from '@/utils/requestCache'

export const SITE_CACHE_KEY = 'sun-panel-site-config'

/** 根据 URL 后缀推断 favicon 的 MIME type */
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

const DEFAULT_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234a90d9'/%3E%3Cstop offset='100%25' style='stop-color:%23357abd'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='46' fill='url(%23g)'/%3E%3Ccircle cx='50' cy='50' r='32' fill='none' stroke='white' stroke-width='3' opacity='0.9'/%3E%3Ccircle cx='50' cy='50' r='4' fill='white'/%3E%3Cline x1='50' y1='18' x2='50' y2='14' stroke='white' stroke-width='3' stroke-linecap='round' opacity='0.8'/%3E%3C/svg%3E"

export function useSiteConfig() {
  function loadCachedSiteConfig(): Panel.SiteConfig {
    try {
      const cached = localStorage.getItem(SITE_CACHE_KEY)
      if (cached) return JSON.parse(cached) as Panel.SiteConfig
    } catch {
      /* ignore */
    }
    return {}
  }

  const siteConfig = ref<Panel.SiteConfig>(loadCachedSiteConfig())
  const siteConfigLoaded = ref(false)

  // 立即用缓存值设置标题和图标
  if (siteConfig.value.site_title) {
    document.title = siteConfig.value.site_title
  }
  if (siteConfig.value.favicon_url) {
    updateFavicon(siteConfig.value.favicon_url)
  }

  function updateFavicon(url: string) {
    // 使用 rel~="icon" 同时匹配 rel="icon" 和 rel="shortcut icon"
    let link = document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null

    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }

    if (!url) {
      // 恢复默认 favicon
      link.href = DEFAULT_FAVICON
      link.type = 'image/svg+xml'
      return
    }

    // 自动推断 type 属性
    const detectedType = detectFaviconType(url)
    if (detectedType) {
      link.type = detectedType
    }

    // 添加 cache-busting 时间戳，避免浏览器缓存旧图标
    const separator = url.includes('?') ? '&' : '?'
    link.href = url + separator + '_t=' + Date.now()
  }

  async function loadSiteConfig() {
    try {
      const res = await cachedRequest('site:about', () => getAbout<Record<string, string>>(), 300)
      if (res.code === 0) {
        siteConfig.value = {
          site_title: res.data?.site_title || '',
          login_bg_image: res.data?.login_bg_image || '',
          login_blur: res.data?.login_blur !== undefined ? Number(res.data.login_blur) : 12,
          login_mask_opacity: res.data?.login_mask_opacity !== undefined ? Number(res.data.login_mask_opacity) : 0.15,
          footer_html: res.data?.footer_html || '',
          logo_text: res.data?.logo_text || '',
          logo_image_src: res.data?.logo_image_src || '',
          favicon_url: res.data?.favicon_url || '',
        }
        localStorage.setItem(SITE_CACHE_KEY, JSON.stringify(siteConfig.value))
        siteConfigLoaded.value = true
        document.title = siteConfig.value.site_title || 'Sun-Panel'
        updateFavicon(siteConfig.value.favicon_url || '')
      }
    } catch {
      /* ignore */
    }
  }

  function handleSiteConfigUpdate(config: Panel.SiteConfig) {
    siteConfig.value = config
    localStorage.setItem(SITE_CACHE_KEY, JSON.stringify(config))
    document.title = config.site_title || 'Sun-Panel'
    updateFavicon(config.favicon_url || '')
  }

  return {
    siteConfig,
    siteConfigLoaded,
    loadSiteConfig,
    handleSiteConfigUpdate,
    updateFavicon,
  }
}