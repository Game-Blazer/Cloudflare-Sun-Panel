import { ref, watch, type Ref } from 'vue'
import { usePanelState } from '@/store'

const WALLPAPER_CACHE_KEY = 'sun-panel-effective-wallpaper'

interface PreloadGroup {
  items?: Array<{ icon?: { src?: string } | null }>
}

export function useWallpaper(
  siteConfig: Ref<Panel.SiteConfig>,
  panelState?: ReturnType<typeof usePanelState>,
) {
  const ps = panelState || usePanelState()
  const effectiveBackgroundImage = ref(localStorage.getItem(WALLPAPER_CACHE_KEY) || '')

  // 立即预加载缓存的壁纸，在 Vue 挂载前就触发浏览器下载，加速首屏渲染
  if (effectiveBackgroundImage.value) {
    preloadBackgroundImage(effectiveBackgroundImage.value)
  }

  function preloadBackgroundImage(url: string) {
    let link = document.querySelector('link[rel="preload"][as="image"][data-wallpaper]') as HTMLLinkElement | null
    if (link && link.href === url) return
    link?.remove()
    if (!url) return
    link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = url
    link.setAttribute('data-wallpaper', 'true')
    document.head.appendChild(link)
  }

  function syncEffectiveWallpaper() {
    const url = ps.panelConfig.backgroundImageSrc || siteConfig.value.login_bg_image || ''
    if (url !== effectiveBackgroundImage.value) {
      effectiveBackgroundImage.value = url
    }
    if (url) {
      localStorage.setItem(WALLPAPER_CACHE_KEY, url)
    }
  }

  /** 预加载首屏图标（前 N 个），加速图标渲染 */
  function preloadIconImages(groups: PreloadGroup[], count: number = 36) {
    let loaded = 0
    const preDecode = typeof createImageBitmap !== 'undefined'
    for (const group of groups) {
      for (const item of group.items || []) {
        if (loaded >= count) return
        if (!item.icon?.src) continue
        // 1. <link rel="preload"> 触发浏览器预下载
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'image'
        link.href = item.icon.src
        link.setAttribute('data-icon-preload', 'true')
        document.head.appendChild(link)
        // 2. pre-decode 图片（后台线程解码，不会阻塞主线程渲染）
        if (preDecode) {
          fetch(item.icon.src, { mode: 'cors' })
            .then((r) => r.blob())
            .then((blob) => createImageBitmap(blob))
            .catch(() => {})
        }
        loaded++
      }
    }
  }

  watch(
    effectiveBackgroundImage,
    (newUrl, oldUrl) => {
      if (newUrl && newUrl !== oldUrl) {
        preloadBackgroundImage(newUrl)
      }
    },
  )

  return {
    effectiveBackgroundImage,
    syncEffectiveWallpaper,
    preloadIconImages,
  }
}