<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useAuthStore, usePanelState } from '@/store'
import { addItems, editItem, deleteItems, saveItemSort } from '@/api/index'
import { getSiteFavicon } from '@/api/index'
import { getInit } from '@/api/index'
import { invalidateCacheByPrefix } from '@/utils/requestCache'
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
const initDone = ref(false)
const SITE_CACHE_KEY = 'sun-panel-site-config'

function loadCachedSiteConfig(): Panel.SiteConfig {
  try {
    const cached = localStorage.getItem(SITE_CACHE_KEY)
    if (cached) return JSON.parse(cached) as Panel.SiteConfig
  } catch { /* ignore */ }
  return {}
}

const siteConfig = ref<Panel.SiteConfig>(loadCachedSiteConfig())

const effectiveWallpaper = computed(() => {
  return panelState.panelConfig.backgroundImageSrc || siteConfig.value.login_bg_image || ''
})

if (effectiveWallpaper.value) {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = effectiveWallpaper.value
  link.setAttribute('fetchpriority', 'high')
  document.head.appendChild(link)
}

if (siteConfig.value.site_title) {
  document.title = siteConfig.value.site_title
}
if (siteConfig.value.favicon_url) {
  updateFavicon(siteConfig.value.favicon_url)
}

const editModalShow = ref(false)
const editingItem = ref<Panel.ItemInfo>({
  title: '', url: '', openMethod: 2,
  icon: { itemType: 0, text: '', backgroundColor: '#4a90d9' },
  itemIconGroupId: undefined,
})
const editingGroupId = ref<number>()
const getIconLoading = ref(false)

const editModeGroupId = ref<number | null>(null)

function toggleEditMode(groupId: number) {
  editModeGroupId.value = editModeGroupId.value === groupId ? null : groupId
}

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

watch([announcementText, announcementDuration], () => {
  startAnnouncementTimer()
})

const starterShow = ref(false)

const windowShow = ref(false)
const windowSrc = ref('')
const windowTitle = ref('')
const windowIframeRef = ref(null)
const windowIframeIsLoad = ref(false)

const scrollContainerRef = ref<HTMLElement>()

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

const logoFloatStyle = computed(() => ({
  top: `${panelState.panelConfig.logoPositionTop ?? 16}px`,
  left: `${panelState.panelConfig.logoPositionLeft ?? 16}px`,
}))

const logoImageStyle = computed(() => {
  const size = panelState.panelConfig.logoSize ?? 48
  return {
    maxHeight: `${size}px`,
    maxWidth: `${size * 3.75}px`,
  }
})

const logoHovered = ref(false)
const logoEditMode = ref(false)
const logoDragging = ref(false)
let logoDragStart = { x: 0, y: 0 }
let logoDragStartPos = { top: 0, left: 0 }

function toggleLogoEdit() {
  logoEditMode.value = !logoEditMode.value
}

function onLogoMouseDown(e: MouseEvent) {
  if (!logoEditMode.value) return
  logoDragging.value = true
  logoDragStart = { x: e.clientX, y: e.clientY }
  logoDragStartPos = {
    top: panelState.panelConfig.logoPositionTop ?? 16,
    left: panelState.panelConfig.logoPositionLeft ?? 16,
  }
  document.addEventListener('mousemove', onLogoMouseMove)
  document.addEventListener('mouseup', onLogoMouseUp)
}

function onLogoMouseMove(e: MouseEvent) {
  if (!logoDragging.value) return
  panelState.panelConfig.logoPositionTop = Math.max(0, logoDragStartPos.top + (e.clientY - logoDragStart.y))
  panelState.panelConfig.logoPositionLeft = Math.max(0, logoDragStartPos.left + (e.clientX - logoDragStart.x))
}

function onLogoMouseUp() {
  logoDragging.value = false
  document.removeEventListener('mousemove', onLogoMouseMove)
  document.removeEventListener('mouseup', onLogoMouseUp)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onLogoMouseMove)
  document.removeEventListener('mouseup', onLogoMouseUp)
})

const wallpaperStyle = computed(() => {
  if (!effectiveWallpaper.value) return {}
  return {
    filter: `blur(${panelState.panelConfig.backgroundBlur || 0}px)`,
  }
})

const glassVars = computed(() => ({
  '--ann-blur': `${panelState.panelConfig.announcementBlur ?? 12}px`,
  '--ann-opacity': panelState.panelConfig.announcementMaskOpacity ?? 0.15,
}))

