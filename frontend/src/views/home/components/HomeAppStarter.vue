<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'
import { useAuthStore, usePanelState } from '@/store'
import { saveGroup, deleteGroups } from '@/api/index'
import UsersManage from '@/components/apps/Users/index.vue'
import PanelUserInfo from './panels/PanelUserInfo.vue'
import PanelStyleSettings from './panels/PanelStyleSettings.vue'
import PanelAnnounceSettings from './panels/PanelAnnounceSettings.vue'
import PanelGroupManage from './panels/PanelGroupManage.vue'
import PanelImportExport from './panels/PanelImportExport.vue'
import PanelSiteSettings from './panels/PanelSiteSettings.vue'
import AppStarterSidebar from './AppStarterSidebar.vue'

interface App {
  name: string
  key: string
  icon: string
  adminOnly?: boolean
}

interface ItemGroup {
  id?: number
  title: string
  sort?: number
  items?: Panel.ItemInfo[]
  publicVisible?: number
  hoverStatus?: boolean
  sortStatus?: boolean
}

const props = defineProps<{
  visible: boolean
  siteConfig: Panel.SiteConfig
  groups: ItemGroup[]
  onSaved: () => void
}>()

const emit = defineEmits<{
  (e: 'update:visible', visible: boolean): void
  (e: 'update:siteConfig', config: Panel.SiteConfig): void
  (e: 'groupSaved'): void
}>()

const show = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const message = useMessage()
const authStore = useAuthStore()
const panelState = usePanelState()
const { panelConfig } = storeToRefs(panelState)

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
    { name: '公告设置', key: 'Announce', icon: '📢' },
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

const layoutHeight = computed(() => {
  return isSmallScreen.value ? 'min(80vh, 450px)' : '500px'
})

onMounted(() => {
  window.addEventListener('resize', handleResize, { passive: true })
  handleResize()
  syncSiteConfig()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// ====== 站点设置 ======
const localSiteConfig = ref<Panel.SiteConfig>({})

function syncSiteConfig() {
  localSiteConfig.value = { ...props.siteConfig }
}

watch(() => props.siteConfig, () => syncSiteConfig(), { deep: true })

function handleSiteConfigUpdate(config: Panel.SiteConfig) {
  emit('update:siteConfig', config)
}

// ====== 分组管理 ======
function openEditGroup(group: ItemGroup) {
  editingGroup.value = { id: group.id, title: group.title, sort: group.sort, publicVisible: group.publicVisible ?? 1 }
  editGroupModalVisible.value = true
}

async function handleSaveGroup() {
  try {
    const res = await saveGroup(editingGroup.value)
    if (res.code === 0) { message.success('保存成功'); editGroupModalVisible.value = false; props.onSaved() }
    else message.error(res.msg || '保存失败')
  } catch { message.error('网络错误') }
}

async function handleDeleteGroup(group: ItemGroup) {
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

function handleGroupSaved() {
  emit('groupSaved')
}
</script>

<template>
  <NModal v-model:show="show" preset="card" title="" class="w-[95vw] sm:w-[700px] md:w-[900px]" size="small" :mask-closable="true">
    <template #header>
      <div class="flex items-center select-none cursor-pointer" @click="collapsed = !collapsed">
        <span class="text-lg mr-2">{{ collapsed ? '▶' : '◀' }}</span>
        <span>{{ apps.find(a => a.key === activeApp)?.name || '应用启动器' }}</span>
      </div>
    </template>
    <NLayout has-sider :style="`height:${layoutHeight};border-radius:0.75rem;`">
      <AppStarterSidebar
        :apps="apps"
        v-model:active-app="activeApp"
        v-model:collapsed="collapsed"
        :is-small-screen="isSmallScreen"
      />
      <NLayoutContent :content-style="`height:${layoutHeight}`">
        <div class="h-full overflow-auto p-3 sm:p-4">

          <!-- ====== 我的信息 ====== -->
          <PanelUserInfo v-if="activeApp === 'UserInfo'" />

          <!-- ====== 风格设置 ====== -->
          <PanelStyleSettings
            v-if="activeApp === 'Style'"
            :panel-config="panelConfig"
            :on-saved="props.onSaved"
          />

          <!-- ====== 公告设置 ====== -->
          <PanelAnnounceSettings
            v-if="activeApp === 'Announce'"
            :panel-config="panelConfig"
            :on-saved="props.onSaved"
          />

          <!-- ====== 分组管理 ====== -->
          <PanelGroupManage
            v-if="activeApp === 'GroupManage'"
            :groups="props.groups"
            @add-group="openAddGroup"
            @edit-group="openEditGroup"
            @delete-group="handleDeleteGroup"
            @saved="handleGroupSaved"
          />

          <!-- ====== 导入导出 ====== -->
          <PanelImportExport
            v-if="activeApp === 'ImportExport'"
            :on-saved="props.onSaved"
          />

          <!-- ====== 用户管理 ====== -->
          <div v-if="activeApp === 'Users'" class="flex flex-col gap-4">
            <UsersManage />
          </div>

          <!-- ====== 站点设置 ====== -->
          <PanelSiteSettings
            v-if="activeApp === 'SiteSettings'"
            :site-config="localSiteConfig"
            @update:site-config="handleSiteConfigUpdate"
          />

        </div>
      </NLayoutContent>
    </NLayout>

    <!-- 分组编辑弹窗 -->
    <NModal v-model:show="editGroupModalVisible" title="编辑分组" preset="card" class="w-[400px]">
      <div v-if="editingGroup" class="flex flex-col gap-4">
        <div><label class="block text-sm mb-1">分组名称 *</label>
          <input v-model="editingGroup.title" class="w-full border rounded px-3 py-2 sm:text-sm text-base" placeholder="请输入分组名称" /></div>
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