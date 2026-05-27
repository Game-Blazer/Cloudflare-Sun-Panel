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

// 路由守卫（参照原项目：仅拦截非管理员访问 admin 路由）
// 认证由后端 API 处理，未登录用户调用 API 会收到 401
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('sun-panel-token')

  // 已登录用户访问登录页，直接跳转首页
  if (to.name === 'login' && token) {
    next({ name: 'Home' })
    return
  }

  // 默认放行所有页面
  next()
})

export async function setupRouter(app: App) {
  app.use(router)
  await router.isReady()
}