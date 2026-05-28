<script setup lang="ts">
import { NButton, NResult } from 'naive-ui'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <NResult
      status="404"
      title="404 页面不存在"
      description="你访问的页面可能已被删除或不存在"
    >
      <template #footer>
        <NButton type="primary" @click="router.push('/')">
          返回首页
        </NButton>
      </template>
    </NResult>
  </div>
</template>