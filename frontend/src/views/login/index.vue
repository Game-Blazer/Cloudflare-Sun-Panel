<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCard, NForm, NFormItem, NInput, useMessage, NDivider } from 'naive-ui'
import { login, getAbout } from '@/api/index'
import { useAuthStore } from '@/store/modules/auth'
import { VisitMode } from '@/store/modules/auth'

const router = useRouter()
const authStore = useAuthStore()
const message = useMessage()

const username = ref('')
const password = ref('')
const loading = ref(false)
const hasPublicMode = ref(false)
const siteTitle = ref('Sun-Panel')

// 缓存登录页背景 URL，用于下次访问时直接显示，避免渐变闪烁
const LOGIN_BG_CACHE_KEY = 'sun-panel-login-bg'
const cachedLoginBg = localStorage.getItem(LOGIN_BG_CACHE_KEY) || ''

// 如果有缓存的背景 URL，立即显示，避免先显示渐变再切换
const loginBgImage = ref(cachedLoginBg || '')

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

// 登录卡片模糊度和遮罩不透明度
const loginBlur = ref(12)
const loginMaskOpacity = ref(0.15)

const loginCardStyle = computed(() => {
  return {
    '--glass-blur': `${loginBlur.value}px`,
    '--glass-bg-hover': `rgba(255, 255, 255, ${loginMaskOpacity.value})`,
  } as Record<string, string>
})

// 立即预加载缓存的登录背景，在 Vue 挂载前触发浏览器下载
if (cachedLoginBg) {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = cachedLoginBg
  link.setAttribute('data-login-bg', 'true')
  document.head.appendChild(link)
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

onMounted(async () => {
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
        img.onload = () => { loginBgImage.value = bgUrl }
        img.onerror = () => { /* 加载失败，保持渐变背景 */ }
        img.src = bgUrl
      }
      // 读取登录卡片模糊度和遮罩不透明度设置
      if (res.data?.login_blur !== undefined) {
        loginBlur.value = Number(res.data.login_blur)
      }
      if (res.data?.login_mask_opacity !== undefined) {
        loginMaskOpacity.value = Number(res.data.login_mask_opacity)
      }
    }
  } catch { /* ignore */ }
})

async function handleLogin() {
  if (!username.value || !password.value) {
    message.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    const res = await login<{ token: string; userInfo: User.Info }>(username.value, password.value)
    if (res.code === 0) {
      authStore.loginSuccess(res.data.token, res.data.userInfo)
      message.success('登录成功')
      router.push('/')
    } else {
      message.error(res.msg || '登录失败')
    }
  } catch {
    message.error('网络错误，请稍后重试')
  } finally { loading.value = false }
}

async function handleSkipLogin() {
  authStore.token = null
  localStorage.removeItem('sun-panel-token')
  authStore.setVisitMode(VisitMode.VISIT_MODE_PUBLIC)
  router.push('/')
}
</script>

<template>
  <div
    class="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600"
    :style="loginPageStyle"
  >
    <NCard class="w-[92vw] sm:w-full max-w-sm shadow-xl login-card mx-4" :bordered="false" :style="loginCardStyle">
      <template #header>
        <div class="text-center text-xl font-bold text-gray-700 dark:text-gray-200">
          {{ siteTitle }}
        </div>
      </template>

      <NForm @submit.prevent="handleLogin">
        <NFormItem label="用户名">
          <NInput v-model:value="username" placeholder="请输入用户名" size="large" :disabled="loading" autocomplete="username" />
        </NFormItem>
        <NFormItem label="密码">
          <NInput v-model:value="password" type="password" placeholder="请输入密码" size="large" :disabled="loading" autocomplete="current-password" @keyup.enter="handleLogin" />
        </NFormItem>
        <NButton type="primary" block size="large" :loading="loading" @click="handleLogin">登录</NButton>
      </NForm>

      <template v-if="hasPublicMode" #footer>
        <NDivider />
        <NButton block size="large" secondary @click="handleSkipLogin">以访客身份浏览</NButton>
      </template>
    </NCard>
  </div>
</template>

<style scoped>
.login-card {
  background-color: var(--glass-bg-hover) !important;
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
  border-radius: var(--radius-xl) !important;
  border: 1px solid var(--glass-border) !important;
}

.login-card :deep(.n-button) {
  touch-action: manipulation;
}

:deep(.login-card .n-card-header) {
  color: rgba(255, 255, 255, 0.95);
}

:deep(.login-card .n-form-item-label) {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

:deep(.login-card .n-input) {
  --n-color: rgba(255, 255, 255, 0.12) !important;
  --n-color-focus: rgba(255, 255, 255, 0.2) !important;
  --n-text-color: #fff !important;
  --n-placeholder-color: rgba(255, 255, 255, 0.5) !important;
  --n-border: rgba(255, 255, 255, 0.25) !important;
  --n-border-focus: rgba(255, 255, 255, 0.5) !important;
  --n-border-hover: rgba(255, 255, 255, 0.35) !important;
}

:deep(.login-card .n-divider) {
  --n-color: rgba(255, 255, 255, 0.2) !important;
}

:deep(.login-card .n-card-footer) {
  padding-top: 0;
}
</style>