/**
 * 导入导出工具函数
 * 文件格式: .sun-panel.json
 *
 * 支持两种导出文件来源：
 *   1. 原始版本 — 作者原版 Sun-Panel v1.8.1 导出
 *      (appName="Sun-Panel-Config", 无 type 字段, 有 appVersion/md5)
 *   2. Cloudflare Worker 版本 — 本项目的导出
 *      (appName="Sun-Panel", type="sun-panel-export")
 */
export interface ExportGroup {
  title: string
  sort: number
  children: ExportItem[]
}

export interface ExportItem {
  title: string
  sort: number
  icon: Panel.ItemIcon | null
  url: string
  description: string
  openMethod: number
}

export interface ExportData {
  version: number
  appName: string
  exportTime: string
  type?: 'sun-panel-export'
  appVersion?: string
  md5?: string
  icons: ExportGroup[]
}

/** 已知有效的 Sun-Panel 导出 appName（原始版本 + Cloudflare Worker 版本） */
const VALID_APP_NAMES = ['Sun-Panel', 'Sun-Panel-Config']

const CURRENT_VERSION = 1
const APP_NAME = 'Sun-Panel'

const pad = (n: number) => String(n).padStart(2, '0')

function formatDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatDateCompact(): string {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`
}

/** 创建导出数据结构 */
export function createExportData(groups: ExportGroup[]): ExportData {
  return {
    version: CURRENT_VERSION,
    appName: APP_NAME,
    exportTime: formatDate(),
    type: 'sun-panel-export',
    icons: groups,
  }
}

/** 下载 JSON 文件 */
export function downloadJSON(data: ExportData): void {
  const jsonStr = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const filename = `SunPanel-Data-${formatDateCompact()}.sun-panel.json`
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

/** 验证导入文件（支持原始版本与 Cloudflare Worker 版本） */
export function validateImportData(json: string): { valid: boolean; data?: ExportData; error?: string } {
  try {
    const data = JSON.parse(json)

    if (!data || typeof data !== 'object') {
      return { valid: false, error: '文件格式错误，无法识别' }
    }

    const hasIcons = Array.isArray(data.icons)
    const hasValidType = data.type === 'sun-panel-export'
    const hasValidAppName = VALID_APP_NAMES.includes(data.appName)

    // Cloudflare Worker 版本校验：同时满足 type + appName
    if (hasValidType && hasValidAppName && hasIcons) {
      if (data.version > CURRENT_VERSION) {
        return { valid: false, error: `配置文件版本 (v${data.version}) 高于当前支持版本 (v${CURRENT_VERSION})` }
      }
      return { valid: true, data }
    }

    // 原始版本兼容（作者原版 Sun-Panel v1.8.1）：无 type 字段但有 appName + icons
    if (!data.type && hasValidAppName && hasIcons) {
      if (data.version > CURRENT_VERSION) {
        return { valid: false, error: `配置文件版本 (v${data.version}) 高于当前支持版本 (v${CURRENT_VERSION})` }
      }
      return { valid: true, data }
    }

    if (!hasIcons) {
      return { valid: false, error: '文件中不包含图标数据' }
    }

    return { valid: false, error: '文件格式不正确，请选择 .sun-panel.json 文件' }
  } catch {
    return { valid: false, error: '文件格式错误，无法解析 JSON' }
  }
}

/** 读取文件内容为字符串 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}
