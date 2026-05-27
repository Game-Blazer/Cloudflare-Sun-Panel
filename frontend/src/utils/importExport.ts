/**
 * 导入导出工具函数
 * 文件格式: .sun-panel.json
 */
export interface ExportGroup {
  title: string
  sort: number
  children: ExportItem[]
}

export interface ExportItem {
  title: string
  sort: number
  icon: any
  url: string
  description: string
  openMethod: number
}

export interface ExportData {
  version: number
  appName: string
  exportTime: string
  type: 'sun-panel-export'
  icons: ExportGroup[]
}

const CURRENT_VERSION = 1
const APP_NAME = 'Sun-Panel'

function formatDate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const filename = `SunPanel-Data-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}.sun-panel.json`
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

/** 验证导入文件 */
export function validateImportData(json: string): { valid: boolean; data?: ExportData; error?: string } {
  try {
    const data = JSON.parse(json)
    if (!data || data.type !== 'sun-panel-export' || data.appName !== APP_NAME) {
      return { valid: false, error: '文件格式不正确，请选择 .sun-panel.json 文件' }
    }
    if (data.version > CURRENT_VERSION) {
      return { valid: false, error: `配置文件版本 (v${data.version}) 高于当前支持版本 (v${CURRENT_VERSION})` }
    }
    if (!Array.isArray(data.icons)) {
      return { valid: false, error: '文件中不包含图标数据' }
    }
    return { valid: true, data }
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