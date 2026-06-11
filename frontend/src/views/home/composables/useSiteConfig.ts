import { ref } from 'vue'
import { getAbout } from '@/api/index'
import { cachedRequest } from '@/utils/requestCache'
import { DEFAULT_FAVICON, detectFaviconType, updateFavicon, SITE_CACHE_KEY, getCachedSiteConfig } from '@/utils/faviconUtils'

export { SITE_CACHE_KEY }

export function useSiteConfig() {
  function loadCachedSiteConfig(): Panel.SiteConfig {
    return getCachedSiteConfig()
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