function syncGlassVars() {
  const blur = panelState.panelConfig.announcementBlur ?? 12
  const opacity = panelState.panelConfig.announcementMaskOpacity ?? 0.15
  document.documentElement.style.setProperty('--ann-blur', `${blur}px`)
  document.documentElement.style.setProperty('--ann-opacity', `${opacity}`)
}

watch(
  () => [panelState.panelConfig.announcementBlur, panelState.panelConfig.announcementMaskOpacity],
  () => syncGlassVars()
)

const visibleGroups = computed(() => {
  if (!authStore.isVisitMode) return groups.value
  return groups.value.filter(g => g.publicVisible !== 0)
})

function openUrl(item: Panel.ItemInfo) {
  let url = item.url
  switch (item.openMethod) {
    case 1: window.location.href = url; break
    case 2: window.open(url, '_blank'); break
    case 3:
      windowShow.value = true
      windowSrc.value = url
      windowTitle.value = item.title || url
      windowIframeIsLoad.value = true
      break
    default: window.location.href = url
  }
}

function handWindowIframeIdLoad() {
  windowIframeIsLoad.value = false
}

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

async function loadInitData() {
  loading.value = true
  try {
    const res = await getInit()
    if (res.code === 0 && res.data) {
      const { user, visitMode, siteConfig: sc, groups: rawGroups, itemsMap, panelConfig } = res.data

      if (user) {
        authStore.setUserInfo(user)
      }
      authStore.setVisitMode(visitMode)

      if (sc && typeof sc === 'object') {
        Object.assign(siteConfig.value, sc)
        localStorage.setItem(SITE_CACHE_KEY, JSON.stringify(sc))
        document.title = sc.site_title || 'Sun-Panel'
        updateFavicon(sc.favicon_url || '')
      }

      groups.value = (rawGroups || []).map(g => ({
        ...g, hoverStatus: false, sortStatus: false,
        items: (g.id && itemsMap[g.id]) ? itemsMap[g.id] : [],
      })) as ItemGroup[]

      if (panelConfig && Object.keys(panelConfig).length > 0) {
        panelState.updatePanelConfigFromCloud(panelConfig)
      }
    }
  } catch (e) { console.error(e) } finally { loading.value = false; initDone.value = true }
}

function refreshAll() {
  invalidateCacheByPrefix('panel:')
  loadInitData()
}

onMounted(async () => {
  syncGlassVars()
  loadInitData()
  startAnnouncementTimer()
})

function openAddItem(groupId: number) {
  editingItem.value = {
    title: '', url: '', description: '', openMethod: 2,
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
    if (res.code === 0) { message.success('保存成功'); editModalShow.value = false; invalidateCacheByPrefix('panel:'); await loadInitData() }
    else message.error(res.msg || '保存失败')
  } catch { message.error('网络错误') }
}

async function getIconByUrl() {
  if (!editingItem.value.url) return
  getIconLoading.value = true
  try {
    const res = await getSiteFavicon<{ iconUrl: string }>(editingItem.value.url)
    if (res.code === 0 && res.data) {
      editingItem.value.icon!.src = res.data.iconUrl
      message.success('图标获取成功')
    } else {
      message.error(res.msg || '获取图标失败')
    }
  } catch {
    message.error('网络错误')
  } finally {
    getIconLoading.value = false
  }
}

async function handleDeleteItem(item: Panel.ItemInfo) {
  if (!item.id) return
  try {
    const res = await deleteItems([item.id])
    if (res.code === 0) { message.success('删除成功'); invalidateCacheByPrefix('panel:'); await loadInitData() }
    else message.error(res.msg || '删除失败')
  } catch { message.error('网络错误') }
}

async function saveItemSortOrder(group: ItemGroup) {
  const sortItems = (group.items || []).filter(g => g.id).map((item, i) => ({ id: item.id!, sort: i }))
  try { const res = await saveItemSort({ sortItems, itemIconGroupId: group.id! }); if (res.code === 0) message.success('排序已保存') } catch { /* ignore */ }
}

function handleStarterSaved() { refreshAll() }
function handleSiteConfigUpdate(config: Panel.SiteConfig) {
  siteConfig.value = config
  localStorage.setItem(SITE_CACHE_KEY, JSON.stringify(config))
  document.title = config.site_title || 'Sun-Panel'
  updateFavicon(config.favicon_url || '')
}
</script>

