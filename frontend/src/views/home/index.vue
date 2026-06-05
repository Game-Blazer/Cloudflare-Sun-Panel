<script setup lang="ts">
import DOMPurify from 'dompurify'
import { NBackTop, NButton, NModal, NSkeleton, NSpin, NTooltip, useMessage } from 'naive-ui'
import { onMounted, ref, computed, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useAuthStore, usePanelState } from '@/store'
import { getAllData } from '@/api/index'
import { deleteItems, saveItemSort } from '@/api/index'
import { getAbout, getAuthInfo } from '@/api/index'
import { cachedRequest, invalidateCacheByPrefix } from '@/utils/requestCache'
import { useAnnouncement } from './composables/useAnnouncement'
import { useItemEditor } from './composables/useItemEditor'
import HomeAppStarter from './components/HomeAppStarter.vue'
import HomeSidebar from './components/HomeSidebar.vue'
import HomeLogo from './components/HomeLogo.vue'
import LazyImg from '@/components/common/LazyImg.vue'

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

const safeFooterHtml = computed(() => {
  return DOMPurify.sanitize(panelState.panelConfig.footerHtml || '')
})

// Composables
const { announcementVisible, announcementText, startAnnouncementTimer, dismissAnnouncement } = useAnnouncement()
const { editModalShow, editingItem, editingGroupId, openAddItem, openEditItem, handleSaveItem } = useItemEditor(loadData)

// 分组编辑模式（控制每个分组内是否可排序/编辑/删除）
const editModeGroupId = ref<number | null>(null)

function toggleEditMode(groupId: number) {
  editModeGroupId.value = editModeGroupId.value === groupId ? null : groupId
}

// AppStarter
const starterShow = ref(false)

// 弹窗（iframe 内嵌）
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

/** 统一加载分组 + 图标 + 面板配置（一次 API 调用替代 N+1 次） */
async function loadData() {
  loading.value = true
  try {
    const res = await cachedRequest('panel:allData', () => getAllData<{
      groups: Panel.ItemIconGroup[]
      itemsMap: Record<number, Panel.ItemInfo[]>
      panelConfig: Panel.panelConfig
    }>())

    if (res.code === 0 && res.data) {
      const { groups: rawGroups, itemsMap, panelConfig } = res.data

      groups.value = (rawGroups || []).map(g => ({
        ...g, hoverStatus: false, sortStatus: false,
        items: (g.id && itemsMap[g.id]) ? itemsMap[g.id] : [],
      })) as ItemGroup[]

      if (panelConfig && Object.keys(panelConfig).length > 0) {
        panelState.updatePanelConfigFromCloud(panelConfig)
      }
    }
  } catch (e) { console.error(e) } finally { loading.value = false }
}

function refreshAll() {
  invalidateCacheByPrefix('panel:')
  updateLocalUserInfo().then(() => {
    Promise.all([loadData(), loadSiteConfig()])
  })
}

onMounted(async () => {
  syncGlassVars()
  await updateLocalUserInfo()
  loadSiteConfig()
  loadData()
  startAnnouncementTimer()
})

// ====== 图标编辑 ======
function getIconByUrl() {
  message.warning('该功能暂不可用，请手动填写图标图片 URL')
}

