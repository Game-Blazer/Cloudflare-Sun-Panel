<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store'

const props = defineProps<{
  groups: Array<{ title?: string; id?: number }>
}>()

const emit = defineEmits<{
  (e: 'open-settings'): void
}>()

const router = useRouter()
const authStore = useAuthStore()

const expanded = ref(false)
const isMobile = ref(false)
const mobileMenuOpen = ref(false)
const mobileWidth = 800
const scrollOffset = 80

function checkMobile() {
  isMobile.value = window.innerWidth < mobileWidth
}

function handleResize() {
  checkMobile()
}

const navItems = computed(() => {
  return props.groups.map((g, i) => ({
    title: g.title || `分组 ${i + 1}`,
    groupIndex: i,
  }))
})

function scrollToGroup(index: number) {
  const groups = document.querySelectorAll('.group-section')
  const target = groups[index]
  if (target) {
    const top = target.getBoundingClientRect().top + window.scrollY - scrollOffset
    window.scrollTo({ top, behavior: 'smooth' })
  }
  mobileMenuOpen.value = false
}

function handleLogin() {
  sessionStorage.setItem('sun-panel-skip-redirect', '1')
  router.push('/login')
}

function handleSettings() {
  emit('open-settings')
  expanded.value = false
}

function handleLogout() {
  authStore.removeToken()
  window.location.reload()
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', handleResize, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <!-- 桌面端：侧边栏 -->
  <div v-if="!isMobile" class="sidebar-root" @mouseenter="expanded = true" @mouseleave="expanded = false">
    <div class="sidebar-bar" :class="{ expanded }">
      <div class="sidebar-inner">
        <!-- 分组导航（可滚动） -->
        <div class="sidebar-nav">
          <div class="sidebar-nav-inner">
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

        <!-- 分隔线 -->
        <div class="sidebar-divider" />

        <!-- 底部操作按钮（始终可见） -->
        <div class="sidebar-actions">
          <template v-if="!authStore.isVisitMode">
            <div class="nav-item sidebar-action-item" @click="handleSettings">
              <div class="nav-slip" />
              <span class="nav-title">设 置</span>
            </div>
            <div class="nav-item sidebar-action-item" @click="handleLogout">
              <div class="nav-slip" />
              <span class="nav-title">退出登录</span>
            </div>
          </template>
          <template v-else>
            <div class="nav-item sidebar-action-item" @click="handleLogin">
              <div class="nav-slip" />
              <span class="nav-title">登 录</span>
            </div>
          </template>
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
  <div v-if="isMobile && mobileMenuOpen" class="mobile-overlay" @click="mobileMenuOpen = false" @touchmove.prevent>
    <div class="mobile-menu" @click.stop>
      <div
        v-for="(item, i) in navItems"
        :key="i"
        class="mobile-nav-item"
        @click="scrollToGroup(i)"
      >
        {{ item.title }}
      </div>
      <!-- 移动端操作按钮 -->
      <div class="mobile-divider" />
      <template v-if="!authStore.isVisitMode">
        <div class="mobile-nav-item mobile-action-item" @click="handleSettings">设 置</div>
        <div class="mobile-nav-item mobile-action-item" @click="handleLogout">退出登录</div>
      </template>
      <template v-else>
        <div class="mobile-nav-item mobile-action-item" @click="handleLogin">登 录</div>
      </template>
    </div>
  </div>
</template>

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
  transition: width 0.3s ease, background-color 0.3s ease;
  border-top-right-radius: 20px;
  border-bottom-right-radius: 20px;
  background-color: transparent;
}

.sidebar-bar.expanded {
  width: 200px;
  background-color: var(--glass-bg-hover);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.2);
}

.sidebar-inner {
  width: 200px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-nav-inner {
  margin-top: auto;
  margin-bottom: auto;
}

.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.sidebar-actions {
  flex-shrink: 0;
  padding-top: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  touch-action: manipulation;
  user-select: none;
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

.sidebar-bar.expanded .nav-item {
  padding: 4px 0;
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

.sidebar-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  margin: 8px 0;
  transition: opacity 0.3s ease;
  opacity: 0;
}

.sidebar-bar.expanded .sidebar-divider {
  opacity: 1;
}

.sidebar-action-item .nav-slip {
  background-color: rgba(255, 255, 255, 0.5) !important;
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
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 49;
  background: rgba(0,0,0,0.3);
  touch-action: manipulation;
}

.mobile-menu {
  position: fixed;
  top: 76px;
  left: 20px;
  background: rgba(42, 42, 42, 0.95);
  border-radius: 0.5rem;
  padding: 8px;
  min-width: 180px;
  backdrop-filter: blur(10px);
}

.mobile-nav-item {
  padding: 12px 14px;
  color: white;
  font-size: 14px;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.mobile-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  margin: 4px 8px;
}

.mobile-action-item {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}
</style>