<template>
  <img
    v-if="effectiveWallpaper"
    :src="effectiveWallpaper"
    class="fixed inset-0 z-[1] w-full h-full object-cover transition-opacity duration-700"
    :style="wallpaperStyle"
    fetchpriority="high"
    decoding="sync"
    alt=""
  />
  <div v-if="effectiveWallpaper" class="fixed inset-0 z-[1]" :style="{
    backgroundColor: `rgba(0,0,0,${panelState.panelConfig.backgroundMaskNumber ?? 0.3})`
  }" />

  <div ref="scrollContainerRef" class="min-h-screen relative transition-all flex flex-col scroll-container" :style="glassVars">
    <HomeSidebar :groups="visibleGroups" @open-settings="starterShow = true" />

    <div v-if="initDone && (panelState.panelConfig.logoText || panelState.panelConfig.logoImageSrc)"
      class="fixed z-30 glass-logo select-none"
      :class="{ 'cursor-move ring-2 ring-blue-400/60': logoEditMode, 'cursor-default': !logoEditMode }"
      :style="logoFloatStyle"
      @mousedown="onLogoMouseDown"
      @mouseenter="!authStore.isVisitMode && (logoHovered = true)"
      @mouseleave="logoHovered = false">
      <div
        v-if="logoHovered && !authStore.isVisitMode"
        class="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center cursor-pointer z-10 shadow-md transition-colors"
        :class="{ '!bg-green-500 hover:!bg-green-600': logoEditMode }"
        @click.stop="toggleLogoEdit"
        @mousedown.stop
      >
        <span class="text-white text-[10px] leading-none">{{ logoEditMode ? '✓' : '✎' }}</span>
      </div>
      <div class="flex items-center gap-3">
        <img
          v-if="panelState.panelConfig.logoImageSrc"
          :src="panelState.panelConfig.logoImageSrc"
          :style="logoImageStyle"
          class="object-contain pointer-events-none"
          alt="Logo" decoding="async"
        />
        <span v-if="logoText" class="text-white text-xl font-bold drop-shadow-lg pointer-events-none">{{ logoText }}</span>
      </div>
    </div>

    <Transition name="announce-fade">
      <div v-if="announcementVisible && announcementText" class="fixed top-4 right-4 z-30 pointer-events-none">
        <div class="flex items-start gap-3 max-w-sm pointer-events-auto glass-panel text-white px-4 py-3 rounded-xl shadow-lg text-sm leading-relaxed border border-white/10">
          <span class="flex-1">{{ announcementText }}</span>
          <button @click="dismissAnnouncement" class="text-white/60 hover:text-white flex-shrink-0 text-lg leading-none">&times;</button>
        </div>
      </div>
    </Transition>

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
                class="group-item w-24 h-24 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all hover:scale-105 relative glass-hover"
                @click="openUrl(item)">
                <div class="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center mb-1">
                  <img v-if="item.icon?.src" :src="item.icon.src" class="w-full h-full object-cover" :alt="item.title" loading="lazy" decoding="async" width="40" height="40" @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'" />
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
                  <div class="group-item w-24 h-24 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all hover:scale-105 relative glass-hover"
                    @click="openUrl(item)">
                    <div class="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center mb-1">
                      <img v-if="item.icon?.src" :src="item.icon.src" class="w-full h-full object-cover" :alt="item.title" loading="lazy" decoding="async" width="40" height="40" @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'" />
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

    <div v-if="initDone && panelState.panelConfig.footerHtml" class="sticky bottom-0 z-20 text-center py-4 text-sm" v-html="panelState.panelConfig.footerHtml" :style="{ color: 'rgba(255,255,255,0.85)' }" />

    <NBackTop :listen-to="() => scrollContainerRef" :right="10" :bottom="10" style="background-color:transparent;border:none;box-shadow:none;">
      <div class="shadow-[0_0_10px_2px_rgba(0,0,0,0.2)] rounded-lg">
        <NButton color="#2a2a2a6b">
          <template #icon><span class="text-white text-lg">▲</span></template>
        </NButton>
      </div>
    </NBackTop>

    <HomeAppStarter
      v-model:visible="starterShow"
      :site-config="siteConfig"
      :groups="groups"
      :on-saved="handleStarterSaved"
      @update:site-config="handleSiteConfigUpdate"
    />

    <NModal v-model:show="editModalShow" title="编辑图标" preset="card" class="w-[500px]">
      <div v-if="editingItem" class="flex flex-col gap-4">
        <div><label class="block text-sm mb-1">标题 *</label><input v-model="editingItem.title" class="w-full border rounded px-3 py-2 text-sm" placeholder="请输入标题" /></div>
        <div>
          <label class="block text-sm mb-1">网址 *</label>
          <div class="flex gap-2">
            <input v-model="editingItem.url" class="flex-1 border rounded px-3 py-2 text-sm" placeholder="https://" />
            <NButton :disabled="!editingItem.url" :loading="getIconLoading" @click="getIconByUrl">获取图标</NButton>
          </div>
        </div>
        <div><label class="block text-sm mb-1">描述</label><input v-model="editingItem.description" class="w-full border rounded px-3 py-2 text-sm" placeholder="描述信息" /></div>
        <div><label class="block text-sm mb-1">图标文字</label><input v-model="editingItem.icon!.text" class="w-full border rounded px-3 py-2 text-sm" placeholder="图标显示文字" /></div>
        <div><label class="block text-sm mb-1">图标图片 URL</label><input v-model="editingItem.icon!.src" class="w-full border rounded px-3 py-2 text-sm" placeholder="输入图标图片URL，留空使用文字图标" /></div>
        <div><label class="block text-sm mb-1">图标背景色</label><input v-model="editingItem.icon!.backgroundColor" class="w-full border rounded px-3 py-2 text-sm" placeholder="#4a90d9" /></div>
        <div>
          <label class="block text-sm mb-1">打开方式</label>
          <select v-model="editingItem.openMethod" class="w-full border rounded px-3 py-2 text-sm">
            <option :value="1">当前页面打开</option>
            <option :value="2">新窗口打开</option>
            <option :value="3">弹窗打开</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <NButton @click="editModalShow = false">取消</NButton>
          <NButton type="primary" @click="handleSaveItem">保存</NButton>
        </div>
      </div>
    </NModal>

    <NModal
      v-model:show="windowShow" :mask-closable="false" preset="card"
      class="max-w-[1000px] h-[600px] rounded-2xl" :bordered="true" size="small" role="dialog"
      aria-modal="true"
    >
      <template #header>
        <div class="flex items-center">
          <span class="mr-[20px]">{{ windowTitle }}</span>
          <NSpin v-if="windowIframeIsLoad" size="small" />
        </div>
      </template>
      <div class="w-full h-full rounded-2xl overflow-hidden border dark:border-zinc-700">
        <div v-if="windowIframeIsLoad" class="flex flex-col p-5">
          <NSkeleton height="50px" width="100%" class="rounded-lg" />
          <NSkeleton height="180px" width="100%" class="mt-[20px] rounded-lg" />
          <NSkeleton height="180px" width="100%" class="mt-[20px] rounded-lg" />
        </div>
        <iframe
          v-show="!windowIframeIsLoad" id="windowIframeId" ref="windowIframeRef" :src="windowSrc"
          class="w-full h-full" frameborder="0" @load="handWindowIframeIdLoad"
        />
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.group-section:hover .group-title-btns {
  opacity: 1;
}

