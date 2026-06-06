<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore, usePanelState } from '@/store'

const authStore = useAuthStore()
const panelState = usePanelState()

const logoText = computed(() => panelState.panelConfig.logoText || '')

const logoStyle = computed(() => {
  const baseLeft = panelState.panelConfig.logoPositionLeft ?? 16
  const left = isMobile.value ? baseLeft + 60 : baseLeft
  return {
    top: `${panelState.panelConfig.logoPositionTop ?? 16}px`,
    left: `${left}px`,
  }
})

const logoImgStyle = computed(() => {
  const size = panelState.panelConfig.logoSize
  return size ? { height: `${size}px` } : { height: '32px' }
})

const isMobile = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 640
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div
    v-if="panelState.panelConfig.logoImageSrc || logoText || authStore.isVisitMode"
    class="home-logo"
    :style="logoStyle"
  >
    <div class="flex items-center gap-2 sm:gap-3">
      <img
        v-if="panelState.panelConfig.logoImageSrc"
        :src="panelState.panelConfig.logoImageSrc"
        class="rounded"
        :style="logoImgStyle"
        alt="Logo"
        fetchpriority="high"
        loading="eager"
        decoding="async"
      />
      <span v-if="logoText" class="text-white text-base sm:text-xl font-bold">{{ logoText }}</span>
      <span
        v-if="authStore.isVisitMode"
        class="text-yellow-400 text-[10px] sm:text-xs bg-yellow-900/50 px-1.5 sm:px-2 py-0.5 rounded"
        >访客模式</span
      >
    </div>
  </div>
</template>

<style scoped>
.home-logo {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 40;
}
</style>
