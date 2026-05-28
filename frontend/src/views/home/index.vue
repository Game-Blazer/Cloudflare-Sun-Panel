<script setup lang="ts">
import { NBackTop, NButton, NModal, NSpin, NTooltip, useMessage } from 'naive-ui'
import { onMounted, ref, computed, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useAuthStore, usePanelState } from '@/store'
import { getGroupList } from '@/api/index'
import { getItemsByGroup, addItems, editItem, deleteItems, saveItemSort } from '@/api/index'
import { getUserConfig } from '@/api/index'
import { getAbout, getAuthInfo } from '@/api/index'
import HomeAppStarter from './components/HomeAppStarter.vue'
import HomeSidebar from './components/HomeSidebar.vue'

interface ItemGroup extends Panel.ItemIconGroup {
  hoverStatus?: boolean
  items: Panel.ItemInfo[]
  sortStatus?: boolean
}

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

// 分组编辑模式（控制每个分组内是否可排序/编辑/删除）
const editModeGroupId = ref<number | null>(null)

function toggleEditMode(groupId: number) {
  editModeGroupId.value = editModeGroupId.value === groupId ? null : groupId
}

// ====== 公告 ======
const announcementVisible = ref(false)
let announcementTimer: ReturnType<typeof setTimeout> | null = null

const announcementText = computed(() => panelState.panelConfig.announcement || '')
const announcementDuration = computed(() => {
  const d = panelState.panelConfig.announcementDuration
  return d && d > 0 ? d : 5
})

function startAnnouncementTimer() {
  clearAnnouncementTimer()
  if (!announcementText.value) {
    announcementVisible.value = false
    return
  }
  announcementVisible.value = true
  const dur = announcementDuration.value
  if (dur > 0) {
    announcementTimer = setTimeout(() => {
      announcementVisible.value = false
    }, dur * 1000)
  }
}

function clearAnnouncementTimer() {
  if (announcementTimer) { clearTimeout(announcementTimer); announcementTimer = null }
}

function dismissAnnouncement() {
  clearAnnouncementTimer()
  announcementVisible.value = false
}

// 监视公告配置变化
watch([announcementText, announcementDuration], () => {
  startAnnouncementTimer()
})

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

const logoText = computed(() => panelState.panelConfig.logoText || '')

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

/** 同步本地用户信息与认证状态 - 参照原项目 updateLocalUserInfo */
interface AuthInfoResponse {
  user: User.Info
  visitMode: number
}
async function updateLocalUserInfo() {
  try {
    const res = await getAuthInfo<AuthInfoResponse>()
    if (res.code === 0 && res.data) {
      authStore.setUserInfo(res.data.user)
      authStore.setVisitMode(res.data.visitMode)
    }
  } catch { /* ignore */ }
}

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
      // 并行获取所有分组的图标
      await Promise.all(
        groups.value.map(async (g) => {
          if (g.id) {
            const itemRes = await getItemsByGroup<Panel.ItemInfo[]>(g.id)
            if (itemRes.code === 0) g.items = itemRes.data || []
          }
        })
      )
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
  updateLocalUserInfo().then(() => {
    Promise.all([loadData(), loadPanelConfig(), loadSiteConfig()])
  })
}