async function handleDeleteItem(item: Panel.ItemInfo) {
  if (!item.id) return
  try {
    const res = await deleteItems([item.id])
    if (res.code === 0) { message.success('删除成功'); invalidateCacheByPrefix('panel:'); await loadData() }
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
  <!-- 壁纸层 - 使用 img 标签确保浏览器以高优先级下载 -->
  <div v-if="panelState.panelConfig.backgroundImageSrc" class="fixed inset-0 z-[1]" :style="{
    filter: `blur(${panelState.panelConfig.backgroundBlur || 0}px)`,
    transform: 'translateZ(0)',
    willChange: 'transform',
  }">
    <img :src="panelState.panelConfig.backgroundImageSrc" class="w-full h-full object-cover" fetchpriority="high" decoding="async" alt="" />
  </div>
  <!-- 遮罩层 -->
  <div v-if="panelState.panelConfig.backgroundImageSrc" class="fixed inset-0 z-[1]" :style="{
    backgroundColor: `rgba(0,0,0,${panelState.panelConfig.backgroundMaskNumber ?? 0.3})`
  }" />

  <div ref="scrollContainerRef" class="min-h-screen relative transition-all flex flex-col scroll-container pt-14 sm:pt-0" :class="{ 'bg-gray-900': !panelState.panelConfig.backgroundImageSrc }" :style="glassVars">
    <!-- 侧边栏分组导航 -->
    <HomeSidebar :groups="visibleGroups" @open-settings="starterShow = true" />

    <!-- Logo + 访客标识（独立固定定位组件） -->
    <HomeLogo />

    <!-- 公告 -->
    <Transition name="announce-fade">
      <div v-if="announcementVisible && announcementText" class="fixed top-4 right-2 sm:right-4 max-w-[90vw] sm:max-w-sm z-30 pointer-events-none">
        <div class="flex items-start gap-3 max-w-sm pointer-events-auto glass-panel text-white px-4 py-3 rounded-xl shadow-lg text-sm leading-relaxed border border-white/10">



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
              <h3 class="text-white text-base sm:text-lg font-medium">{{ group.title }}</h3>
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
            <VueDraggable v-if="editModeGroupId === group.id" v-model="group.items" :animation="200" class="flex flex-wrap gap-2 sm:gap-3" @end="saveItemSortOrder(group)">
              <div v-for="(item, ii) in group.items" :key="item.id || ii"
                class="group-item w-20 h-20 sm:w-[88px] sm:h-[88px] md:w-24 md:h-24 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all hover:scale-105 relative glass-hover"
                @click="openUrl(item)">
                <div class="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg overflow-hidden flex items-center justify-center mb-1">
                  <LazyImg v-if="item.icon?.src" :src="item.icon.src" :alt="item.title" :fallback-text="item.icon?.text || item.title" :fallback-bg="item.icon?.backgroundColor" />
                  <div v-else class="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    :style="{ backgroundColor: item.icon?.backgroundColor || '#4a90d9' }">
                    {{ item.icon?.text || item.title?.charAt(0) || '?' }}
                  </div>
                </div>
                <span class="text-white text-[11px] sm:text-xs text-center line-clamp-2 px-1">{{ item.title }}</span>
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
            <div v-else class="flex flex-wrap gap-2 sm:gap-3">
              <NTooltip v-for="(item, ii) in group.items" :key="item.id || ii" trigger="hover" :disabled="!item.description" placement="bottom">
                <template #trigger>
                  <div class="group-item w-20 h-20 sm:w-[88px] sm:h-[88px] md:w-24 md:h-24 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all hover:scale-105 relative glass-hover"
                    @click="openUrl(item)">
                    <div class="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg overflow-hidden flex items-center justify-center mb-1">
                      <LazyImg v-if="item.icon?.src" :src="item.icon.src" :alt="item.title" :fallback-text="item.icon?.text || item.title" :fallback-bg="item.icon?.backgroundColor" />
                      <div v-else class="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-lg"
                        :style="{ backgroundColor: item.icon?.backgroundColor || '#4a90d9' }">
                        {{ item.icon?.text || item.title?.charAt(0) || '?' }}
                      </div>
                    </div>
                    <span class="text-white text-[11px] sm:text-xs text-center line-clamp-2 px-1">{{ item.title }}</span>
                  </div>
                </template>
                <span>{{ item.description }}</span>
              </NTooltip>
            </div>
            <div v-if="!group.items || group.items.length === 0" class="text-center text-gray-400 text-xs sm:text-sm py-3 sm:py-4">
              {{ authStore.isVisitMode ? '暂无图标' : '暂无图标，点击" + 添加"创建' }}
            </div>
          </div>
        </template>
      </NSpin>
    </div>

    <!-- 自定义页脚 -->
    <div v-if="panelState.panelConfig.footerHtml" class="sticky bottom-0 z-20 text-center py-4 text-gray-400 text-sm" v-html="safeFooterHtml" />

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
    <NModal v-model:show="editModalShow" title="编辑图标" preset="card" class="w-[95vw] sm:w-[500px]">
      <div v-if="editingItem" class="flex flex-col gap-4">
        <div><label class="block text-sm mb-1">标题 *</label><input v-model="editingItem.title" class="w-full border rounded px-3 py-2 text-sm" placeholder="请输入标题" /></div>
        <div>
          <label class="block text-sm mb-1">网址 *</label>
          <div class="flex gap-2">
            <input v-model="editingItem.url" class="flex-1 border rounded px-3 py-2 text-sm" placeholder="https://" />
            <NButton :disabled="!editingItem.url" @click="getIconByUrl">获取图标</NButton>
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

    <!-- ========== 弹窗（iframe 内嵌页面） ========== -->
    <NModal
      v-model:show="windowShow" :mask-closable="false" preset="card"
      class="max-w-[1000px] w-[95vw] h-[85vh] sm:h-[600px] rounded-2xl" :bordered="true" size="small" role="dialog"
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

/* 移动端触屏设备始终显示编辑按钮 */
@media (hover: none) {
  .group-title-btns {
    opacity: 1;
  }
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