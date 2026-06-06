<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NModal } from 'naive-ui'

const props = defineProps<{
  visible: boolean
  editingItem: Panel.ItemInfo | null
  getIconLoading: boolean
  iconCandidates: string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'save'): void
  (e: 'getFavicon'): void
  (e: 'selectIcon', url: string): void
}>()

const show = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})
</script>

<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <NModal v-model:show="show" title="编辑图标" preset="card" class="w-[95vw] sm:w-[500px]">
    <div v-if="editingItem" class="flex flex-col gap-4">
      <div>
        <label class="block text-sm mb-1">标题 *</label
        ><input v-model="editingItem.title" class="w-full border rounded px-3 py-2 text-sm" placeholder="请输入标题" />
      </div>
      <div>
        <label class="block text-sm mb-1">网址 *</label>
        <div class="flex gap-2">
          <input v-model="editingItem.url" class="flex-1 border rounded px-3 py-2 text-sm" placeholder="https://" />
          <NButton :disabled="!editingItem.url" :loading="getIconLoading" @click="emit('getFavicon')">获取图标</NButton>
        </div>
        <!-- 图标候选列表 -->
        <div v-if="iconCandidates.length > 0" class="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div class="text-xs text-gray-500 mb-2">点击选择图标：</div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(iconUrl, idx) in iconCandidates"
              :key="idx"
              class="w-8 h-8 rounded cursor-pointer border-2 hover:border-blue-400 transition-colors flex items-center justify-center bg-white dark:bg-gray-700"
              :class="editingItem.icon?.src === iconUrl ? 'border-blue-500' : 'border-gray-200 dark:border-gray-600'"
              :title="iconUrl"
              @click="emit('selectIcon', iconUrl)"
            >
              <img
                :src="iconUrl"
                class="w-5 h-5 object-contain"
                alt=""
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              />
            </div>
          </div>
        </div>
      </div>
      <div>
        <label class="block text-sm mb-1">描述</label
        ><input
          v-model="editingItem.description"
          class="w-full border rounded px-3 py-2 text-sm"
          placeholder="描述信息"
        />
      </div>
      <div>
        <label class="block text-sm mb-1">图标文字</label
        ><input
          v-model="editingItem.icon!.text"
          class="w-full border rounded px-3 py-2 text-sm"
          placeholder="图标显示文字"
        />
      </div>
      <div>
        <label class="block text-sm mb-1">图标图片 URL</label
        ><input
          v-model="editingItem.icon!.src"
          class="w-full border rounded px-3 py-2 text-sm"
          placeholder="输入图标图片URL，留空使用文字图标"
        />
      </div>
      <div>
        <label class="block text-sm mb-1">图标背景色</label
        ><input
          v-model="editingItem.icon!.backgroundColor"
          class="w-full border rounded px-3 py-2 text-sm"
          placeholder="#4a90d9"
        />
      </div>
      <div>
        <label class="block text-sm mb-1">打开方式</label>
        <select v-model="editingItem.openMethod" class="w-full border rounded px-3 py-2 text-sm">
          <option :value="1">当前页面打开</option>
          <option :value="2">新窗口打开</option>
          <option :value="3">弹窗打开</option>
        </select>
      </div>
      <div class="flex justify-end gap-2">
        <NButton @click="emit('update:visible', false)">取消</NButton>
        <NButton type="primary" @click="emit('save')">保存</NButton>
      </div>
    </div>
  </NModal>
  <!-- eslint-enable vue/no-mutating-props -->
</template>
