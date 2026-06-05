<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NInput, useMessage, NDivider } from 'naive-ui'
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
const loginBgImage = ref('')

const loginPageStyle = computed(() => {
  if (loginBgImage.value) {
    return {
      backgroundImage: `url(${loginBgImage.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      transform: 'translateZ(0)',
      willChange: 'transform',
    }
  }
  return {}
})

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
      if (res.data?.login_bg_image) loginBgImage.value = res.data.login_bg_image
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
    <NCard class="w-[92vw] sm:w-full max-w-sm shadow-xl login-card mx-4" :bordered="false">
      <template #header>
        <div class="text-center text-xl font-bold text-gray-700 dark:text-gray-200">
          {{ siteTitle }}
        </div>
      </template>

      <form @submit.prevent="handleLogin">
        <div class="mb-4">
          <label class="block text-sm mb-1.5 font-medium" style="color: rgba(255,255,255,0.9)">用户名</label>
          <NInput v-model:value="username" placeholder="请输入用户名" size="large" :disabled="loading" autocomplete="username" />
        </div>
        <div class="mb-4">
          <label class="block text-sm mb-1.5 font-medium" style="color: rgba(255,255,255,0.9)">密码</label>
          <NInput v-model:value="password" type="password" placeholder="请输入密码" size="large" :disabled="loading" autocomplete="current-password" />
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="login-btn w-full py-2.5 rounded-lg text-white font-medium text-base transition-colors"
          :class="loading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90 active:opacity-80'"
          style="background-color: #2080f0; touch-action: manipulation;"
          @click="handleLogin"
        >
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <template v-if="hasPublicMode" #footer>
        <NDivider />
        <NButton block size="large" secondary @click="handleSkipLogin">以访客身份浏览</NButton>
      </template>
    </NCard>
  </div>
</template>

<style scoped>
.login-card {
  background-color: rgba(255, 255, 255, 0.18) !important;
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  border-radius: 16px !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
}

.login-btn {
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

:deep(.login-card .n-card-header) {
  color: rgba(255, 255, 255, 0.95);
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