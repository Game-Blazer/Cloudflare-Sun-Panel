import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { getSiteFavicon } from '@/api/index'

export function useFavicon() {
  const message = useMessage()
  const getIconLoading = ref(false)
  const iconCandidates = ref<string[]>([])

  async function getIconByUrl(url: string) {
    if (!url) {
      message.warning('请先输入网址')
      return
    }
    getIconLoading.value = true
    iconCandidates.value = []
    try {
      const res = await getSiteFavicon<{ iconUrls: string[] }>(url)
      if (res.code === 0 && res.data && res.data.iconUrls.length > 0) {
        iconCandidates.value = res.data.iconUrls
        message.success(`找到 ${iconCandidates.value.length} 个图标候选`)
      } else {
        message.error(res.msg || '获取图标失败')
      }
    } catch {
      message.error('网络错误')
    } finally {
      getIconLoading.value = false
    }
  }

  function selectIcon(iconUrl: string, editingItem: Panel.ItemInfo) {
    if (editingItem.icon) {
      editingItem.icon.src = iconUrl
    }
    iconCandidates.value = []
    message.success('已选择图标')
  }

  return {
    getIconLoading,
    iconCandidates,
    getIconByUrl,
    selectIcon,
  }
}
