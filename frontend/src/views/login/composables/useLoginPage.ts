import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getAbout } from '@/api/index'
import { useAuthStore } from '@/store/modules/auth'

const LOGIN_BG_CACHE_KEY = 'sun-panel-login-bg'
const LOGIN_STYLE_CACHE_KEY = 'sun-panel-login-style'
const SITE_CACHE_KEY = 'sun-panel-site-config'

const DEFAULT_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234a90d9'/%3E%3Cstop offset='100%25' style='stop-color:%23357abd'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='46' fill='url(%23g)'/%3E%3Ccircle cx='50' cy='50' r='32' fill='none' stroke='white' stroke-width='3' opacity='0.9'/%3E%3Ccircle cx='50' cy='50' r='4' fill='white'/%3E%3Cline x1='50' y1='18' x2='50' y2='14' stroke='white' stroke-width='3' stroke-linecap='round' opacity='0.8'/%3E%3C/svg%3E"

interface CachedLoginStyle {
  blur: number
  opacity: number
}
function getCachedLoginStyle(): CachedLoginStyle {
  try {
    const cached = localStorage.getItem(LOGIN_STYLE_CACHE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch {
    /* ignore */
  }
  return { blur: 12, opacity: 0.15 }
}

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

function preloadLoginBg(url: string) {
  document.querySelector('link[data-login-bg]')?.remove()
  if (!url) return
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = url
  link.setAttribute('data-login-bg', 'true')
  document.head.appendChild(link)
}

// 模块级：从缓存恢复配置，避免 API 返回前显示默认值
const cachedLoginBg = localStorage.getItem(LOGIN_BG_CACHE_KEY) || ''
const cachedStyle = getCachedLoginStyle()

const loginBgImage = ref(cachedLoginBg)
if (cachedLoginBg) {
  preloadLoginBg(cachedLoginBg)
}

// 从站点缓存恢复标题和图标
let cachedTitle = 'Sun-Panel'
let cachedFavicon = ''
try {
  const siteCache = JSON.parse(localStorage.getItem(SITE_CACHE_KEY) || '{}')
  if (siteCache.site_title) cachedTitle = siteCache.site_title
  if (siteCache.favicon_url) cachedFavicon = siteCache.favicon_url
} catch { /* ignore */ }

// 立即应用缓存的标题和图标（浏览器标签页）
document.title = cachedTitle
updateFavicon(cachedFavicon)

export function useLoginPage() {
  const router = useRouter()
  const authStore = useAuthStore()

  const hasPublicMode = ref(false)
  const siteTitle = ref(cachedTitle)
  const pageLoading = ref(true)

  const loginPageStyle = computed(() => {
    const bgImage = loginBgImage.value
    if (bgImage) {
      return {
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#0d1b2a', // 深色兜底，图片加载期间不闪白
        transform: 'translateZ(0)',
        willChange: 'transform',
      }
    }
    // 无自定义背景时显示渐变（与首页壁纸风格一致）
    return {
      background: 'linear-gradient(to bottom right, #0d1b2a, #1a1a2e)',
    }
  })

  // 先从缓存恢复登录卡片样式，避免 API 返回前闪现默认值
  const loginBlur = ref(cachedStyle.blur)
  const loginMaskOpacity = ref(cachedStyle.opacity)

  const loginCardStyle = computed(() => {
    return {
      '--glass-blur': `${loginBlur.value}px`,
      '--glass-bg-hover': `rgba(255, 255, 255, ${loginMaskOpacity.value})`,
    } as Record<string, string>
  })

  async function initLoginPage() {
    // 优先使用缓存：若已知公开模式可用且无 token，直接跳转，消除 API 等待延迟
    if (localStorage.getItem('sun-panel-public-mode') === '1' && !localStorage.getItem('sun-panel-token')) {
      const skipAutoRedirect = sessionStorage.getItem('sun-panel-skip-redirect')
      if (!skipAutoRedirect) {
        authStore.setGuestMode(null)
        router.push('/')
        // 后台异步更新最新配置（不阻塞跳转）
        getAbout<Record<string, string>>().then((res) => {
          if (res.code === 0 && res.data) {
            applyAboutResponse(res.data)
          }
        }).catch(() => {})
        return
      }
    }

    try {
      const res = await getAbout<Record<string, string>>()
      if (res.code === 0 && res.data) {
        applyAboutResponse(res.data)
      }
    } catch {
      /* ignore */
    } finally {
      pageLoading.value = false
    }
  }

  function applyAboutResponse(data: Record<string, string>) {
    const hasPublic = !!(data.panel_public_user_id || data.default_guest_mode === '1')
    if (hasPublic) {
      hasPublicMode.value = true
      localStorage.setItem('sun-panel-public-mode', '1')
      if (!localStorage.getItem('sun-panel-token')) {
        const skipAutoRedirect = sessionStorage.getItem('sun-panel-skip-redirect')
        if (!skipAutoRedirect) {
          authStore.setGuestMode(null)
          router.push('/')
          return
        }
      }
    } else {
      localStorage.setItem('sun-panel-public-mode', '0')
    }
    if (data.site_title) {
      siteTitle.value = data.site_title
      document.title = data.site_title
    }
    // 应用自定义图标到浏览器标签页
    if (data.favicon_url !== undefined) {
      localStorage.setItem(
        SITE_CACHE_KEY,
        JSON.stringify({ ...JSON.parse(localStorage.getItem(SITE_CACHE_KEY) || '{}'), favicon_url: data.favicon_url }),
      )
      updateFavicon(data.favicon_url || '')
    }
    // 使用站点设置中的登录页背景图片
    const bgUrl = data.login_bg_image || ''
    if (bgUrl) {
      // 缓存 URL 用于下次访问
      localStorage.setItem(LOGIN_BG_CACHE_KEY, bgUrl)
      // 添加 <link rel="preload"> 提示浏览器提前下载
      preloadLoginBg(bgUrl)
      // 立即设置背景 URL，不要等图片加载完再切换（否则会闪现默认渐变）
      // CSS background-image 会自然地在图片下载完成后显示，无需手动 onload
      loginBgImage.value = bgUrl
    }
    // 读取登录卡片模糊度和遮罩不透明度设置
    if (data.login_blur !== undefined) {
      loginBlur.value = Number(data.login_blur)
    }
    if (data.login_mask_opacity !== undefined) {
      loginMaskOpacity.value = Number(data.login_mask_opacity)
    }
    // 缓存样式用于下次访问
    localStorage.setItem(
      LOGIN_STYLE_CACHE_KEY,
      JSON.stringify({
        blur: loginBlur.value,
        opacity: loginMaskOpacity.value,
      }),
    )
  }

  return {
    hasPublicMode,
    siteTitle,
    pageLoading,
    loginBgImage,
    loginBlur,
    loginMaskOpacity,
    loginPageStyle,
    loginCardStyle,
    initLoginPage,
  }
}
