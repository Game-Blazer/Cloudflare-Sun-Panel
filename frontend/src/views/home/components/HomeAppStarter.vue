<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { NButton, NLayout, NLayoutContent, NLayoutSider, NModal, NSwitch, useMessage } from 'naive-ui'
import { useAuthStore, usePanelState, useAppStore } from '@/store'
import { saveSiteSettings, setUserConfig, saveGroup, deleteGroups, getGroupList, getItemsByGroup, addItems } from '@/api/index'
import UsersManage from '@/components/apps/Users/index.vue'
import { createExportData, downloadJSON, validateImportData, readFileAsText, type ExportGroup, type ExportData } from '@/utils/importExport'

interface App {
  name: string
  key: string
  icon: string
  adminOnly?: boolean
}

const props = defineProps<{
  visible: boolean
  siteConfig: Panel.SiteConfig
  groups: any[]
  onSaved: () => void
}>()

const emit = defineEmits<{
  (e: 'update:visible', visible: boolean): void
  (e: 'update:siteConfig', config: Panel.SiteConfig): void
}>()

const show = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const message = useMessage()
const authStore = useAuthStore()
const panelState = usePanelState()
const { panelConfig } = storeToRefs(panelState)
const appStore = useAppStore()

const activeApp = ref('UserInfo')
const collapsed = ref(false)
const screenWidth = ref(window.innerWidth)
const isSmallScreen = ref(false)
const editGroupModalVisible = ref(false)
const editingGroup = ref<Panel.ItemIconGroup>({ title: '' })

const apps = computed<App[]>(() => {
  const list: App[] = [
    { name: '我的信息', key: 'UserInfo', icon: '👤' },
    { name: '风格设置', key: 'Style', icon: '🎨' },
    { name: '分组管理', key: 'GroupManage', icon: '📁' },
    { name: '导入导出', key: 'ImportExport', icon: '📦' },
  ]
  if (authStore.isAdmin) {
    list.push({ name: '用户管理', key: 'Users', icon: '👥', adminOnly: true })
    list.push({ name: '站点设置', key: 'SiteSettings', icon: '⚙', adminOnly: true })
  }
  return list
})

function handleResize() {
  screenWidth.value = window.innerWidth
  isSmallScreen.value = screenWidth.value < 640
  if (isSmallScreen.value) collapsed.value = true
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  handleResize()
  syncSiteConfig()
})

watch(() => props.siteConfig, () => syncSiteConfig(), { deep: true })

// ====== 风格设置 ======
async function handleSaveStyleSettings() {
  const config = { ...panelState.panelConfig }
  try {
    const res = await setUserConfig({ panel: config })
    if (res.code === 0) { panelState.updatePanelConfigFromCloud(config); message.success('配置已保存'); props.onSaved() }
  } catch { message.error('保存失败') }
}

function resetSettings() { panelState.setPanelConfig({}); message.success('已重置') }

// ====== 站点设置 ======
const localSiteConfig = ref<Panel.SiteConfig>({})

function syncSiteConfig() {
  localSiteConfig.value = { ...props.siteConfig }
}

async function handleSaveSiteSettings() {
  try {
    const res = await saveSiteSettings({
      site_title: localSiteConfig.value.site_title || '',
      login_bg_image: localSiteConfig.value.login_bg_image || '',
      footer_html: localSiteConfig.value.footer_html || '',
      logo_text: localSiteConfig.value.logo_text || '',
      logo_image_src: localSiteConfig.value.logo_image_src || '',
      favicon_url: localSiteConfig.value.favicon_url || '',
    })
    if (res.code === 0) {
      emit('update:siteConfig', { ...localSiteConfig.value })
      message.success('站点设置已保存')
    } else message.error(res.msg || '保存失败')
  } catch { message.error('保存失败') }
}

// ====== 分组管理 ======
function openEditGroup(group: any) {
  editingGroup.value = { id: group.id, title: group.title, publicVisible: group.publicVisible ?? 1 }
  editGroupModalVisible.value = true
}

