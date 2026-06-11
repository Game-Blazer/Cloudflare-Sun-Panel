import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getAbout } from '@/api/index'
import { useAuthStore } from '@/store/modules/auth'
import { DEFAULT_FAVICON, detectFaviconType, updateFavicon, getCachedSiteConfig, SITE_CACHE_KEY } from '@/utils/faviconUtils'

const LOGIN_BG_CACHE_KEY = 'sun-panel-login-bg'
const LOGIN_STYLE_CACHE_KEY = 'sun-panel-login-style'

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
const cachedSiteConfig = getCachedSiteConfig()
const cachedTitle = cachedSiteConfig.site_title || 'Sun-Panel'
const cachedFavicon = cachedSiteConfig.favicon_url || ''

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
