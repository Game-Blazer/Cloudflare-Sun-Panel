<script setup lang="ts">
import { NBackTop, NButton, NModal, NPopover, NSpin, useMessage } from 'naive-ui'
import { nextTick, onMounted, ref, computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useRouter } from 'vue-router'
import { useAuthStore, usePanelState, useAppStore } from '@/store'
import { VisitMode } from '@/store/modules/auth'
import { getGroupList, saveGroup, deleteGroups, saveGroupSort } from '@/api/index'
import { getItemsByGroup, addItems, editItem, deleteItems, saveItemSort } from '@/api/index'
import { getUserConfig, setUserConfig } from '@/api/index'
import UsersManage from '@/components/apps/Users/index.vue'

interface ItemGroup extends Panel.ItemIconGroup {
  hoverStatus?: boolean
  items: Panel.ItemInfo[]
  sortStatus?: boolean
}

const router = useRouter()
const message = useMessage()
const authStore = useAuthStore()
const panelState = usePanelState()
const appStore = useAppStore()

const groups = ref<ItemGroup[]>([])
const loading = ref(true)

// 编辑弹窗状态
const editModalShow = ref(false)
const editingItem = ref<Panel.ItemInfo>({
  title: '',
  url: '',
  openMethod: 1,
  icon: { itemType: 0, text: '', backgroundColor: '#4a90d9' },
  itemIconGroupId: undefined,
})
const editingGroupId = ref<number>()

// 分组管理弹窗
const groupModalShow = ref(false)
const editingGroup = ref<Panel.ItemIconGroup>({ title: '' })
const editGroupModalVisible = ref(false)

// 设置弹窗
const settingModalShow = ref(false)

// 用户信息弹窗
const userInfoModalShow = ref(false)

const scrollContainerRef = ref<HTMLElement>()

// 用户管理弹窗
const usersManageShow = ref(false)

// 页面样式
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

function openUrl(item: Panel.ItemInfo) {
  let url = item.url
  switch (item.openMethod) {
    case 1:
      window.location.href = url
      break
    case 2:
      window.open(url, '_blank')
      break
    default:
      window.location.href = url
  }
}

// ========== 数据加载 ==========
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
          if (itemRes.code === 0)
            g.items = itemRes.data || []
        }
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadPanelConfig() {
  try {
    const res = await getUserConfig<Panel.userConfig>()
    if (res.code === 0 && res.data?.panel)
      panelState.updatePanelConfigFromCloud(res.data.panel)
  } catch { /* ignore */ }
}

onMounted(() => {
  loadData()
  loadPanelConfig()
})

