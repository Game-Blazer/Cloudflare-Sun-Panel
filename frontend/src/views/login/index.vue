<script setup lang="ts">
import { onMounted, ref } from 'vue'
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

onMounted(async () => {
  // 检查是否已启用公开模式
  try {
    const res = await getAbout<Record<string, string>>()
    if (res.code === 0 && res.data?.panel_public_user_id) {
      hasPublicMode.value = true
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
  } finally {
    loading.value = false
  }
}

async function handleSkipLogin() {
  // 以访客模式进入
  authStore.token = null
  localStorage.removeItem('sun-panel-token')
  authStore.setVisitMode(VisitMode.VISIT_MODE_PUBLIC)
  router.push('/')
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
    <NCard class="w-96 shadow-xl" :bordered="false">
      <template #header>
        <div class="text-center text-xl font-bold text-gray-700">
          Sun-Panel
        </div>
      </template>

      <NForm @submit.prevent="handleLogin">
        <NFormItem label="用户名">
          <NInput
            v-model:value="username"
            placeholder="请输入用户名"
            size="large"
            :disabled="loading"
          />
        </NFormItem>

        <NFormItem label="密码">
          <NInput
            v-model:value="password"
            type="password"
            placeholder="请输入密码"
            size="large"
            :disabled="loading"
            @keyup.enter="handleLogin"
          />
        </NFormItem>

        <NButton
          type="primary"
          block
          size="large"
          :loading="loading"
          @click="handleLogin"
        >
          登录
        </NButton>
      </NForm>

      <!-- 访客模式入口 -->
      <template v-if="hasPublicMode" #footer>
        <NDivider />
        <NButton
          block
          size="large"
          secondary
          @click="handleSkipLogin"
        >
          以访客身份浏览
        </NButton>
      </template>
    </NCard>
  </div>
</template>