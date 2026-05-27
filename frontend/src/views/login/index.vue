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
const loginBgImage = ref('')

const loginPageStyle = computed(() => {
  if (loginBgImage.value) {
    return {
      backgroundImage: `url(${loginBgImage.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return {}
})

onMounted(async () => {
  try {
    const res = await getAbout<Record<string, string>>()
    if (res.code === 0) {
      if (res.data?.panel_public_user_id || res.data?.default_guest_mode === '1') {
        hasPublicMode.value = true
        localStorage.setItem('sun-panel-public-mode', '1')
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
    <NCard class="w-96 shadow-xl" :bordered="false">
      <template #header>
        <div class="text-center text-xl font-bold text-gray-700 dark:text-gray-200">
          {{ siteTitle }}
        </div>
      </template>

      <NForm @submit.prevent="handleLogin">
        <NFormItem label="用户名">
          <NInput v-model:value="username" placeholder="请输入用户名" size="large" :disabled="loading" />
        </NFormItem>
        <NFormItem label="密码">
          <NInput v-model:value="password" type="password" placeholder="请输入密码" size="large" :disabled="loading" @keyup.enter="handleLogin" />
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