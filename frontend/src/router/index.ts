import type { App } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/home/index.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/index.vue'),
  },
  {
    path: '/404',
    name: '404',
    component: () => import('@/views/exception/404/index.vue'),
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
  const token = localStorage.getItem('sun-panel-token')
  const publicModeAvailable = localStorage.getItem('sun-panel-public-mode') === '1'

  // 已登录用户访问登录页，直接跳转首页
  if (to.name === 'login' && token) {
    next({ name: 'Home' })
    return
  }

  // 首页：无 token 但公开模式可用 → 自动进入访客模式
  if (to.name === 'Home') {
    if (!token) {
      if (publicModeAvailable) {
        localStorage.setItem('sun-panel-visit-mode', '1')
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