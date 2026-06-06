import { ref, computed, watch } from 'vue'
import { usePanelState } from '@/store'

export function useAnnouncement() {
  const panelState = usePanelState()

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
    if (announcementTimer) {
      clearTimeout(announcementTimer)
      announcementTimer = null
    }
  }

  function dismissAnnouncement() {
    clearAnnouncementTimer()
    announcementVisible.value = false
  }

  watch([announcementText, announcementDuration], () => {
    startAnnouncementTimer()
  })

  return {
    announcementVisible,
    announcementText,
    startAnnouncementTimer,
    clearAnnouncementTimer,
    dismissAnnouncement,
  }
}
