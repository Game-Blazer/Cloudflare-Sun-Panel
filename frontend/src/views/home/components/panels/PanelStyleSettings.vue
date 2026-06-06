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
  (e: 'reset'): void
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

function handleReset() {
  panelState.setPanelConfig({})
  message.success('已重置')
  emit('reset')
}
</script>

<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <div class="flex flex-col gap-4">
    <div>
      <label class="block text-sm mb-1 font-medium">壁纸地址</label>
      <input
        :value="panelConfig.backgroundImageSrc"
        @input="(e: Event) => (panelConfig.backgroundImageSrc = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
        placeholder="输入图片URL"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">模糊度: {{ panelConfig.backgroundBlur || 0 }}</label>
      <input
        :value="panelConfig.backgroundBlur"
        @input="(e: Event) => (panelConfig.backgroundBlur = Number((e.target as HTMLInputElement).value))"
        type="range"
        min="0"
        max="50"
        class="w-full"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">遮罩不透明度: {{ panelConfig.backgroundMaskNumber ?? 0.3 }}</label>
      <input
        :value="panelConfig.backgroundMaskNumber"
        @input="(e: Event) => (panelConfig.backgroundMaskNumber = Number((e.target as HTMLInputElement).value))"
        type="range"
        min="0"
        max="1"
        step="0.1"
        class="w-full"
      />
    </div>
    <div class="border-t pt-3">
      <label class="block text-sm mb-1 font-medium">自定义页脚 (支持 HTML)</label>
      <textarea
        :value="panelConfig.footerHtml"
        @input="(e: Event) => (panelConfig.footerHtml = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
        rows="3"
        placeholder="<p>&copy; 2024 Sun-Panel</p>"
      />
    </div>
    <div class="border-t pt-2">
      <label class="block text-sm mb-1 font-medium">最大宽度</label>
      <input
        :value="panelConfig.maxWidth"
        @input="(e: Event) => (panelConfig.maxWidth = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">上边距</label>
      <input
        :value="panelConfig.marginTop"
        @input="(e: Event) => (panelConfig.marginTop = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">下边距</label>
      <input
        :value="panelConfig.marginBottom"
        @input="(e: Event) => (panelConfig.marginBottom = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div class="flex justify-end gap-2 pt-2 border-t">
      <NButton @click="handleReset">重置</NButton>
      <NButton type="primary" @click="handleSave">保存</NButton>
    </div>
  </div>
  <!-- eslint-enable vue/no-mutating-props -->
</template>
