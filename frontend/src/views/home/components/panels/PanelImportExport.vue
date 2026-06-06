<script setup lang="ts">
import { ref } from 'vue'
import { NButton } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { getAllData, saveGroup, addItems } from '@/api/index'
import { cachedRequest } from '@/utils/requestCache'
import {
  createExportData,
  downloadJSON,
  validateImportData,
  readFileAsText,
  type ExportGroup,
  type ExportData,
} from '@/utils/importExport'

const props = defineProps<{
  onSaved: () => void
}>()

const emit = defineEmits<{
  (e: 'saved'): void
}>()

const message = useMessage()
const importExportLoading = ref(false)
const fileInputRef = ref<HTMLInputElement>()

async function handleExport() {
  importExportLoading.value = true
  try {
    const res = await cachedRequest('panel:allData', () =>
      getAllData<{
        groups: Panel.ItemIconGroup[]
        itemsMap: Record<number, Panel.ItemInfo[]>
      }>(),
    )
    if (res.code === 0 && res.data) {
      const groupList = res.data.groups || []
      const itemsMap = res.data.itemsMap || {}
      const groups: ExportGroup[] = groupList.map((g) => ({
        title: g.title || '',
        sort: g.sort || 0,
        children:
          g.id && itemsMap[g.id]
            ? itemsMap[g.id].map((item) => ({
                title: item.title,
                sort: item.sort || 0,
                icon: item.icon,
                url: item.url,
                description: item.description || '',
                openMethod: item.openMethod || 1,
              }))
            : [],
      }))
      const data = createExportData(groups)
      downloadJSON(data)
      message.success('导出成功')
    }
  } catch {
    message.error('导出失败')
  } finally {
    importExportLoading.value = false
  }
}

async function handleImportFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  importExportLoading.value = true
  try {
    const text = await readFileAsText(file)
    const result = validateImportData(text)
    if (!result.valid || !result.data) {
      message.error(result.error || '导入失败')
      return
    }
    await importData(result.data)
    message.success('导入成功，请刷新页面查看')
    emit('saved')
    props.onSaved()
  } catch (err) {
    message.error(err instanceof Error ? err.message : '导入失败')
  } finally {
    importExportLoading.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

async function importData(data: ExportData) {
  const batchSize = 50
  for (const g of data.icons) {
    const groupRes = await saveGroup<Panel.ItemIconGroup>({ title: g.title, sort: g.sort })
    if (groupRes.code === 0 && groupRes.data?.id) {
      const groupId = groupRes.data.id
      const items: Panel.ItemInfo[] = g.children.map((item) => ({
        ...item,
        itemIconGroupId: groupId,
        openMethod: item.openMethod || 2,
      }))
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        await addItems(batch)
      }
    }
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 items-center py-6">
    <p class="text-sm text-gray-500 mb-4">导出格式为 .sun-panel.json，可跨设备备份和恢复</p>
    <input ref="fileInputRef" type="file" accept=".sun-panel.json,.json" class="hidden" @change="handleImportFile" />
    <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
      <NButton type="primary" :loading="importExportLoading" @click="handleExport">导出数据</NButton>
      <NButton :loading="importExportLoading" @click="fileInputRef?.click()">导入数据</NButton>
    </div>
  </div>
</template>
