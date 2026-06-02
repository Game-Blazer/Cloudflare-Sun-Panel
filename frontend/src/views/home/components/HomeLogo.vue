<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore, usePanelState } from '@/store'

const authStore = useAuthStore()
const panelState = usePanelState()

const logoText = computed(() => panelState.panelConfig.logoText || '')
</script>

<template>
  <div
    v-if="panelState.panelConfig.logoImageSrc || logoText || authStore.isVisitMode"
    class="home-logo"
  >
    <div class="flex items-center gap-3">
      <img
        v-if="panelState.panelConfig.logoImageSrc"
        :src="panelState.panelConfig.logoImageSrc"
        class="h-8 rounded"
        alt="Logo"
        decoding="async"
      />
      <span v-if="logoText" class="text-white text-xl font-bold">{{ logoText }}</span>
      <span
        v-if="authStore.isVisitMode"
        class="text-yellow-400 text-xs bg-yellow-900/50 px-2 py-0.5 rounded"
      >访客模式</span>
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