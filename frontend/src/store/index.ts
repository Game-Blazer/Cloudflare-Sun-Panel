import { createPinia } from 'pinia'
import type { App } from 'vue'

export const store = createPinia()

export function setupStore(app: App) {
  app.use(store)
}

export * from './modules/auth'
export * from './modules/panel'
export * from './modules/app'