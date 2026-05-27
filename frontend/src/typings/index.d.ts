declare namespace Common {
  interface InfoBase {
    id?: number
    createTime?: string
    updateTime?: string
  }

  interface SortItemRequest {
    id: number
    sort: number
  }

  interface ListResponse<T> {
    list: T[]
    total: number
    page: number
    pageSize: number
  }
}

declare namespace User {
  interface Info {
    id: number
    username: string
    name: string
    headImage: string
    status: number
    role: number
    mail: string
    created_at: string
  }
}

declare namespace Panel {
  interface ItemInfo {
    id?: number
    icon: ItemIcon | null
    title: string
    url: string
    sort?: number
    description?: string
    openMethod: number
    itemIconGroupId?: number
    userId?: number
    createTime?: string
    updateTime?: string
  }

  interface ItemIconGroup {
    id?: number
    icon?: string
    title: string
    description?: string
    sort?: number
    userId?: number
    createTime?: string
    updateTime?: string
  }

  interface ItemIcon {
    itemType: number
    src?: string
    text?: string
    backgroundColor?: string
  }

  interface panelConfig {
    backgroundImageSrc?: string
    backgroundBlur?: number
    backgroundMaskNumber?: number
    iconStyle?: PanelPanelConfigStyleEnum
    iconTextColor?: string
    iconTextInfoHideDescription?: boolean
    iconTextIconHideTitle?: boolean
    logoText?: string
    logoImageSrc?: string
    clockShowSecond?: boolean
    clockColor?: string
    searchBoxShow?: boolean
    searchBoxSearchIcon?: boolean
    marginTop?: number
    marginBottom?: number
    maxWidth?: number
    maxWidthUnit?: string
    marginX?: number
    footerHtml?: string
    systemMonitorShow?: boolean
    systemMonitorShowTitle?: boolean
    systemMonitorPublicVisitModeShow?: boolean
  }

  type PanelPanelConfigStyleEnum = 'text' | 'image' | 'detail'

  interface userConfig {
    panel: panelConfig
    searchEngine?: any
  }

  interface ItemIconSortRequest {
    sortItems: Common.SortItemRequest[]
    itemIconGroupId: number
  }
}