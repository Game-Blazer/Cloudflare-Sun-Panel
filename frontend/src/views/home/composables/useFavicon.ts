import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { getSiteFavicon } from '@/api/panel'

export function useFavicon() {
  const message = useMessage()
  const getIconLoading = ref(false)
  const iconCandidates = ref<string[]>([])

  let abortController: AbortController | null = null
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null

  function cancelPrevious() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer)
      timeoutTimer = null
    }
  }

  async function getIconByUrl(rawUrl: string) {
    if (!rawUrl) {
      message.warning('请先输入网址')
      return
    }

    // 取消上一个请求
    cancelPrevious()
    getIconLoading.value = true
    iconCandidates.value = []

    abortController = new AbortController()

    // 10 秒前端超时
    timeoutTimer = setTimeout(() => {
      cancelPrevious()
      if (getIconLoading.value) {
        getIconLoading.value = false
        message.error('请求超时，请稍后重试')
      }
    }, 10000)

    try {
      const res = await getSiteFavicon<{ iconUrls: string[] }>(rawUrl)

      // 检查是否已被取消（新请求可能已发起）
      if (abortController?.signal.aborted) return

      if (res.code === 0 && res.data && res.data.iconUrls.length > 0) {
        iconCandidates.value = res.data.iconUrls
        message.success(`找到 ${iconCandidates.value.length} 个图标候选`)
      } else if (res.code === 0 && (!res.data || res.data.iconUrls.length === 0)) {
        message.warning('未找到可用图标，已使用默认来源')
      } else {
        message.error(res.msg || '获取图标失败')
      }
    } catch (err: unknown) {
      if (abortController?.signal.aborted) return // 被取消，不提示
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
        message.error('请求超时，请稍后重试')
      } else if (errorMsg.includes('Network') || errorMsg.includes('network')) {
        message.error('网络连接失败，请检查网络')
      } else {
        message.error('网络错误，请稍后重试')
      }
    } finally {
      cancelPrevious()
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