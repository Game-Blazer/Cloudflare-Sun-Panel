import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getAbout } from '@/api/index'
import { useAuthStore } from '@/store/modules/auth'

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

// 模块级：从缓存恢复登录页样式，避免 API 返回前闪现默认值
const cachedLoginBg = localStorage.getItem(LOGIN_BG_CACHE_KEY) || ''
const cachedStyle = getCachedLoginStyle()

// 先使用缓存图片 URL 作为初始背景，后续 API 返回后按需更新
const loginBgImage = ref(cachedLoginBg)

// 如果缓存图片存在，添加 preload 提示浏览器提前下载
if (cachedLoginBg) {
  preloadLoginBg(cachedLoginBg)
}

export function useLoginPage() {
  const router = useRouter()
  const authStore = useAuthStore()

  const hasPublicMode = ref(false)
  const siteTitle = ref('Sun-Panel')

  const loginPageStyle = computed(() => {
    const bgImage = loginBgImage.value
    if (bgImage) {
      return {
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transform: 'translateZ(0)',
        willChange: 'transform',
      }
    }
    return {}
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
    try {
      const res = await getAbout<Record<string, string>>()
      if (res.code === 0) {
        const hasPublic = !!(res.data?.panel_public_user_id || res.data?.default_guest_mode === '1')
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
        if (res.data?.site_title) {
          siteTitle.value = res.data.site_title
          document.title = res.data.site_title
        }
        // 使用站点设置中的登录页背景图片
        const bgUrl = res.data?.login_bg_image || ''
        if (bgUrl) {
          // 缓存 URL 用于下次访问
          localStorage.setItem(LOGIN_BG_CACHE_KEY, bgUrl)
          // 添加 <link rel="preload"> 提示浏览器提前下载
          preloadLoginBg(bgUrl)
          // 用 Image 对象预加载，确保图片就绪后再切换背景，避免闪烁
          const img = new Image()
          img.onload = () => {
            loginBgImage.value = bgUrl
          }
          img.onerror = () => {
            /* 加载失败，保持渐变背景 */
          }
          img.src = bgUrl
        }
        // 读取登录卡片模糊度和遮罩不透明度设置
        if (res.data?.login_blur !== undefined) {
          loginBlur.value = Number(res.data.login_blur)
        }
        if (res.data?.login_mask_opacity !== undefined) {
          loginMaskOpacity.value = Number(res.data.login_mask_opacity)
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
    } catch {
      /* ignore */
    }
  }

  return {
    hasPublicMode,
    siteTitle,
    loginBgImage,
    loginBlur,
    loginMaskOpacity,
    loginPageStyle,
    loginCardStyle,
    initLoginPage,
  }
}
