import { ref, computed, type Ref } from 'vue'
import { useAuthStore, usePanelState } from '@/store'
import { getAllData, getInit } from '@/api/index'
import { cachedRequest, invalidateCacheByPrefix, invalidateCache } from '@/utils/requestCache'

export interface ItemGroup extends Panel.ItemIconGroup {
  hoverStatus?: boolean
  items: Panel.ItemInfo[]
  sortStatus?: boolean
}

interface InitData {
  groups: Panel.ItemIconGroup[]
  itemsMap: Record<number, Panel.ItemInfo[]>
  panelConfig: Panel.panelConfig
  about: Record<string, string>
  authInfo: { user: User.Info | null; visitMode: number }
}

interface PreloadGroup {
  items?: Array<{ icon?: { src?: string } | null }>
}

export function useDataLoader(options: {
  authStore: ReturnType<typeof useAuthStore>
  panelState: ReturnType<typeof usePanelState>
  siteConfig: Ref<Panel.SiteConfig>
  syncWallpaper: () => void
  preloadIcons: (groups: PreloadGroup[], count?: number) => void
  onSiteConfigUpdated: (config: Panel.SiteConfig) => void
}) {
  const { authStore, panelState, siteConfig, syncWallpaper, preloadIcons, onSiteConfigUpdated } = options

  const groups = ref<ItemGroup[]>([])
  const loading = ref(true)

  const visibleGroups = computed(() => {
    if (!authStore.isVisitMode) return groups.value
    return groups.value.filter((g) => g.publicVisible !== 0)
  })

  /** 统一加载分组 + 图标 + 面板配置（缓存 5 分钟） */
  async function loadData() {
    loading.value = true
    try {
      const res = await cachedRequest('panel:allData', () =>
        getAllData<{
          groups: Panel.ItemIconGroup[]
          itemsMap: Record<number, Panel.ItemInfo[]>
          panelConfig: Panel.panelConfig
        }>(),
        300,
      )

      if (res.code === 0 && res.data) {
        const { groups: rawGroups, itemsMap, panelConfig } = res.data

        groups.value = (rawGroups || []).map((g) => ({
          ...g,
          hoverStatus: false,
          sortStatus: false,
          items: g.id && itemsMap[g.id] ? itemsMap[g.id] : [],
        })) as ItemGroup[]

        if (panelConfig && Object.keys(panelConfig).length > 0) {
          panelState.updatePanelConfigFromCloud(panelConfig)
        }
        syncWallpaper()
        preloadIcons(groups.value)
      }
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  /** 首次加载：合并 auth + siteConfig + panel 三个请求为一次 /init 调用 */
  async function loadInitData() {
    loading.value = true
    try {
      const res = await getInit<InitData>()
      if (res.code === 0 && res.data) {
        const { groups: rawGroups, itemsMap, panelConfig, about, authInfo } = res.data

        // 1. 认证信息
        if (authInfo) {
          if (authInfo.user) {
            authStore.setUserInfo(authInfo.user)
            authStore.setVisitMode(authInfo.visitMode)
          } else {
            authStore.setVisitMode(authInfo.visitMode)
          }
        }

        // 2. 站点配置
        if (about && Object.keys(about).length > 0) {
          const config: Panel.SiteConfig = {
            site_title: about.site_title || '',
            login_bg_image: about.login_bg_image || '',
            login_blur: about.login_blur !== undefined ? Number(about.login_blur) : 12,
            login_mask_opacity: about.login_mask_opacity !== undefined ? Number(about.login_mask_opacity) : 0.15,
            footer_html: about.footer_html || '',
            logo_text: about.logo_text || '',
            logo_image_src: about.logo_image_src || '',
            favicon_url: about.favicon_url || '',
          }
          siteConfig.value = config
          onSiteConfigUpdated(config)
        }

        // 3. 面板数据
        groups.value = (rawGroups || []).map((g) => ({
          ...g,
          hoverStatus: false,
          sortStatus: false,
          items: g.id && itemsMap[g.id] ? itemsMap[g.id] : [],
        })) as ItemGroup[]

        if (panelConfig && Object.keys(panelConfig).length > 0) {
          panelState.updatePanelConfigFromCloud(panelConfig)
        }
        syncWallpaper()
        preloadIcons(groups.value)
      }
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  /** 刷新全部数据：清缓存 + 单次 /init 调用（替代原来的 3 次独立请求） */
  function refreshAll() {
    invalidateCacheByPrefix('panel:')
    invalidateCache('site:about')
    loadInitData()
  }

  return {
    groups,
    loading,
    visibleGroups,
    loadData,
    loadInitData,
    refreshAll,
  }
}