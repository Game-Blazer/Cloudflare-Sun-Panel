// ========== 数据库行类型 ==========

export interface UserRow {
  id: number
  username: string
  password: string
  name: string
  head_image: string
  status: number
  role: number
  mail: string
  created_at: string
  updated_at: string
}

export interface ItemIconGroupRow {
  id: number
  icon: string
  title: string
  description: string
  sort: number
  public_visible: number
  user_id: number
  created_at: string
  updated_at: string
}

export interface ItemIconRow {
  id: number
  icon_json: string
  title: string
  url: string
  description: string
  open_method: number
  sort: number
  item_icon_group_id: number
  user_id: number
  created_at: string
  updated_at: string
}

export interface SystemSettingRow {
  id: number
  config_name: string
  config_value: string
  created_at: string
  updated_at: string
}

// ========== API 请求/响应类型 ==========

export interface UserInfo {
  id: number
  username: string
  name: string
  headImage: string
  status: number
  role: number
  mail: string
  created_at: string
}

export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}
