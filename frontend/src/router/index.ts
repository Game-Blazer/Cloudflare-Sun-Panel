import type { App } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/store/modules/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import(/* home-page */ '@/views/home/index.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import(/* login-page */ '@/views/login/index.vue'),
  },
  {
    path: '/404',
    name: '404',
    component: () => import(/* notfound-page */ '@/views/exception/404/index.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    redirect: '/404',
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ left: 0, top: 0 }),
})

// 路由守卫：确保未认证且未开启公开模式时，只能访问登录页
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  const publicModeAvailable = localStorage.getItem('sun-panel-public-mode') === '1'

  // 已登录用户访问登录页，直接跳转首页
  if (to.name === 'login' && authStore.token) {
    next({ name: 'Home' })
    return
  }

  // 首页：无 token 但公开模式可用 → 自动进入访客模式
  if (to.name === 'Home') {
    if (!authStore.token) {
      if (publicModeAvailable) {
        authStore.setVisitMode(1)
        next()
        return
      }
      next({ name: 'login' })
      return
    }
  }

  next()
})

export async function setupRouter(app: App) {
  app.use(router)
  await router.isReady()
}