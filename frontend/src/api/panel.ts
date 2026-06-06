import { post } from '@/utils/request'

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

export function proxyIcon<T>(url: string) {
  return post<T>({ url: '/panel/itemIcon/proxyIcon', data: { url } })
}