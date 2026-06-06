import { defineStore } from 'pinia'

const TOKEN_KEY = 'sun-panel-token'
const USER_KEY = 'sun-panel-user'
const VISIT_MODE_KEY = 'sun-panel-visit-mode'

export enum VisitMode {
  VISIT_MODE_LOGIN = 0,
  VISIT_MODE_PUBLIC = 1,
}

export interface AuthState {
  token: string | null
  userInfo: User.Info | null
  visitMode: VisitMode
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => {
    const token = localStorage.getItem(TOKEN_KEY)
    const userStr = localStorage.getItem(USER_KEY)
    const visitMode = Number(localStorage.getItem(VISIT_MODE_KEY)) || VisitMode.VISIT_MODE_LOGIN
    let userInfo = null
    if (userStr) {
      try {
        userInfo = JSON.parse(userStr)
      } catch {
        userInfo = null
      }
    }
    return {
      token,
      userInfo,
      visitMode,
    }
  },

  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.userInfo?.role === 1,
    isVisitMode: (state) => state.visitMode === VisitMode.VISIT_MODE_PUBLIC,
    isAuthenticated: (state) => !!state.token || state.visitMode === VisitMode.VISIT_MODE_PUBLIC,
  },

  actions: {
    setToken(token: string) {
      this.token = token
      localStorage.setItem(TOKEN_KEY, token)
    },

    setUserInfo(info: User.Info) {
      this.userInfo = info
      localStorage.setItem(USER_KEY, JSON.stringify(info))
    },

    setVisitMode(mode: VisitMode) {
      this.visitMode = mode
      localStorage.setItem(VISIT_MODE_KEY, String(mode))
    },

    loginSuccess(token: string, userInfo: User.Info) {
      this.setToken(token)
      this.setUserInfo(userInfo)
      this.setVisitMode(VisitMode.VISIT_MODE_LOGIN)
    },

    setGuestMode(userInfo: User.Info | null) {
      this.token = null
      localStorage.removeItem(TOKEN_KEY)
      this.setVisitMode(VisitMode.VISIT_MODE_PUBLIC)
      if (userInfo) {
        this.setUserInfo(userInfo)
      }
    },

    removeToken() {
      this.token = null
      this.userInfo = null
      this.visitMode = VisitMode.VISIT_MODE_LOGIN
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(VISIT_MODE_KEY)
      localStorage.removeItem('sun-panel-state')
      sessionStorage.setItem('sun-panel-skip-redirect', '1')
    },
  },
})
