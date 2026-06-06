<script setup lang="ts">
import { NButton } from 'naive-ui'
import { useAuthStore, useAppStore } from '@/store'

const authStore = useAuthStore()
const appStore = useAppStore()

function handleLogout() {
  authStore.removeToken()
  window.location.reload()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 dark:bg-gray-800 rounded">
      <div class="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
        {{ authStore.userInfo?.name?.charAt(0) || '?' }}
      </div>
      <div>
        <div class="font-medium">{{ authStore.userInfo?.name }}</div>
        <div class="text-sm text-gray-500">{{ authStore.userInfo?.username }}</div>
        <div class="text-xs text-gray-400">角色: {{ authStore.userInfo?.role === 1 ? '管理员' : '普通用户' }}</div>
      </div>
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">主题</label>
      <div class="flex gap-2">
        <NButton
          size="small"
          :type="appStore.theme === 'dark' ? 'primary' : 'default'"
          @click="appStore.setTheme('dark')"
          >深色</NButton
        >
        <NButton
          size="small"
          :type="appStore.theme === 'light' ? 'primary' : 'default'"
          @click="appStore.setTheme('light')"
          >浅色</NButton
        >
        <NButton
          size="small"
          :type="appStore.theme === 'auto' ? 'primary' : 'default'"
          @click="appStore.setTheme('auto')"
          >跟随系统</NButton
        >
      </div>
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">语言</label>
      <div class="flex gap-2">
        <NButton
          size="small"
          :type="appStore.language === 'zh-CN' ? 'primary' : 'default'"
          @click="appStore.setLanguage('zh-CN')"
          >中文</NButton
        >
        <NButton
          size="small"
          :type="appStore.language === 'en-US' ? 'primary' : 'default'"
          @click="appStore.setLanguage('en-US')"
          >English</NButton
        >
      </div>
    </div>
    <div class="pt-2 border-t mt-auto">
      <NButton type="error" block @click="handleLogout">退出登录</NButton>
    </div>
  </div>
</template>
