import { post } from '@/utils/request'

// ========== 系统设置 API ==========
export function getSystemSetting<T>(configName: string) {
  return post<T>({ url: '/system/setting/get', data: { configName } })
}

export function setSystemSetting<T>(configName: string, configValue: string) {
  return post<T>({ url: '/system/setting/set', data: { configName, configValue } })
}

export function getAbout<T>() {
  return post<T>({ url: '/about' })
}

// ========== 站点全局设置 API ==========
export function saveSiteSettings<T>(settings: Record<string, string>) {
  return post<T>({ url: '/system/settings/saveAll', data: settings })
}

// ========== 聚合初始化 API ==========
export function getInit<T>() {
  return post<T>({ url: '/init' })
}