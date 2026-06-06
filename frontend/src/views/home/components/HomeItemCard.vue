<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { NButton, NTooltip } from 'naive-ui'
import { proxyIcon } from '@/api/index'

defineProps<{
  item: Panel.ItemInfo
  editable: boolean
  isEditMode: boolean
}>()

const emit = defineEmits<{
  (e: 'click', item: Panel.ItemInfo): void
  (e: 'edit', item: Panel.ItemInfo): void
  (e: 'delete', item: Panel.ItemInfo): void
}>()

// 图标加载失败重试机制
const MAX_RETRIES = 3
const iconErrorMap = ref<Record<string, number>>({})
const iconProxyMap = ref<Record<string, string>>({}) // 代理获取的 base64 图标
const retryTimers: ReturnType<typeof setTimeout>[] = []

function getItemKey(item: Panel.ItemInfo): string {
  return `icon_${item.id ?? ''}_${item.url ?? ''}`
}

function handleIconError(e: Event, item: Panel.ItemInfo) {
  const img = e.target as HTMLImageElement
  const key = getItemKey(item)
  const failCount = (iconErrorMap.value[key] || 0) + 1
  iconErrorMap.value[key] = failCount

  if (failCount <= MAX_RETRIES) {
    const delay = Math.min(500 * Math.pow(2, failCount - 1), 4000)
    const timer = setTimeout(() => {
      if (item.icon?.src) {
        const sep = item.icon.src.includes('?') ? '&' : '?'
        img.src = item.icon.src + sep + '_r=' + Date.now()
      }
    }, delay)
    retryTimers.push(timer)
  } else {
    // 重试全部失败后，尝试通过后端代理获取图标
    tryProxyIcon(item)
  }
}

async function tryProxyIcon(item: Panel.ItemInfo) {
  const key = getItemKey(item)
  if (!item.icon?.src || iconProxyMap.value[key]) return

  try {
    const res = await proxyIcon<{ base64: string; contentType: string }>(item.icon.src)
    if (res.code === 0 && res.data?.base64) {
      iconProxyMap.value[key] = res.data.base64
    }
  } catch {
    /* 代理也失败，使用回退显示 */
  }
}

function getProxyIconSrc(item: Panel.ItemInfo): string | undefined {
  return iconProxyMap.value[getItemKey(item)]
}

function isIconFailed(item: Panel.ItemInfo): boolean {
  return (iconErrorMap.value[getItemKey(item)] || 0) > MAX_RETRIES && !getProxyIconSrc(item)
}

onUnmounted(() => {
  retryTimers.forEach(clearTimeout)
})
</script>

<template>
  <div
    class="group-item w-20 h-20 sm:w-[88px] sm:h-[88px] md:w-24 md:h-24 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all hover:scale-105 relative glass-hover"
    @click="emit('click', item)"
  >
    <div class="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg overflow-hidden flex items-center justify-center mb-1">
      <img
        v-if="item.icon?.src && !isIconFailed(item)"
        :src="item.icon.src"
        class="w-full h-full object-cover"
        :alt="item.title"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        @error="(e) => handleIconError(e, item)"
      />
      <img
        v-else-if="getProxyIconSrc(item)"
        :src="getProxyIconSrc(item)"
        class="w-full h-full object-cover"
        :alt="item.title"
        loading="lazy"
        decoding="async"
      />
      <div
        v-else
        class="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-lg"
        :style="{ backgroundColor: item.icon?.backgroundColor || '#4a90d9' }"
      >
        {{ item.icon?.text || item.title?.charAt(0) || '?' }}
      </div>
    </div>
    <span class="text-white text-[11px] sm:text-xs text-center line-clamp-2 px-1">{{ item.title }}</span>

    <!-- 编辑模式下显示编辑/删除按钮 -->
    <div v-if="editable && isEditMode" class="absolute top-1 right-1 flex gap-1">
      <NTooltip trigger="hover" placement="top">
        <template #trigger>
          <NButton size="tiny" @click.stop="emit('edit', item)" class="!px-2 !min-w-0">✎</NButton>
        </template>
        编辑
      </NTooltip>
      <NTooltip trigger="hover" placement="top">
        <template #trigger>
          <NButton size="tiny" type="error" @click.stop="emit('delete', item)" class="!px-2 !min-w-0">✕</NButton>
        </template>
        删除
      </NTooltip>
    </div>
  </div>
</template>
