<script setup lang="ts">
import { NButton } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { usePanelState } from '@/store'
import { setUserConfig } from '@/api/index'

const props = defineProps<{
  panelConfig: Panel.panelConfig
  onSaved: () => void
}>()

const emit = defineEmits<{
  (e: 'save', config: Panel.panelConfig): void
}>()

const message = useMessage()
const panelState = usePanelState()

async function handleSave() {
  const config = { ...props.panelConfig }
  try {
    const res = await setUserConfig({ panel: config })
    if (res.code === 0) {
      panelState.updatePanelConfigFromCloud(config)
      message.success('配置已保存')
      emit('save', config)
      props.onSaved()
    }
  } catch {
    message.error('保存失败')
  }
}
</script>

<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <div class="flex flex-col gap-4">
    <div>
      <label class="block text-sm mb-1 font-medium">公告内容</label>
      <textarea
        :value="panelConfig.announcement"
        @input="(e: Event) => (panelConfig.announcement = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
        rows="3"
        placeholder="公告文字，留空不显示"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">公告停留时间 (秒，0为不自动消失)</label>
      <input
        :value="panelConfig.announcementDuration"
        @input="(e: Event) => (panelConfig.announcementDuration = Number((e.target as HTMLInputElement).value))"
        type="number"
        min="0"
        max="999"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div class="border-t pt-3">
      <label class="block text-sm mb-1 font-medium">Logo 文字</label>
      <input
        :value="panelConfig.logoText"
        @input="(e: Event) => (panelConfig.logoText = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
        placeholder="输入 Logo 文字"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">Logo 图片 URL</label>
      <input
        :value="panelConfig.logoImageSrc"
        @input="(e: Event) => (panelConfig.logoImageSrc = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
        placeholder="输入图片URL"
      />
    </div>
    <div class="border-t pt-3">
      <label class="block text-sm mb-1 font-medium">Logo 距顶部 (px)</label>
      <input
        :value="panelConfig.logoPositionTop"
        @input="(e: Event) => (panelConfig.logoPositionTop = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">Logo 距左侧 (px)</label>
      <input
        :value="panelConfig.logoPositionLeft"
        @input="(e: Event) => (panelConfig.logoPositionLeft = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">Logo 图片高度 (px)</label>
      <input
        :value="panelConfig.logoSize"
        @input="(e: Event) => (panelConfig.logoSize = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div class="border-t pt-3">
      <label class="block text-sm mb-1 font-medium">背景模糊度: {{ panelConfig.announcementBlur ?? 12 }}</label>
      <input
        :value="panelConfig.announcementBlur"
        @input="(e: Event) => (panelConfig.announcementBlur = Number((e.target as HTMLInputElement).value))"
        type="range"
        min="0"
        max="40"
        class="w-full"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium"
        >遮罩不透明度: {{ panelConfig.announcementMaskOpacity ?? 0.15 }}</label
      >
      <input
        :value="panelConfig.announcementMaskOpacity"
        @input="(e: Event) => (panelConfig.announcementMaskOpacity = Number((e.target as HTMLInputElement).value))"
        type="range"
        min="0"
        max="1"
        step="0.05"
        class="w-full"
      />
    </div>
    <p class="text-xs text-gray-400">控制侧边栏、公告弹窗、Logo 的模糊和透明度效果</p>
    <div class="flex justify-end gap-2 pt-2 border-t">
      <NButton type="primary" @click="handleSave">保存</NButton>
    </div>
  </div>
  <!-- eslint-enable vue/no-mutating-props -->
</template>
