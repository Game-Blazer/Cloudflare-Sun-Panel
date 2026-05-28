import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    language: 'zh-CN',
    theme: 'auto' as 'light' | 'dark' | 'auto',
  }),

  actions: {
    setLanguage(lang: string) {
      this.language = lang
      localStorage.setItem('sun-panel-lang', lang)
    },

    setTheme(theme: 'light' | 'dark' | 'auto') {
      this.theme = theme
      localStorage.setItem('sun-panel-theme', theme)
    },
  },
})