.group-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 200px;
}

.announce-fade-enter-active,
.announce-fade-leave-active {
  transition: opacity 0.4s ease;
}
.announce-fade-enter-from,
.announce-fade-leave-to {
  opacity: 0;
}

.glass-panel {
  background-color: rgba(255, 255, 255, var(--ann-opacity, 0.15));
  backdrop-filter: blur(var(--ann-blur, 12px));
  -webkit-backdrop-filter: blur(var(--ann-blur, 12px));
}

.glass-hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.glass-hover:hover {
  background-color: rgba(255, 255, 255, var(--ann-opacity, 0.15));
  backdrop-filter: blur(var(--ann-blur, 12px));
  -webkit-backdrop-filter: blur(var(--ann-blur, 12px));
}

.glass-logo {
  padding: 6px 12px;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, var(--ann-opacity, 0.15));
  backdrop-filter: blur(var(--ann-blur, 12px));
  -webkit-backdrop-filter: blur(var(--ann-blur, 12px));
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>

<style>
.n-popover:not(.n-popover--no-glass) {
  background-color: rgba(255, 255, 255, var(--ann-opacity, 0.15)) !important;
  backdrop-filter: blur(var(--ann-blur, 12px)) !important;
  -webkit-backdrop-filter: blur(var(--ann-blur, 12px)) !important;
}

.n-popover:not(.n-popover--no-glass) .n-popover__content {
  background-color: transparent !important;
}

.n-popover:not(.n-popover--no-glass) .n-popover-arrow-wrapper .n-popover-arrow {
  background-color: rgba(255, 255, 255, var(--ann-opacity, 0.15)) !important;
}
</style>