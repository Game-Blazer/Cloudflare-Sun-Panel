import { post } from '@/utils/request'

export interface UserFormData {
  username: string
  name: string
  role: number
  status: number
  password?: string
  id?: number
}

// ========== 用户配置 API ==========
export function getUserConfig<T>() {
  return post<T>({ url: '/panel/userConfig/get' })
}

export function setUserConfig<T>(config: Panel.userConfig) {
  return post<T>({ url: '/panel/userConfig/set', data: config })
}

// ========== 用户 API ==========
export function getAuthInfo<T>() {
  return post<T>({ url: '/user/getAuthInfo' })
}

export function updateUserInfo<T>(name: string) {
  return post<T>({ url: '/user/updateInfo', data: { name } })
}

export function updatePassword<T>(oldPassword: string, newPassword: string) {
  return post<T>({ url: '/user/updatePassword', data: { oldPassword, newPassword } })
}

// ========== 用户管理 API (管理员) ==========
export function getUserList<T>(page: number, pageSize: number) {
  return post<T>({ url: '/panel/users/getList', data: { page, pageSize } })
}

export function createUser<T>(data: UserFormData) {
  return post<T>({ url: '/panel/users/create', data })
}

export function updateUser<T>(data: UserFormData) {
  return post<T>({ url: '/panel/users/update', data })
}

export function deleteUsers<T>(userIds: number[]) {
  return post<T>({ url: '/panel/users/deletes', data: { userIds } })
}

// ========== 公开访问用户 API (管理员) ==========
export function getPublicVisitUser<T>() {
  return post<T>({ url: '/panel/users/getPublicVisitUser' })
}

export function setPublicVisitUser<T>(userId: number | null) {
  return post<T>({ url: '/panel/users/setPublicVisitUser', data: { userId } })
}