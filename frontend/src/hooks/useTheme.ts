import { darkTheme } from 'naive-ui'
import { computed } from 'vue'
import { useAppStore } from '@/store'

export function useTheme() {
  const appStore = useAppStore()

  const theme = computed(() => {
    if (appStore.theme === 'dark') return darkTheme
    if (appStore.theme === 'auto') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches)
        return darkTheme
    }
    return undefined
  })

  const themeOverrides = {}

  return { theme, themeOverrides }
}