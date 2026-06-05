import { post } from '@/utils/request'

interface UserFormData {
  username: string
  name: string
  role: number
  status: number
  password?: string
  id?: number
}

// ========== 认证 API ==========
export function login<T>(username: string, password: string) {
  return post<T>({ url: '/login', data: { username, password } })
}

export function register<T>(username: string, password: string, name?: string, mail?: string) {
  return post<T>({ url: '/register', data: { username, password, name, mail } })
}

// ========== 图标分组 API ==========
export function getGroupList<T>() {
  return post<T>({ url: '/panel/itemIconGroup/getList' })
}

/** 统一获取全部数据（分组 + 所有图标 + 用户配置），一次请求替代 N+1 次 */
export function getAllData<T>() {
  return post<T>({ url: '/panel/getAllData' })
}

export function saveGroup<T>(req: Panel.ItemIconGroup) {
  return post<T>({ url: '/panel/itemIconGroup/edit', data: req })
}

export function deleteGroups<T>(ids: number[]) {
  return post<T>({ url: '/panel/itemIconGroup/deletes', data: { ids } })
}

export function saveGroupSort<T>(sortItems: Common.SortItemRequest[]) {
  return post<T>({ url: '/panel/itemIconGroup/saveSort', data: { sortItems } })
}

// ========== 图标 API ==========
export function addItems<T>(items: Panel.ItemInfo[]) {
  return post<T>({ url: '/panel/itemIcon/addMultiple', data: items })
}

export function editItem<T>(req: Panel.ItemInfo) {
  return post<T>({ url: '/panel/itemIcon/edit', data: req })
}

export function getItemsByGroup<T>(groupId: number) {
  return post<T>({ url: '/panel/itemIcon/getListByGroupId', data: { itemIconGroupId: groupId } })
}

export function deleteItems<T>(ids: number[]) {
  return post<T>({ url: '/panel/itemIcon/deletes', data: { ids } })
}

export function saveItemSort<T>(data: Panel.ItemIconSortRequest) {
  return post<T>({ url: '/panel/itemIcon/saveSort', data })
}

export function getSiteFavicon<T>(url: string) {
  return post<T>({ url: '/panel/itemIcon/getSiteFavicon', data: { url } })
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