async function handleSaveGroup() {
  try {
    const res = await saveGroup(editingGroup.value)
    if (res.code === 0) { message.success('保存成功'); editGroupModalVisible.value = false; props.onSaved() }
    else message.error(res.msg || '保存失败')
  } catch { message.error('网络错误') }
}

async function handleDeleteGroup(group: any) {
  if (!group.id) return
  try {
    const res = await deleteGroups([group.id])
    if (res.code === 0) { message.success('删除成功'); props.onSaved() }
  } catch { message.error('网络错误') }
}

function openAddGroup() {
  editingGroup.value = { title: '', publicVisible: 1 }
  editGroupModalVisible.value = true
}

// ====== 导入导出 ======
const importExportLoading = ref(false)
const fileInputRef = ref<HTMLInputElement>()

async function handleExport() {
  importExportLoading.value = true
  try {
    const res = await getGroupList<Panel.ItemIconGroup[]>()
    if (res.code === 0) {
      const groupList = res.data || []
      // 并行获取所有分组的图标
      const itemsResults = await Promise.all(
        groupList.map(g => g.id ? getItemsByGroup<Panel.ItemInfo[]>(g.id) : null)
      )
      const groups: ExportGroup[] = []
      groupList.forEach((g, i) => {
        const group: ExportGroup = { title: g.title || '', sort: g.sort || 0, children: [] }
        const itemRes = itemsResults[i]
        if (itemRes && itemRes.code === 0) {
          for (const item of (itemRes.data || [])) {
            group.children.push({
              title: item.title, sort: item.sort || 0, icon: item.icon,
              url: item.url, description: item.description || '', openMethod: item.openMethod || 1,
            })
          }
        }
        groups.push(group)
      })
      const data = createExportData(groups)
      downloadJSON(data)
      message.success('导出成功')
    }
  } catch { message.error('导出失败') }
  finally { importExportLoading.value = false }
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
    props.onSaved()
  } catch (err: any) {
    message.error(err?.message || '导入失败')
  }
  finally {
    importExportLoading.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

async function importData(data: ExportData) {
  for (const g of data.icons) {
    const groupRes = await saveGroup<Panel.ItemIconGroup>({ title: g.title, sort: g.sort })
    if (groupRes.code === 0 && groupRes.data?.id) {
      const groupId = groupRes.data.id
      const items: Panel.ItemInfo[] = g.children.map(item => ({
        ...item, itemIconGroupId: groupId,
      }))
      // 分批添加（每批50个）
      const batchSize = 50
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        await addItems(batch)
      }
    }
  }
}
</script>

