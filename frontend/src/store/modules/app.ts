import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    language: (localStorage.getItem('sun-panel-lang') as string) || 'zh-CN',
    theme: (localStorage.getItem('sun-panel-theme') as 'light' | 'dark' | 'auto') || 'auto',
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
