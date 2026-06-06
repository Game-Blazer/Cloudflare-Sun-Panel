<script setup lang="ts">
import { NButton, NTooltip } from 'naive-ui'

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
</script>

<template>
  <div
    class="group-item w-20 h-20 sm:w-[88px] sm:h-[88px] md:w-24 md:h-24 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all hover:scale-105 relative glass-hover"
    @click="emit('click', item)"
  >
    <div class="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg overflow-hidden flex items-center justify-center mb-1">
      <img
        v-if="item.icon?.src"
        :src="item.icon.src"
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