<template>
  <NModal v-model:show="show" preset="card" title="" class="w-[900px]" size="small" :mask-closable="true">
    <template #header>
      <div class="flex items-center select-none cursor-pointer" @click="collapsed = !collapsed">
        <span class="text-lg mr-2">{{ collapsed ? '▶' : '◀' }}</span>
        <span>{{ apps.find(a => a.key === activeApp)?.name || '应用启动器' }}</span>
      </div>
    </template>
    <NLayout has-sider style="height:500px;border-radius:0.75rem;">
      <NLayoutSider
        :collapsed="collapsed"
        collapse-mode="width"
        :collapsed-width="0"
        :width="isSmallScreen ? '100%' : 180"
        content-style="overflow: hidden"
      >
        <div class="h-full dark:bg-[#2c2c32] p-2">
          <div
            v-for="app in apps" :key="app.key"
            class="px-3 py-2.5 rounded-lg mb-1 cursor-pointer font-medium text-sm flex items-center gap-2 transition-colors"
            :class="activeApp === app.key ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300'"
            @click="activeApp = app.key"
          >
            <span>{{ app.icon }}</span>
            <span>{{ app.name }}</span>
          </div>
        </div>
      </NLayoutSider>
      <NLayoutContent content-style="height:500px">
        <div class="h-full overflow-auto p-4">

          <!-- ====== 我的信息 ====== -->
          <div v-if="activeApp === 'UserInfo'" class="flex flex-col gap-4">
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
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
                <NButton size="small" :type="appStore.theme === 'dark' ? 'primary' : 'default'" @click="appStore.setTheme('dark')">深色</NButton>
                <NButton size="small" :type="appStore.theme === 'light' ? 'primary' : 'default'" @click="appStore.setTheme('light')">浅色</NButton>
                <NButton size="small" :type="appStore.theme === 'auto' ? 'primary' : 'default'" @click="appStore.setTheme('auto')">跟随系统</NButton>
              </div>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium">语言</label>
              <div class="flex gap-2">
                <NButton size="small" :type="appStore.language === 'zh-CN' ? 'primary' : 'default'" @click="appStore.setLanguage('zh-CN')">中文</NButton>
                <NButton size="small" :type="appStore.language === 'en-US' ? 'primary' : 'default'" @click="appStore.setLanguage('en-US')">English</NButton>
              </div>
            </div>
            <div class="pt-2 border-t">
              <NButton type="error" block @click="authStore.removeToken(); window.location.reload()">退出登录</NButton>
            </div>
          </div>

          <!-- ====== 风格设置 ====== -->
          <div v-if="activeApp === 'Style'" class="flex flex-col gap-4">
            <div><label class="block text-sm mb-1 font-medium">壁纸地址</label>
              <input :value="panelConfig.backgroundImageSrc" @input="(e: any) => panelConfig.backgroundImageSrc = e.target.value" class="w-full border rounded px-3 py-2 text-sm" placeholder="输入图片URL" /></div>
            <div><label class="block text-sm mb-1 font-medium">模糊度: {{ panelConfig.backgroundBlur || 0 }}</label>
              <input :value="panelConfig.backgroundBlur" @input="(e: any) => panelConfig.backgroundBlur = Number(e.target.value)" type="range" min="0" max="50" class="w-full" /></div>
            <div><label class="block text-sm mb-1 font-medium">遮罩不透明度: {{ panelConfig.backgroundMaskNumber ?? 0.3 }}</label>
              <input :value="panelConfig.backgroundMaskNumber" @input="(e: any) => panelConfig.backgroundMaskNumber = Number(e.target.value)" type="range" min="0" max="1" step="0.1" class="w-full" /></div>
            <div><label class="block text-sm mb-1 font-medium">最大宽度</label>
              <input :value="panelConfig.maxWidth" @input="(e: any) => panelConfig.maxWidth = Number(e.target.value)" type="number" class="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label class="block text-sm mb-1 font-medium">上边距</label>
              <input :value="panelConfig.marginTop" @input="(e: any) => panelConfig.marginTop = Number(e.target.value)" type="number" class="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label class="block text-sm mb-1 font-medium">下边距</label>
              <input :value="panelConfig.marginBottom" @input="(e: any) => panelConfig.marginBottom = Number(e.target.value)" type="number" class="w-full border rounded px-3 py-2 text-sm" /></div>
            <div class="flex justify-end gap-2 pt-2 border-t">
              <NButton @click="resetSettings">重置</NButton>
              <NButton type="primary" @click="handleSaveStyleSettings">保存</NButton>
            </div>
          </div>

          <!-- ====== 分组管理 ====== -->
          <div v-if="activeApp === 'GroupManage'" class="flex flex-col gap-4">
            <div class="flex gap-2"><NButton type="primary" size="small" @click="openAddGroup">添加分组</NButton></div>
            <div class="flex flex-col gap-2 max-h-[380px] overflow-auto">
              <div v-for="group in groups" :key="group.id" class="flex items-center justify-between p-3 border rounded">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ group.title }}</span>
                  <span class="text-xs px-1.5 py-0.5 rounded" :class="group.publicVisible !== 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                    {{ group.publicVisible !== 0 ? '访客可见' : '隐藏' }}
                  </span>
                </div>
                <div class="flex gap-2">
                  <NButton size="tiny" @click="openEditGroup(group)">编辑</NButton>
                  <NButton size="tiny" type="error" @click="handleDeleteGroup(group)">删除</NButton>
                </div>
              </div>
            </div>
          </div>

          <!-- ====== 导入导出 ====== -->
          <div v-if="activeApp === 'ImportExport'" class="flex flex-col gap-4 items-center py-6">
            <p class="text-sm text-gray-500 mb-4">导出格式为 .sun-panel.json，可跨设备备份和恢复</p>
            <input ref="fileInputRef" type="file" accept=".sun-panel.json,.json" class="hidden" @change="handleImportFile" />
            <div class="flex gap-4">
              <NButton type="primary" :loading="importExportLoading" @click="handleExport">导出数据</NButton>
              <NButton :loading="importExportLoading" @click="fileInputRef?.click()">导入数据</NButton>
            </div>
          </div>

          <!-- ====== 用户管理 ====== -->
          <div v-if="activeApp === 'Users'" class="flex flex-col gap-4">
            <UsersManage />
          </div>

          <!-- ====== 站点设置 ====== -->
          <div v-if="activeApp === 'SiteSettings'" class="flex flex-col gap-4">
            <div><label class="block text-sm mb-1 font-medium">站点标题 (浏览器标签页)</label>
              <input :value="localSiteConfig.site_title" @input="(e: any) => localSiteConfig.site_title = e.target.value" class="w-full border rounded px-3 py-2 text-sm" placeholder="站点标题" /></div>
            <div><label class="block text-sm mb-1 font-medium">网站图标 URL (favicon)</label>
              <input :value="localSiteConfig.favicon_url" @input="(e: any) => localSiteConfig.favicon_url = e.target.value" class="w-full border rounded px-3 py-2 text-sm" placeholder="输入图标URL，显示在浏览器标签页上" /></div>
            <div><label class="block text-sm mb-1 font-medium">登录页背景图片</label>
              <input :value="localSiteConfig.login_bg_image" @input="(e: any) => localSiteConfig.login_bg_image = e.target.value" class="w-full border rounded px-3 py-2 text-sm" placeholder="输入图片URL" /></div>
            <div><label class="block text-sm mb-1 font-medium">页头 Logo 文字</label>
              <input :value="localSiteConfig.logo_text" @input="(e: any) => localSiteConfig.logo_text = e.target.value" class="w-full border rounded px-3 py-2 text-sm" placeholder="Sun-Panel" /></div>
            <div><label class="block text-sm mb-1 font-medium">页头 Logo 图片 URL</label>
              <input :value="localSiteConfig.logo_image_src" @input="(e: any) => localSiteConfig.logo_image_src = e.target.value" class="w-full border rounded px-3 py-2 text-sm" placeholder="输入图片URL，显示在页面左上角" /></div>
            <div><label class="block text-sm mb-1 font-medium">自定义页脚 (支持 HTML)</label>
              <textarea :value="localSiteConfig.footer_html" @input="(e: any) => localSiteConfig.footer_html = e.target.value" class="w-full border rounded px-3 py-2 text-sm" rows="3" placeholder="<p>© 2024 Sun-Panel</p>" /></div>
            <div class="flex justify-end gap-2 pt-2 border-t">
              <NButton type="primary" @click="handleSaveSiteSettings">保存</NButton>
            </div>
          </div>

        </div>
      </NLayoutContent>
    </NLayout>

    <!-- 分组编辑弹窗 -->
    <NModal v-model:show="editGroupModalVisible" title="编辑分组" preset="card" class="w-[400px]">
      <div v-if="editingGroup" class="flex flex-col gap-4">
        <div><label class="block text-sm mb-1">分组名称 *</label>
          <input v-model="editingGroup.title" class="w-full border rounded px-3 py-2 text-sm" placeholder="请输入分组名称" /></div>
        <div class="flex items-center gap-2">
          <label class="text-sm">访客可见</label>
          <NSwitch v-model:value="editingGroup.publicVisible" :checked-value="1" :unchecked-value="0" />
        </div>
        <div class="flex justify-end gap-2">
          <NButton @click="editGroupModalVisible = false">取消</NButton>
          <NButton type="primary" @click="handleSaveGroup">保存</NButton>
        </div>
      </div>
    </NModal>
  </NModal>
</template>

<style scoped>
:deep(.n-layout) { background-color: transparent !important; }
</style>