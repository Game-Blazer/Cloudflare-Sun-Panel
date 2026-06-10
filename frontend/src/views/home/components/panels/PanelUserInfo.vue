<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NInput, useMessage } from 'naive-ui'
import { useAuthStore, useAppStore } from '@/store'
import { updateUserInfo, updatePassword } from '@/api/index'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()
const message = useMessage()

// ====== 名称修改 ======
const editingName = ref(false)
const nameValue = ref('')
const nameSaving = ref(false)

function startEditName() {
  nameValue.value = authStore.userInfo?.name || ''
  editingName.value = true
}

async function handleSaveName() {
  const trimmed = nameValue.value.trim()
  if (!trimmed) { message.warning('名称不能为空'); return }
  if (trimmed === authStore.userInfo?.name) { editingName.value = false; return }
  nameSaving.value = true
  try {
    const res = await updateUserInfo<unknown>(trimmed)
    if (res.code === 0) {
      authStore.setUserInfo({ ...authStore.userInfo!, name: trimmed })
      message.success('名称已更新')
      editingName.value = false
    } else {
      message.error(res.msg || '更新失败')
    }
  } catch {
    message.error('网络错误')
  } finally {
    nameSaving.value = false
  }
}

// ====== 密码修改 ======
const editingPassword = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordSaving = ref(false)

function startEditPassword() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  editingPassword.value = true
}

async function handleSavePassword() {
  if (!oldPassword.value) { message.warning('请输入当前密码'); return }
  if (!newPassword.value) { message.warning('请输入新密码'); return }
  if (newPassword.value.length < 6) { message.warning('新密码至少6位'); return }
  if (newPassword.value !== confirmPassword.value) { message.warning('两次密码不一致'); return }
  passwordSaving.value = true
  try {
    const res = await updatePassword<unknown>(oldPassword.value, newPassword.value)
    if (res.code === 0) {
      message.success('密码已修改，请重新登录')
      editingPassword.value = false
      setTimeout(() => { authStore.removeToken(); router.push('/login') }, 1500)
    } else {
      message.error(res.msg || '修改失败')
    }
  } catch {
    message.error('网络错误')
  } finally {
    passwordSaving.value = false
  }
}

function handleLogout() {
  authStore.removeToken()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 用户信息 -->
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

    <!-- 修改名称 -->
    <div>
      <label class="block text-sm mb-1 font-medium">账户名称</label>
      <div v-if="editingName" class="flex flex-col gap-2">
        <NInput v-model:value="nameValue" placeholder="请输入新名称" size="small" />
        <div class="flex gap-2">
          <NButton size="small" type="primary" :loading="nameSaving" @click="handleSaveName">保存</NButton>
          <NButton size="small" @click="editingName = false">取消</NButton>
        </div>
      </div>
      <div v-else class="flex items-center gap-2">
        <span class="text-sm text-gray-500">{{ authStore.userInfo?.name }}</span>
        <NButton size="tiny" text @click="startEditName">修改</NButton>
      </div>
    </div>

    <!-- 修改密码 -->
    <div>
      <label class="block text-sm mb-1 font-medium">账户密码</label>
      <div v-if="editingPassword" class="flex flex-col gap-2">
        <NInput v-model:value="oldPassword" type="password" placeholder="当前密码" size="small" />
        <NInput v-model:value="newPassword" type="password" placeholder="新密码（至少6位）" size="small" />
        <NInput v-model:value="confirmPassword" type="password" placeholder="确认新密码" size="small" />
        <div class="flex gap-2">
          <NButton size="small" type="primary" :loading="passwordSaving" @click="handleSavePassword">保存</NButton>
          <NButton size="small" @click="editingPassword = false">取消</NButton>
        </div>
      </div>
      <div v-else class="flex items-center gap-2">
        <span class="text-sm text-gray-500">******</span>
        <NButton size="tiny" text @click="startEditPassword">修改</NButton>
      </div>
    </div>

    <!-- 主题 -->
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

    <!-- 语言 -->
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

    <!-- 退出登录 -->
    <div class="pt-2 border-t mt-auto">
      <NButton type="error" block @click="handleLogout">退出登录</NButton>
    </div>
  </div>
</template>