onMounted(async () => {
  await updateLocalUserInfo() // 优先同步认证状态，避免渲染时显示错误的角色
  loadSiteConfig() // siteConfig 有本地缓存兜底，无需 await
  loadData()
  loadPanelConfig()
  startAnnouncementTimer()
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
  <!-- 壁纸层 - filter blur 直接作用于背景图，GPU 加速 -->
  <div v-if="panelState.panelConfig.backgroundImageSrc" class="fixed inset-0 z-[1]" :style="{
    filter: `blur(${panelState.panelConfig.backgroundBlur || 0}px)`,
    backgroundImage: `url(${panelState.panelConfig.backgroundImageSrc})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    transform: 'translateZ(0)',
    willChange: 'transform',
  }" />
  <!-- 遮罩层 -->
  <div v-if="panelState.panelConfig.backgroundImageSrc" class="fixed inset-0 z-[1]" :style="{
    backgroundColor: `rgba(0,0,0,${panelState.panelConfig.backgroundMaskNumber ?? 0.3})`
  }" />

  <div ref="scrollContainerRef" class="min-h-screen relative transition-all flex flex-col scroll-container" :class="{ 'bg-gray-900': !panelState.panelConfig.backgroundImageSrc }">
    <!-- 侧边栏分组导航 -->
    <HomeSidebar :groups="visibleGroups" @open-settings="starterShow = true" />

    <!-- 顶部：Logo + 访客标识 -->
    <div v-if="panelState.panelConfig.logoText || panelState.panelConfig.logoImageSrc || authStore.isVisitMode" class="sticky top-0 z-20 flex justify-between items-center p-4">
      <div class="flex items-center gap-3">
        <img v-if="panelState.panelConfig.logoImageSrc" :src="panelState.panelConfig.logoImageSrc" class="h-8 rounded" alt="Logo" decoding="async" />
        <span v-if="logoText" class="text-white text-xl font-bold">{{ logoText }}</span>
        <span v-if="authStore.isVisitMode" class="text-yellow-400 text-xs bg-yellow-900/50 px-2 py-0.5 rounded">访客模式</span>
      </div>
    </div>

    <!-- 公告 -->
    <Transition name="announce-fade">
      <div v-if="announcementVisible && announcementText" class="fixed top-4 right-4 z-30 pointer-events-none">
        <div class="flex items-start gap-3 max-w-sm pointer-events-auto bg-white/15 backdrop-blur-lg text-white px-4 py-3 rounded-xl shadow-lg text-sm leading-relaxed border border-white/10">
          <span class="flex-1">{{ announcementText }}</span>
          <button @click="dismissAnnouncement" class="text-white/60 hover:text-white flex-shrink-0 text-lg leading-none">&times;</button>
        </div>
      </div>
    </Transition>

    <!-- 主内容区域 -->
    <div class="relative z-10 mx-auto flex-1 w-full" :style="containerStyle">
      <NSpin :show="loading">
        <template v-for="(group, gi) in visibleGroups" :key="group.id || gi">
          <div class="mb-6 group-section" :class="`item-group-index-${gi}`">
            <div class="flex items-center gap-2 mb-3 px-2 group-title-row">
              <h3 class="text-white text-lg font-medium">{{ group.title }}</h3>
              <div class="group-title-btns opacity-0 transition-opacity duration-200 flex items-center gap-1">
                <NTooltip v-if="!authStore.isVisitMode" trigger="hover" placement="top">
                  <template #trigger>
                    <NButton size="tiny" :type="editModeGroupId === group.id ? 'warning' : 'default'" @click="toggleEditMode(group.id!)" class="!px-2 !min-w-0">
                      {{ editModeGroupId === group.id ? '✓' : '✎' }}
                    </NButton>
                  </template>
                  {{ editModeGroupId === group.id ? '完成' : '编辑' }}
                </NTooltip>
                <NTooltip v-if="!authStore.isVisitMode" trigger="hover" placement="top">
                  <template #trigger>
                    <NButton size="tiny" @click="openAddItem(group.id!)" class="!px-2 !min-w-0">+</NButton>
                  </template>
                  添加
                </NTooltip>
              </div>
            </div>
            <VueDraggable v-if="editModeGroupId === group.id" v-model="group.items" :animation="200" class="flex flex-wrap gap-3" @end="saveItemSortOrder(group)">
              <div v-for="(item, ii) in group.items" :key="item.id || ii"
                class="group-item w-24 h-24 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all hover:bg-white/10 hover:scale-105 relative bg-white/5"
                @click="openUrl(item)">
                <div class="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center mb-1">
                  <img v-if="item.icon?.src" :src="item.icon.src" class="w-full h-full object-cover" :alt="item.title" loading="lazy" decoding="async" />
                  <div v-else class="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    :style="{ backgroundColor: item.icon?.backgroundColor || '#4a90d9' }">
                    {{ item.icon?.text || item.title?.charAt(0) || '?' }}
                  </div>
                </div>
                <span class="text-white text-xs text-center line-clamp-2 px-1">{{ item.title }}</span>
                <div class="absolute top-1 right-1 flex gap-1">
                  <NTooltip trigger="hover" placement="top">
                    <template #trigger>
                      <NButton size="tiny" @click.stop="openEditItem(item)" class="!px-2 !min-w-0">✎</NButton>
                    </template>
                    编辑
                  </NTooltip>
                  <NTooltip trigger="hover" placement="top">
                    <template #trigger>
                      <NButton size="tiny" type="error" @click.stop="handleDeleteItem(item)" class="!px-2 !min-w-0">✕</NButton>
                    </template>
                    删除
                  </NTooltip>
                </div>
              </div>
            </VueDraggable>
            <div v-else class="flex flex-wrap gap-3">
              <NTooltip v-for="(item, ii) in group.items" :key="item.id || ii" trigger="hover" :disabled="!item.description" placement="bottom">
                <template #trigger>
                  <div class="group-item w-24 h-24 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all hover:bg-white/10 hover:scale-105 relative bg-white/5"
                    @click="openUrl(item)">
                    <div class="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center mb-1">
                      <img v-if="item.icon?.src" :src="item.icon.src" class="w-full h-full object-cover" :alt="item.title" loading="lazy" decoding="async" />
                      <div v-else class="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-lg"
                        :style="{ backgroundColor: item.icon?.backgroundColor || '#4a90d9' }">
                        {{ item.icon?.text || item.title?.charAt(0) || '?' }}
                      </div>
                    </div>
                    <span class="text-white text-xs text-center line-clamp-2 px-1">{{ item.title }}</span>
                  </div>
                </template>
                <span>{{ item.description }}</span>
              </NTooltip>
            </div>
            <div v-if="!group.items || group.items.length === 0" class="text-center text-gray-400 py-4 text-sm">
              {{ authStore.isVisitMode ? '暂无图标' : '暂无图标，点击" + 添加"创建' }}
            </div>
          </div>
        </template>
      </NSpin>
    </div>

    <!-- 自定义页脚 -->
    <div v-if="panelState.panelConfig.footerHtml" class="sticky bottom-0 z-20 text-center py-4 text-gray-400 text-sm" v-html="panelState.panelConfig.footerHtml" />

    <NBackTop :listen-to="() => scrollContainerRef" :right="10" :bottom="10" style="background-color:transparent;border:none;box-shadow:none;">
      <div class="shadow-[0_0_10px_2px_rgba(0,0,0,0.2)] rounded-lg">
        <NButton color="#2a2a2a6b">
          <template #icon><span class="text-white text-lg">▲</span></template>
        </NButton>
      </div>
    </NBackTop>

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
        <div><label class="block text-sm mb-1">图标文字</label><input v-model="editingItem.icon!.text" class="w-full border rounded px-3 py-2 text-sm" placeholder="图标显示文字" /></div>
        <div><label class="block text-sm mb-1">图标图片 URL</label><input v-model="editingItem.icon!.src" class="w-full border rounded px-3 py-2 text-sm" placeholder="输入图标图片URL，留空使用文字图标" /></div>
        <div><label class="block text-sm mb-1">图标背景色</label><input v-model="editingItem.icon!.backgroundColor" class="w-full border rounded px-3 py-2 text-sm" placeholder="#4a90d9" /></div>
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
.group-section:hover .group-title-btns {
  opacity: 1;
}

.announce-fade-enter-active,
.announce-fade-leave-active {
  transition: opacity 0.4s ease;
}
.announce-fade-enter-from,
.announce-fade-leave-to {
  opacity: 0;
}
</style>