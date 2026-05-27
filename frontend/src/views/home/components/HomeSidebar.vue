<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

interface GroupNavItem {
  title: string
  groupIndex: number
}

const props = defineProps<{
  groups: Array<{ title?: string; id?: number }>
}>()

const expanded = ref(false)
const isMobile = ref(false)
const mobileMenuOpen = ref(false)
const mobileWidth = 800
const scrollOffset = 80

function checkMobile() {
  isMobile.value = window.innerWidth < mobileWidth
}

let resizeTimer: ReturnType<typeof setTimeout>
function handleResize() {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(checkMobile, 200)
}

const navItems = computed(() => {
  return props.groups.map((g, i) => ({
    title: g.title || `分组 ${i + 1}`,
    groupIndex: i,
  }))
})

function scrollToGroup(index: number) {
  const container = document.querySelector('.scroll-container')
  if (!container) return
  const groups = container.querySelectorAll('.group-section')
  const target = groups[index]
  if (target) {
    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const offset = targetRect.top - containerRect.top + container.scrollTop - scrollOffset
    container.scrollTo({ top: offset, behavior: 'smooth' })
  }
  mobileMenuOpen.value = false
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  clearTimeout(resizeTimer)
})
</script>

<template>
  <!-- 桌面端：侧边栏 -->
  <div v-if="!isMobile" class="sidebar-root" @mouseenter="expanded = true" @mouseleave="expanded = false">
    <div class="sidebar-bar" :class="{ expanded }">
      <div class="sidebar-inner">
        <div
          v-for="(item, i) in navItems"
          :key="i"
          class="nav-item"
          @click="scrollToGroup(i)"
        >
          <div class="nav-slip" />
          <span class="nav-title">{{ item.title }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 移动端：触发按钮 -->
  <div v-if="isMobile" class="mobile-btn" @click.stop="mobileMenuOpen = !mobileMenuOpen">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="21" height="21" fill="currentColor">
      <path d="M17.5 4.5c-1.95 0-4.05.4-5.5 1.5c-1.45-1.1-3.55-1.5-5.5-1.5c-1.45 0-2.99.22-4.28.79C1.49 5.62 1 6.33 1 7.14v11.28c0 1.3 1.22 2.26 2.48 1.94c.98-.25 2.02-.36 3.02-.36c1.56 0 3.22.26 4.56.92c.6.3 1.28.3 1.87 0c1.34-.67 3-.92 4.56-.92c1 0 2.04.11 3.02.36c1.26.33 2.48-.63 2.48-1.94V7.14c0-.81-.49-1.52-1.22-1.85c-1.28-.57-2.82-.79-4.27-.79M21 17.23c0 .63-.58 1.09-1.2.98c-.75-.14-1.53-.2-2.3-.2c-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5c.92 0 1.83.09 2.7.28c.46.1.8.51.8.98z"/>
      <path d="M13.98 11.01c-.32 0-.61-.2-.71-.52c-.13-.39.09-.82.48-.94c1.54-.5 3.53-.66 5.36-.45c.41.05.71.42.66.83s-.42.71-.83.66c-1.62-.19-3.39-.04-4.73.39c-.08.01-.16.03-.23.03m0 2.66c-.32 0-.61-.2-.71-.52c-.13-.39.09-.82.48-.94c1.53-.5 3.53-.66 5.36-.45c.41.05.71.42.66.83s-.42.71-.83.66c-1.62-.19-3.39-.04-4.73.39a1 1 0 0 1-.23.03m0 2.66c-.32 0-.61-.2-.71-.52c-.13-.39.09-.82.48-.94c1.53-.5 3.53-.66 5.36-.45c.41.05.71.42.66.83s-.42.7-.83.66c-1.62-.19-3.39-.04-4.73.39a1 1 0 0 1-.23.03"/>
    </svg>
  </div>

  <!-- 移动端下拉菜单 -->
  <div v-if="isMobile && mobileMenuOpen" class="mobile-overlay" @click="mobileMenuOpen = false">
    <div class="mobile-menu" @click.stop>
      <div
        v-for="(item, i) in navItems"
        :key="i"
        class="mobile-nav-item"
        @click="scrollToGroup(i)"
      >
        {{ item.title }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed } from 'vue'
</script>

<style scoped>
/* ===== 桌面端侧边栏 ===== */
.sidebar-root {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  z-index: 50;
  display: flex;
  align-items: center;
}

.sidebar-bar {
  width: 40px;
  padding: 10px;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-top-right-radius: 20px;
  border-bottom-right-radius: 20px;
  background-color: transparent;
}

.sidebar-bar.expanded {
  width: 200px;
  background-color: rgba(42, 42, 42, 0.9);
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.2);
}

.sidebar-inner {
  width: 200px;
}

.nav-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
}

.nav-slip {
  width: 20px;
  height: 6px;
  background-color: white;
  border-radius: 4px;
  margin: 15px 0;
  transition: height 0.3s ease, width 0.3s ease;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.5);
  flex-shrink: 0;
}

.nav-title {
  opacity: 0;
  white-space: nowrap;
  transition: opacity 0.3s ease, transform 0.3s ease, margin-left 0.3s ease;
  font-size: 14px;
  color: white;
  margin-left: 0;
}

.sidebar-bar.expanded .nav-title {
  opacity: 1;
  margin-left: 10px;
}

.sidebar-bar.expanded .nav-slip {
  box-shadow: none;
}

.sidebar-bar.expanded .nav-item:hover .nav-slip {
  width: 40px;
}

.sidebar-bar.expanded .nav-item:hover .nav-title {
  font-size: 20px;
}

/* ===== 移动端 ===== */
.mobile-btn {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 46px;
  height: 46px;
  background-color: rgba(42, 42, 42, 0.42);
  color: white;
  border-radius: 0.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: 50;
}

.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 49;
  background: rgba(0,0,0,0.3);
}

.mobile-menu {
  position: fixed;
  top: 76px;
  left: 20px;
  background: rgba(42, 42, 42, 0.95);
  border-radius: 0.5rem;
  padding: 8px;
  min-width: 160px;
  backdrop-filter: blur(10px);
}

.mobile-nav-item {
  padding: 10px 14px;
  color: white;
  font-size: 14px;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.2s;
}

.mobile-nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>