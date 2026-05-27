import type { App } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'
import { VisitMode } from '@/store/modules/auth'

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

// 路由守卫
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('sun-panel-token')
  const visitMode = Number(localStorage.getItem('sun-panel-visit-mode')) || VisitMode.VISIT_MODE_LOGIN

  if (to.name === 'login') {
    // 已登录或已是访客模式，直接跳转首页
    if (token || visitMode === VisitMode.VISIT_MODE_PUBLIC) {
      next({ name: 'Home' })
      return
    }
    next()
    return
  }

  // 既没有 token 也不是访客模式，跳转到登录页
  if (!token && visitMode !== VisitMode.VISIT_MODE_PUBLIC) {
    next({ name: 'login' })
    return
  }

  next()
})

export async function setupRouter(app: App) {
  app.use(router)
  await router.isReady()
}