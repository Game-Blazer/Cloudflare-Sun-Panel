<script setup lang="ts">
import { NBackTop, NButton, NButtonGroup, NModal, NSpin, useMessage } from 'naive-ui'
import { onMounted, ref, computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useRouter } from 'vue-router'
import { useAuthStore, usePanelState } from '@/store'
import { VisitMode } from '@/store/modules/auth'
import { getGroupList, saveGroupSort } from '@/api/index'
import { getItemsByGroup, addItems, editItem, deleteItems, saveItemSort } from '@/api/index'
import { getUserConfig } from '@/api/index'
import { getAbout } from '@/api/index'
import HomeAppStarter from './components/HomeAppStarter.vue'

interface ItemGroup extends Panel.ItemIconGroup {
  hoverStatus?: boolean
  items: Panel.ItemInfo[]
  sortStatus?: boolean
}

const router = useRouter()
const message = useMessage()
const authStore = useAuthStore()
const panelState = usePanelState()

const groups = ref<ItemGroup[]>([])
const loading = ref(true)
const SITE_CACHE_KEY = 'sun-panel-site-config'

// 先从 localStorage 恢复站点配置（避免闪烁）
function loadCachedSiteConfig(): Panel.SiteConfig {
  try {
    const cached = localStorage.getItem(SITE_CACHE_KEY)
    if (cached) return JSON.parse(cached) as Panel.SiteConfig
  } catch { /* ignore */ }
  return {}
}

const siteConfig = ref<Panel.SiteConfig>(loadCachedSiteConfig())
const siteConfigLoaded = ref(false)

// 立即用缓存值设置标题和图标
if (siteConfig.value.site_title) {
  document.title = siteConfig.value.site_title
}
if (siteConfig.value.favicon_url) {
  updateFavicon(siteConfig.value.favicon_url)
}

// 编辑弹窗
const editModalShow = ref(false)
const editingItem = ref<Panel.ItemInfo>({
  title: '', url: '', openMethod: 1,
  icon: { itemType: 0, text: '', backgroundColor: '#4a90d9' },
  itemIconGroupId: undefined,
})
const editingGroupId = ref<number>()

// AppStarter
const starterShow = ref(false)

const scrollContainerRef = ref<HTMLElement>()

// ====== 样式 ======
const backgroundStyle = computed(() => {
  const config = panelState.panelConfig
  const style: Record<string, string> = {}
  if (config.backgroundImageSrc) {
    style.backgroundImage = `url(${config.backgroundImageSrc})`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
    style.backgroundRepeat = 'no-repeat'
  }
  return style
})

const containerStyle = computed(() => {
  const config = panelState.panelConfig
  return {
    maxWidth: `${config.maxWidth || 1200}${config.maxWidthUnit || 'px'}`,
    marginTop: `${config.marginTop || 40}px`,
    marginBottom: `${config.marginBottom || 40}px`,
    paddingLeft: `${config.marginX || 20}px`,
    paddingRight: `${config.marginX || 20}px`,
  }
})

const logoText = computed(() => siteConfig.value.logo_text || 'Sun-Panel')

const visibleGroups = computed(() => {
  if (!authStore.isVisitMode) return groups.value
  return groups.value.filter(g => g.publicVisible !== 0)
})

function openUrl(item: Panel.ItemInfo) {
  let url = item.url
  switch (item.openMethod) {
    case 1: window.location.href = url; break
    case 2: window.open(url, '_blank'); break
    default: window.location.href = url
  }
}

// ====== favicon ======
function updateFavicon(url: string) {
  let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
  if (!url) {
    if (link) link.remove()
    return
  }
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = url
}

// ====== 数据加载 ======
async function loadSiteConfig() {
  try {
    const res = await getAbout<Record<string, string>>()
    if (res.code === 0) {
      siteConfig.value = {
        site_title: res.data?.site_title || '',
        login_bg_image: res.data?.login_bg_image || '',
        footer_html: res.data?.footer_html || '',
        logo_text: res.data?.logo_text || '',
        logo_image_src: res.data?.logo_image_src || '',
        favicon_url: res.data?.favicon_url || '',
      }
      localStorage.setItem(SITE_CACHE_KEY, JSON.stringify(siteConfig.value))
      siteConfigLoaded.value = true
      document.title = siteConfig.value.site_title || 'Sun-Panel'
      updateFavicon(siteConfig.value.favicon_url || '')
      if ((res.data?.panel_public_user_id || res.data?.default_guest_mode === '1') && !authStore.token && !authStore.isVisitMode) {
        authStore.setVisitMode(VisitMode.VISIT_MODE_PUBLIC)
      }
    }
  } catch { /* ignore */ }
}

async function loadData() {
  loading.value = true
  try {
    const res = await getGroupList<Panel.ItemIconGroup[]>()
    if (res.code === 0) {
      const list = (res.data || []) as ItemGroup[]
      groups.value = list.map(g => ({ ...g, hoverStatus: false, sortStatus: false, items: [] }))
      for (const g of groups.value) {
        if (g.id) {
          const itemRes = await getItemsByGroup<Panel.ItemInfo[]>(g.id)
          if (itemRes.code === 0) g.items = itemRes.data || []
        }
      }
    }
  } catch (e) { console.error(e) } finally { loading.value = false }
}

