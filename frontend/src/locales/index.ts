import { createI18n } from 'vue-i18n'
import type { App } from 'vue'
import zhCN from './zh-CN.json'
import enUS from './en-US.json'

const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages,
})

export function setupI18n(app: App) {
  app.use(i18n)
}

export function t(key: string): string {
  return i18n.global.t(key) as string
}