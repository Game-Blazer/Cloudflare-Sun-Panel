import { computed } from 'vue'
import { useAppStore } from '@/store'
import { zhCN, enUS, dateZhCN, dateEnUS } from 'naive-ui'

export function useLanguage() {
  const appStore = useAppStore()

  const language = computed(() => {
    if (appStore.language === 'en-US') return enUS
    return zhCN
  })

  return { language }
}