async function loadPanelConfig() {
  try {
    const res = await getUserConfig<Panel.userConfig>()
    if (res.code === 0 && res.data?.panel) panelState.updatePanelConfigFromCloud(res.data.panel)
  } catch { /* ignore */ }
}

function refreshAll() {
  loadData()
  loadPanelConfig()
  loadSiteConfig()
}

onMounted(() => {
  loadSiteConfig()
  loadData()
  loadPanelConfig()
})

// ====== 图标编辑 ======
function openAddItem(groupId: number) {
  editingItem.value = {
    title: '', url: '', description: '', openMethod: 1,
    icon: { itemType: 0, text: '', backgroundColor: '#4a90d9' },
    itemIconGroupId: groupId,
  }
  editingGroupId.value = groupId
  editModalShow.value = true
}

function openEditItem(item: Panel.ItemInfo) {
  editingItem.value = { ...item }
  editingGroupId.value = item.itemIconGroupId
  editModalShow.value = true
}

async function handleSaveItem() {
  const item = editingItem.value
  if (!item?.title) { message.warning('请输入标题'); return }
  try {
    const res = item.id ? await editItem<Panel.ItemInfo>(item) : await addItems<Panel.ItemInfo[]>([item])
    if (res.code === 0) { message.success('保存成功'); editModalShow.value = false; await loadData() }
    else message.error(res.msg || '保存失败')
  } catch { message.error('网络错误') }
}

async function handleDeleteItem(item: Panel.ItemInfo) {
  if (!item.id) return
  try {
    const res = await deleteItems([item.id])
    if (res.code === 0) { message.success('删除成功'); await loadData() }
    else message.error(res.msg || '删除失败')
  } catch { message.error('网络错误') }
}

// ====== 排序 ======
async function saveGroupSortOrder() {
  const sortItems = groups.value.filter(g => g.id).map((g, i) => ({ id: g.id!, sort: i }))
  try { const res = await saveGroupSort(sortItems); if (res.code === 0) message.success('排序已保存') } catch { /* ignore */ }
}

async function saveItemSortOrder(group: ItemGroup) {
  const sortItems = (group.items || []).filter(g => g.id).map((item, i) => ({ id: item.id!, sort: i }))
  try { const res = await saveItemSort({ sortItems, itemIconGroupId: group.id! }); if (res.code === 0) message.success('排序已保存') } catch { /* ignore */ }
}

// ====== AppStarter 回调 ======
function handleStarterSaved() { refreshAll() }
function handleSiteConfigUpdate(config: Panel.SiteConfig) {
  siteConfig.value = config
  localStorage.setItem(SITE_CACHE_KEY, JSON.stringify(config))
  document.title = config.site_title || 'Sun-Panel'
  updateFavicon(config.favicon_url || '')
}
</script>

