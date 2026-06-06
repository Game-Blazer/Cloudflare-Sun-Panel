import { darkTheme } from 'naive-ui'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/store'

export function useTheme() {
  const appStore = useAppStore()
  const systemDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)

  let mediaQuery: MediaQueryList | null = null
  let handler: ((e: MediaQueryListEvent) => void) | null = null

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    handler = (e: MediaQueryListEvent) => { systemDark.value = e.matches }
    mediaQuery.addEventListener('change', handler)
  })

  onUnmounted(() => {
    if (mediaQuery && handler) {
      mediaQuery.removeEventListener('change', handler)
    }
  })

  const theme = computed(() => {
    if (appStore.theme === 'dark') return darkTheme
    if (appStore.theme === 'auto' && systemDark.value) return darkTheme
    return undefined
  })

  const themeOverrides = {}

  return { theme, themeOverrides }
}