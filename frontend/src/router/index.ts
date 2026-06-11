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
  if (to.name === 'login' && authStore.isLoggedIn) {
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
  // 异步等待路由就绪（不阻塞 mount）
  router.isReady().then(() => {
    // 路由就绪后预取相邻路由资源
    prefetchAdjacentRoutes(router.currentRoute.value)
  })
}

// 相邻路由预取：在当前页面加载完成后，空闲时预取可能访问的路由
function prefetchAdjacentRoutes(currentRoute: ReturnType<typeof router.currentRoute.value>) {
  const prefetchMap: Record<string, () => Promise<unknown>> = {
    'Home': () => import('@/views/home/index.vue'),
    'login': () => import('@/views/login/index.vue'),
  }

  // 使用 requestIdleCallback 在浏览器空闲时预取非当前路由
  const idleCallback = window.requestIdleCallback || ((cb: IdleRequestCallback) => setTimeout(cb, 300))
  idleCallback(() => {
    for (const [name, loader] of Object.entries(prefetchMap)) {
      if (name !== (currentRoute.name as string)) {
        loader().catch(() => { /* 预取静默失败 */ })
      }
    }
  })
}