<template>
  <div ref="scrollContainerRef" class="min-h-screen relative bg-gray-900 transition-all flex flex-col" :style="backgroundStyle">
    <!-- 背景遮罩层 -->
    <div v-if="panelState.panelConfig.backgroundImageSrc" class="absolute inset-0 bg-black/50 pointer-events-none"
      :style="{ backdropFilter: `blur(${panelState.panelConfig.backgroundBlur || 0}px)`, opacity: panelState.panelConfig.backgroundMaskNumber ?? 0.3 }" />

    <!-- 顶部：Logo + 访客标识 -->
    <div class="relative z-10 flex justify-between items-center p-4">
      <div class="flex items-center gap-3">
        <img v-if="siteConfig.logo_image_src" :src="siteConfig.logo_image_src" class="h-8 rounded" alt="Logo" />
        <span class="text-white text-xl font-bold">{{ logoText }}</span>
        <span v-if="authStore.isVisitMode" class="text-yellow-400 text-xs bg-yellow-900/50 px-2 py-0.5 rounded">访客模式</span>
      </div>
      <!-- 顶部不放置任何按钮 -->
      <div></div>
    </div>

    <!-- 主内容区域 -->
    <div class="relative z-10 mx-auto flex-1 w-full" :style="containerStyle">
      <NSpin :show="loading">
        <VueDraggable v-model="groups" :animation="200" handle=".group-drag-handle" :disabled="authStore.isVisitMode" @end="saveGroupSortOrder">
          <template v-for="(group, gi) in visibleGroups" :key="group.id || gi">
            <div class="mb-6">
              <div class="flex items-center gap-2 mb-3 px-2">
                <span v-if="!authStore.isVisitMode" class="group-drag-handle cursor-move text-gray-400 text-sm">::</span>
                <h3 class="text-white text-lg font-medium flex-1">{{ group.title }}</h3>
                <NButton v-if="!authStore.isVisitMode" size="tiny" @click="openAddItem(group.id!)">+ 添加</NButton>
              </div>
              <VueDraggable v-model="group.items" :animation="200" :disabled="authStore.isVisitMode" class="flex flex-wrap gap-3" @end="saveItemSortOrder(group)">
                <div v-for="(item, ii) in group.items" :key="item.id || ii"
                  class="group-item w-24 h-24 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all hover:bg-white/10 hover:scale-105 relative bg-white/5"
                  @click="openUrl(item)">
                  <div class="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center mb-1">
                    <img v-if="item.icon?.src" :src="item.icon.src" class="w-full h-full object-cover" :alt="item.title" />
                    <div v-else class="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-lg"
                      :style="{ backgroundColor: item.icon?.backgroundColor || '#4a90d9' }">
                      {{ item.icon?.text || item.title?.charAt(0) || '?' }}
                    </div>
                  </div>
                  <span class="text-white text-xs text-center line-clamp-2 px-1">{{ item.title }}</span>
                  <div v-if="!authStore.isVisitMode" class="absolute top-1 right-1 opacity-0 group-item-hover:opacity-100 transition-opacity flex gap-1">
                    <NButton size="tiny" @click.stop="openEditItem(item)">编辑</NButton>
                    <NButton size="tiny" type="error" @click.stop="handleDeleteItem(item)">删除</NButton>
                  </div>
                </div>
              </VueDraggable>
              <div v-if="!group.items || group.items.length === 0" class="text-center text-gray-400 py-4 text-sm">
                {{ authStore.isVisitMode ? '暂无图标' : '暂无图标，点击" + 添加"创建' }}
              </div>
            </div>
          </template>
        </VueDraggable>
      </NSpin>
    </div>

    <!-- 自定义页脚 -->
    <div v-if="siteConfig.footer_html" class="relative z-10 text-center py-4 text-gray-400 text-sm" v-html="siteConfig.footer_html" />

    <NBackTop :listen-to="() => scrollContainerRef" :right="10" :bottom="10" style="background-color:transparent;border:none;box-shadow:none;">
      <div class="shadow-[0_0_10px_2px_rgba(0,0,0,0.2)] rounded-lg">
        <NButton color="#2a2a2a6b">
          <template #icon><span class="text-white text-lg">▲</span></template>
        </NButton>
      </div>
    </NBackTop>

    <!-- ========== 右下角浮动按钮（参照原项目） ========== -->
    <div class="fixed right-2.5 bottom-[50px] shadow-[0_0_10px_2px_rgba(0,0,0,0.2)] rounded-lg overflow-hidden">
      <NButtonGroup vertical>
        <!-- 已登录：应用启动器按钮 -->
        <NButton v-if="!authStore.isVisitMode" color="#2a2a2a6b" @click="starterShow = !starterShow">
          <template #icon><span class="text-white text-lg">⚙</span></template>
        </NButton>
        <!-- 访客模式：跳转登录按钮 -->
        <NButton v-if="authStore.isVisitMode" color="#2a2a2a6b" title="登录" @click="router.push('/login')">
          <template #icon><span class="text-white text-lg">👤</span></template>
        </NButton>
      </NButtonGroup>
    </div>

    <!-- ========== AppStarter 应用启动器 ========== -->
    <HomeAppStarter
      v-model:visible="starterShow"
      :site-config="siteConfig"
      :groups="groups"
      :on-saved="handleStarterSaved"
      @update:site-config="handleSiteConfigUpdate"
    />

    <!-- ========== 编辑图标弹窗 ========== -->
    <NModal v-model:show="editModalShow" title="编辑图标" preset="card" class="w-[500px]">
      <div v-if="editingItem" class="flex flex-col gap-4">
        <div><label class="block text-sm mb-1">标题 *</label><input v-model="editingItem.title" class="w-full border rounded px-3 py-2 text-sm" placeholder="请输入标题" /></div>
        <div><label class="block text-sm mb-1">网址 *</label><input v-model="editingItem.url" class="w-full border rounded px-3 py-2 text-sm" placeholder="https://" /></div>
        <div><label class="block text-sm mb-1">描述</label><input v-model="editingItem.description" class="w-full border rounded px-3 py-2 text-sm" placeholder="描述信息" /></div>
        <div><label class="block text-sm mb-1">图标文字</label><input v-model="editingItem.icon.text" class="w-full border rounded px-3 py-2 text-sm" placeholder="图标显示文字" /></div>
        <div><label class="block text-sm mb-1">图标图片 URL</label><input v-model="editingItem.icon.src" class="w-full border rounded px-3 py-2 text-sm" placeholder="输入图标图片URL，留空使用文字图标" /></div>
        <div><label class="block text-sm mb-1">图标背景色</label><input v-model="editingItem.icon.backgroundColor" class="w-full border rounded px-3 py-2 text-sm" placeholder="#4a90d9" /></div>
        <div>
          <label class="block text-sm mb-1">打开方式</label>
          <select v-model="editingItem.openMethod" class="w-full border rounded px-3 py-2 text-sm">
            <option :value="1">当前页面打开</option>
            <option :value="2">新窗口打开</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <NButton @click="editModalShow = false">取消</NButton>
          <NButton type="primary" @click="handleSaveItem">保存</NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.group-item:hover .group-item-hover\:opacity-100 { opacity: 1; }
.group-item-hover\:opacity-100 { opacity: 0; }
</style>