// ========== 图标编辑 ==========
function openAddItem(groupId: number) {
  editingItem.value = {
    title: '',
    url: '',
    description: '',
    openMethod: 1,
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
  if (!item || !item.title) {
    message.warning('请输入标题')
    return
  }

  try {
    const res = item.id
      ? await editItem<Panel.ItemInfo>(item)
      : await addItems<Panel.ItemInfo[]>([item])

    if (res.code === 0) {
      message.success('保存成功')
      editModalShow.value = false
      await loadData()
    } else {
      message.error(res.msg || '保存失败')
    }
  } catch {
    message.error('网络错误')
  }
}

async function handleDeleteItem(item: Panel.ItemInfo) {
  if (!item.id) return
  try {
    const res = await deleteItems([item.id])
    if (res.code === 0) {
      message.success('删除成功')
      await loadData()
    } else {
      message.error(res.msg || '删除失败')
    }
  } catch {
    message.error('网络错误')
  }
}

// ========== 分组管理 ==========
function openAddGroup() {
  editingGroup.value = { title: '' }
  editGroupModalVisible.value = true
}

function openEditGroup(group: ItemGroup) {
  editingGroup.value = { id: group.id, title: group.title, icon: group.icon }
  editGroupModalVisible.value = true
}

async function handleSaveGroup() {
  const g = editingGroup.value
  if (!g.title) {
    message.warning('请输入分组名称')
    return
  }

  try {
    const res = await saveGroup(g)
    if (res.code === 0) {
      message.success('保存成功')
      editGroupModalVisible.value = false
      await loadData()
    } else {
      message.error(res.msg || '保存失败')
    }
  } catch {
    message.error('网络错误')
  }
}

async function handleDeleteGroup(group: ItemGroup) {
  if (!group.id) return
  try {
    const res = await deleteGroups([group.id])
    if (res.code === 0) {
      message.success('删除成功')
      await loadData()
    }
  } catch {
    message.error('网络错误')
  }
}

// ========== 排序 ==========
async function saveGroupSortOrder() {
  const sortItems = groups.value
    .filter(g => g.id)
    .map((g, i) => ({ id: g.id!, sort: i }))
  try {
    const res = await saveGroupSort(sortItems)
    if (res.code === 0)
      message.success('排序已保存')
  } catch { /* ignore */ }
}

async function saveItemSortOrder(group: ItemGroup) {
  const sortItems = (group.items || [])
    .filter(g => g.id)
    .map((item, i) => ({ id: item.id!, sort: i }))
  try {
    const res = await saveItemSort({ sortItems, itemIconGroupId: group.id! })
    if (res.code === 0)
      message.success('排序已保存')
  } catch { /* ignore */ }
}

// ========== 设置 ==========
async function handleSaveSettings(config: Panel.panelConfig) {
  try {
    const res = await setUserConfig({ panel: config })
    if (res.code === 0) {
      panelState.updatePanelConfigFromCloud(config)
      message.success('配置已保存')
      settingModalShow.value = false
    }
  } catch {
    message.error('保存失败')
  }
}

function resetSettings() {
  panelState.setPanelConfig({})
  message.success('已重置')
}

// ========== 登出 ==========
function handleLogout() {
  authStore.removeToken()
  router.push('/login')
}
</script>

<template>
  <div
    ref="scrollContainerRef"
    class="min-h-screen relative bg-gray-900 transition-all"
    :style="backgroundStyle"
  >
    <!-- 背景遮罩层 -->
    <div
      v-if="panelState.panelConfig.backgroundImageSrc"
      class="absolute inset-0 bg-black/50 pointer-events-none"
      :style="{
        backdropFilter: `blur(${panelState.panelConfig.backgroundBlur || 0}px)`,
        opacity: panelState.panelConfig.backgroundMaskNumber ?? 0.3,
      }"
    />

    <!-- 顶部工具栏 -->
    <div class="relative z-10 flex justify-between items-center p-4">
      <div class="flex items-center gap-2">
        <span class="text-white text-xl font-bold">
          {{ panelState.panelConfig.logoText || 'Sun-Panel' }}
        </span>
        <span
          v-if="authStore.isVisitMode"
          class="text-yellow-400 text-xs bg-yellow-900/50 px-2 py-0.5 rounded"
        >
          访客模式
        </span>
      </div>
      <div class="flex gap-2">
        <!-- 管理员可见按钮 -->
        <template v-if="authStore.isAdmin && !authStore.isVisitMode">
          <NButton size="small" @click="usersManageShow = true">
            用户管理
          </NButton>
          <NButton size="small" @click="groupModalShow = true">
            分组管理
          </NButton>
          <NButton size="small" @click="settingModalShow = true">
            风格设置
          </NButton>
        </template>

        <NButton size="small" @click="userInfoModalShow = true">
          我的
        </NButton>

        <!-- 登录用户退出按钮 -->
        <NButton v-if="!authStore.isVisitMode" size="small" type="error" @click="handleLogout">
          退出
        </NButton>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="relative z-10 mx-auto" :style="containerStyle">
      <NSpin :show="loading">
        <VueDraggable
          v-model="groups"
          :animation="200"
          handle=".group-drag-handle"
          :disabled="authStore.isVisitMode"
          @end="saveGroupSortOrder"
        >
          <div
            v-for="(group, gi) in groups"
            :key="group.id || gi"
            class="mb-6"
          >
            <!-- 分组标题 -->
            <div class="flex items-center gap-2 mb-3 px-2">
              <span
                v-if="!authStore.isVisitMode"
                class="group-drag-handle cursor-move text-gray-400 text-sm"
              >::</span>
              <h3 class="text-white text-lg font-medium flex-1">{{ group.title }}</h3>
              <NButton
                v-if="!authStore.isVisitMode"
                size="tiny"
                @click="openAddItem(group.id!)"
              >
                + 添加
              </NButton>
            </div>

            <!-- 图标区 -->
            <VueDraggable
              v-model="group.items"
              :animation="200"
              :disabled="authStore.isVisitMode"
              class="flex flex-wrap gap-3"
              @end="saveItemSortOrder(group)"
            >
              <div
                v-for="(item, ii) in group.items"
                :key="item.id || ii"
                class="group-item w-24 h-24 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all hover:bg-white/10 hover:scale-105 relative bg-white/5"
                @click="openUrl(item)"
              >
                <!-- 图标 -->
                <div class="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center mb-1">
                  <img
                    v-if="item.icon?.src"
                    :src="item.icon.src"
                    class="w-full h-full object-cover"
                    :alt="item.title"
                  />
                  <div
                    v-else
                    class="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    :style="{ backgroundColor: item.icon?.backgroundColor || '#4a90d9' }"
                  >
                    {{ item.icon?.text || item.title?.charAt(0) || '?' }}
                  </div>
                </div>

                <span class="text-white text-xs text-center line-clamp-2 px-1">
                  {{ item.title }}
                </span>

                <!-- 悬浮操作按钮 (仅非访客模式) -->
                <div
                  v-if="!authStore.isVisitMode"
                  class="absolute top-1 right-1 opacity-0 group-item-hover:opacity-100 transition-opacity flex gap-1"
                >
                  <NButton size="tiny" @click.stop="openEditItem(item)">
                    编辑
                  </NButton>
                  <NButton size="tiny" type="error" @click.stop="handleDeleteItem(item)">
                    删除
                  </NButton>
                </div>
              </div>
            </VueDraggable>

            <!-- 空状态 -->
            <div
              v-if="!group.items || group.items.length === 0"
              class="text-center text-gray-400 py-4 text-sm"
            >
              <template v-if="authStore.isVisitMode">
                暂无图标
              </template>
              <template v-else>
                暂无图标，点击"+ 添加"创建
              </template>
            </div>
          </div>
        </VueDraggable>
      </NSpin>
    </div>

    <!-- 返回顶部 -->
    <NBackTop :listen-to="() => scrollContainerRef" />

    <!-- ========== 编辑图标弹窗 ========== -->
    <NModal v-model:show="editModalShow" title="编辑图标" preset="card" class="w-[500px]">
      <div v-if="editingItem" class="flex flex-col gap-4">
        <div>
          <label class="block text-sm mb-1">标题 *</label>
          <input
            v-model="editingItem.title"
            class="w-full border rounded px-3 py-2 text-sm"
            placeholder="请输入标题"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">网址 *</label>
          <input
            v-model="editingItem.url"
            class="w-full border rounded px-3 py-2 text-sm"
            placeholder="https://"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">描述</label>
          <input
            v-model="editingItem.description"
            class="w-full border rounded px-3 py-2 text-sm"
            placeholder="描述信息"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">图标文字</label>
          <input
            v-model="editingItem.icon.text"
            class="w-full border rounded px-3 py-2 text-sm"
            placeholder="图标显示文字"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">图标背景色</label>
          <input
            v-model="editingItem.icon.backgroundColor"
            class="w-full border rounded px-3 py-2 text-sm"
            placeholder="#4a90d9"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">打开方式</label>
          <select
            v-model="editingItem.openMethod"
            class="w-full border rounded px-3 py-2 text-sm"
          >
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

    <!-- ========== 分组管理弹窗 ========== -->
    <NModal v-model:show="groupModalShow" title="分组管理" preset="card" class="w-[600px]">
      <div class="flex flex-col gap-4">
        <div class="flex gap-2 mb-2">
          <NButton type="primary" size="small" @click="openAddGroup">添加分组</NButton>
        </div>
        <div class="flex flex-col gap-2">
          <div
            v-for="group in groups"
            :key="group.id"
            class="flex items-center justify-between p-3 border rounded"
          >
            <span>{{ group.title }}</span>
            <div class="flex gap-2">
              <NButton size="tiny" @click="openEditGroup(group)">编辑</NButton>
              <NButton size="tiny" type="error" @click="handleDeleteGroup(group)">删除</NButton>
            </div>
          </div>
        </div>
      </div>
    </NModal>

    <!-- ========== 分组名称编辑弹窗 ========== -->
    <NModal v-model:show="editGroupModalVisible" title="编辑分组" preset="card" class="w-[400px]">
      <div v-if="editingGroup" class="flex flex-col gap-4">
        <div>
          <label class="block text-sm mb-1">分组名称 *</label>
          <input
            v-model="editingGroup.title"
            class="w-full border rounded px-3 py-2 text-sm"
            placeholder="请输入分组名称"
          />
        </div>
        <div class="flex justify-end gap-2">
          <NButton @click="editGroupModalVisible = false">取消</NButton>
          <NButton type="primary" @click="handleSaveGroup">保存</NButton>
        </div>
      </div>
    </NModal>

    <!-- ========== 风格设置弹窗 ========== -->
    <NModal v-model:show="settingModalShow" title="风格设置" preset="card" class="w-[500px]">
      <div v-if="panelState.panelConfig" class="flex flex-col gap-4">
        <div>
          <label class="block text-sm mb-1">壁纸地址</label>
          <input
            :value="panelState.panelConfig.backgroundImageSrc"
            @input="(e: any) => panelState.panelConfig.backgroundImageSrc = e.target.value"
            class="w-full border rounded px-3 py-2 text-sm"
            placeholder="输入图片URL"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">模糊度: {{ panelState.panelConfig.backgroundBlur }}</label>
          <input
            :value="panelState.panelConfig.backgroundBlur"
            @input="(e: any) => panelState.panelConfig.backgroundBlur = Number(e.target.value)"
            type="range" min="0" max="50"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">遮罩不透明度: {{ panelState.panelConfig.backgroundMaskNumber }}</label>
          <input
            :value="panelState.panelConfig.backgroundMaskNumber"
            @input="(e: any) => panelState.panelConfig.backgroundMaskNumber = Number(e.target.value)"
            type="range" min="0" max="1" step="0.1"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">Logo 文字</label>
          <input
            :value="panelState.panelConfig.logoText"
            @input="(e: any) => panelState.panelConfig.logoText = e.target.value"
            class="w-full border rounded px-3 py-2 text-sm"
            placeholder="Sun-Panel"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">最大宽度</label>
          <input
            :value="panelState.panelConfig.maxWidth"
            @input="(e: any) => panelState.panelConfig.maxWidth = Number(e.target.value)"
            type="number"
            class="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">上边距</label>
          <input
            :value="panelState.panelConfig.marginTop"
            @input="(e: any) => panelState.panelConfig.marginTop = Number(e.target.value)"
            type="number"
            class="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">下边距</label>
          <input
            :value="panelState.panelConfig.marginBottom"
            @input="(e: any) => panelState.panelConfig.marginBottom = Number(e.target.value)"
            type="number"
            class="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div class="flex justify-end gap-2">
          <NButton @click="resetSettings">重置</NButton>
          <NButton type="primary" @click="handleSaveSettings(panelState.panelConfig)">保存</NButton>
        </div>
      </div>
    </NModal>

    <!-- ========== 用户信息弹窗 ========== -->
    <NModal v-model:show="userInfoModalShow" title="我的信息" preset="card" class="w-[400px]">
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
          <div class="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
            {{ authStore.userInfo?.name?.charAt(0) || '?' }}
          </div>
          <div>
            <div class="font-medium">{{ authStore.userInfo?.name }}</div>
            <div class="text-sm text-gray-500">{{ authStore.userInfo?.username }}</div>
            <div class="text-xs text-gray-400">
              角色: {{ authStore.userInfo?.role === 1 ? '管理员' : '普通用户' }}
              <span v-if="authStore.isVisitMode" class="text-yellow-500 ml-1">(访客模式)</span>
            </div>
          </div>
        </div>

        <!-- 主题切换 -->
        <div>
          <label class="block text-sm mb-1">主题</label>
          <div class="flex gap-2">
            <NButton
              size="small"
              :type="appStore.theme === 'light' ? 'primary' : 'default'"
              @click="appStore.setTheme('light')"
            >
              浅色
            </NButton>
            <NButton
              size="small"
              :type="appStore.theme === 'dark' ? 'primary' : 'default'"
              @click="appStore.setTheme('dark')"
            >
              深色
            </NButton>
            <NButton
              size="small"
              :type="appStore.theme === 'auto' ? 'primary' : 'default'"
              @click="appStore.setTheme('auto')"
            >
              跟随系统
            </NButton>
          </div>
        </div>

        <!-- 语言切换 -->
        <div>
          <label class="block text-sm mb-1">语言</label>
          <div class="flex gap-2">
            <NButton
              size="small"
              :type="appStore.language === 'zh-CN' ? 'primary' : 'default'"
              @click="appStore.setLanguage('zh-CN')"
            >
              中文
            </NButton>
            <NButton
              size="small"
              :type="appStore.language === 'en-US' ? 'primary' : 'default'"
              @click="appStore.setLanguage('en-US')"
            >
              English
            </NButton>
          </div>
        </div>
      </div>
    </NModal>

    <!-- ========== 用户管理弹窗 (管理员) ========== -->
    <NModal v-model:show="usersManageShow" title="用户管理" preset="card" class="w-[700px]" :mask-closable="false">
      <UsersManage />
    </NModal>
  </div>
</template>

<style scoped>
.group-item:hover .group-item-hover\:opacity-100 {
  opacity: 1;
}
.group-item-hover\:opacity-100 {
  opacity: 0;
}
</style>