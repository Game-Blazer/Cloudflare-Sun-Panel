import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import { publicModeMiddleware, getAuthUser } from '../middleware/auth'
import {
  validate,
  iconEditSchema,
  iconAddMultipleSchema,
  idsSchema,
  sortSchema,
  getListByGroupIdSchema,
  faviconSchema,
  proxyIconSchema,
} from '../utils/validate'
import { PanelService } from '../services/PanelService'
import { ok, fail, getErrorMessage } from '../utils/response'
import { AppError } from '../utils/errors'
import { isValidUrl, normalizeInputUrl, parseFaviconFromHtml, probeFavicon, createFaviconLogger, type FaviconCandidate } from '../utils/favicon'

// Favicon 发现结果缓存 (key: origin, TTL: 1小时)
const faviconCache = new Map<string, { candidates: FaviconCandidate[]; ts: number }>()
const FAVICON_CACHE_TTL = 60 * 60 * 1000 // 1 小时

type Variables = {
  validatedBody: unknown
}

const panelApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

panelApp.use('*', publicModeMiddleware)

/**
 * 统一获取全部数据（分组 + 所有图标 + 用户配置）
 * POST /api/panel/getAllData
 */
panelApp.post('/getAllData', async (c) => {
  try {
    const user = getAuthUser(c)
    const userId = user!.userId
    const service = new PanelService(c.env.DB)
    const result = await service.getAllData(userId)

    c.header('Cache-Control', 'private, max-age=30')
    return ok(c, result)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 批量添加图标
 * POST /api/panel/itemIcon/addMultiple
 */
panelApp.post('/itemIcon/addMultiple', validate(iconAddMultipleSchema), async (c) => {
  try {
    const user = getAuthUser(c)
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
    const items = c.var.validatedBody as Array<{
      icon?: { itemType: number; src?: string; text?: string; backgroundColor?: string }
      title: string
      url: string
      description?: string
      openMethod?: number
      sort?: number
      itemIconGroupId: number
    }>

    const service = new PanelService(c.env.DB)
    await service.addMultipleIcons(items, user!.userId)
    return ok(c, null)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 编辑图标
 * POST /api/panel/itemIcon/edit
 */
panelApp.post('/itemIcon/edit', validate(iconEditSchema), async (c) => {
  try {
    const user = getAuthUser(c)
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
    const body = c.var.validatedBody as {
      id?: number
      icon?: { itemType: number; src?: string; text?: string; backgroundColor?: string }
      title: string
      url: string
      description?: string
      openMethod?: number
      sort?: number
      itemIconGroupId: number
    }

    const service = new PanelService(c.env.DB)
    const result = await service.editIcon(body, user!.userId)
    return ok(c, result)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 根据分组 ID 获取图标列表
 * POST /api/panel/itemIcon/getListByGroupId
 */
panelApp.post('/itemIcon/getListByGroupId', validate(getListByGroupIdSchema), async (c) => {
  try {
    const user = getAuthUser(c)
    const { itemIconGroupId } = c.var.validatedBody as { itemIconGroupId?: number }

    const service = new PanelService(c.env.DB)
    const list = await service.getIconsByGroupId(itemIconGroupId || 0, user!.userId)
    return ok(c, list)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 批量删除图标
 * POST /api/panel/itemIcon/deletes
 */
panelApp.post('/itemIcon/deletes', validate(idsSchema), async (c) => {
  try {
    const user = getAuthUser(c)
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
    const { ids } = c.var.validatedBody as { ids: number[] }

    const service = new PanelService(c.env.DB)
    await service.deleteIcons(ids, user!.userId)
    return ok(c, null)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 保存图标排序
 * POST /api/panel/itemIcon/saveSort
 */
panelApp.post('/itemIcon/saveSort', validate(sortSchema), async (c) => {
  try {
    const user = getAuthUser(c)
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
    const { sortItems } = c.var.validatedBody as { sortItems: Array<{ id: number; sort: number }> }

    if (sortItems.length === 0) {
      return ok(c, null)
    }

    const service = new PanelService(c.env.DB)
    await service.saveIconSort(sortItems, user!.userId)
    return ok(c, null)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 获取站点图标 (favicon)
 * POST /api/panel/itemIcon/getSiteFavicon
 *
 * 策略:
 * 1. 检查内存缓存 (TTL 1h)
 * 2. 规范化输入 URL
 * 3. 并发执行 HEAD 探测 + HTML 解析
 * 4. 附加第三方服务兜底 (Google, DuckDuckGo)
 * 5. 智能排序: 大尺寸 > SVG > HEAD确认 > HTML声明 > 第三方 > 兜底
 * 6. 8 秒硬超时
 */
panelApp.post('/itemIcon/getSiteFavicon', validate(faviconSchema), async (c) => {
  const startTime = Date.now()
  try {
    const { url } = c.var.validatedBody as { url: string }

    // 1. 规范化输入 URL
    const normalized = normalizeInputUrl(url)
    if (!normalized) {
      return fail(c, 'URL 格式不正确', 400)
    }
    const { origin, domain } = normalized

    const logger = createFaviconLogger(domain)
    logger.log('start')

    // 2. 安全检查 (复用原有 isValidUrl)
    if (!isValidUrl(origin)) {
      return fail(c, 'URL 不合法或包含内网地址', 400)
    }

    // 3. 检查缓存
    const cached = faviconCache.get(origin)
    if (cached && (Date.now() - cached.ts) < FAVICON_CACHE_TTL) {
      logger.hit(cached.candidates.length)
      return ok(c, { iconUrls: cached.candidates.map(c => c.url) })
    }

    // 4. 并发执行 HEAD 探测 + HTML 解析
    const probePaths = [
      '/favicon.ico',
      '/favicon.png',
      '/favicon.svg',
      '/apple-touch-icon.png',
      '/apple-touch-icon-precomposed.png',
    ]

    const probesPromise = Promise.allSettled(
      probePaths.map((path) => probeFavicon(origin, path))
    )

    const htmlPromise = (async (): Promise<FaviconCandidate[]> => {
      try {
        const abort = new AbortController()
        const timeout = setTimeout(() => abort.abort(), 5000)
        const res = await fetch(origin, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SunPanel/1.0)',
            Accept: 'text/html',
          },
          signal: abort.signal,
          redirect: 'follow',
          cf: { cacheTtl: 3600 },
        } as RequestInit)
        clearTimeout(timeout)

        if (!res.ok) return []

        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return []

        const html = await res.text()
        return parseFaviconFromHtml(html, origin)
      } catch {
        return []
      }
    })()

    // 5. 8 秒硬超时控制
    let timedOut = false
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => { timedOut = true; resolve(null) }, 8000)
    })

    // 等待并发结果（或超时）
    const [probeResults] = await Promise.all([
      probesPromise,
      Promise.race([htmlPromise, timeoutPromise]),
    ])

    // 收集 HEAD 探测结果
    const probeCandidates: FaviconCandidate[] = []
    const failedProbePaths = new Set<string>()
    for (let i = 0; i < probeResults.length; i++) {
      const r = probeResults[i]
      if (r.status === 'fulfilled' && r.value) {
        probeCandidates.push(r.value)
      } else {
        failedProbePaths.add(`${origin}${probePaths[i]}`)
      }
    }

    // 收集 HTML 解析结果（如果未超时）
    let htmlCandidates: FaviconCandidate[] = []
    if (!timedOut) {
      const htmlResult = await Promise.race([htmlPromise, timeoutPromise])
      if (htmlResult && Array.isArray(htmlResult)) {
        htmlCandidates = htmlResult
      }
    }

    logger.log('collected', `probes=${probeCandidates.length} html=${htmlCandidates.length}`)

    // 6. 构建去重集合
    const seen = new Set<string>()
    const allCandidates: FaviconCandidate[] = []

    function add(c: FaviconCandidate) {
      if (seen.has(c.url)) return
      seen.add(c.url)
      allCandidates.push(c)
    }

    // 按优先级排序后加入
    const sortCandidates = (list: FaviconCandidate[]) => {
      list.sort((a, b) => {
        // SVG 优先
        const aIsSvg = a.url.endsWith('.svg')
        const bIsSvg = b.url.endsWith('.svg')
        if (aIsSvg && !bIsSvg) return -1
        if (!aIsSvg && bIsSvg) return 1
        // 大尺寸优先
        const aSize = a.size || 0
        const bSize = b.size || 0
        if (aSize >= 32 && bSize < 32) return -1
        if (bSize >= 32 && aSize < 32) return 1
        return bSize - aSize
      })
    }

    // 1) HEAD 探测确认有效
    sortCandidates(probeCandidates)
    for (const c of probeCandidates) add(c)

    // 2) HTML 显式声明
    sortCandidates(htmlCandidates)
    for (const c of htmlCandidates) add(c)

    // 3) 第三方兜底 - 国内可访问源 (参考 getFavicon-master)
    const fallbackCandidates: FaviconCandidate[] = [
      { url: `https://t3.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=${origin}`, source: 'fallback' },
      { url: `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=${origin}`, source: 'fallback' },
      { url: `https://t1.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=${origin}`, source: 'fallback' },
      { url: `https://t0.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=${origin}`, source: 'fallback' },
      { url: `https://api.iowen.cn/favicon/?url=${domain}`, source: 'fallback' },
    ]
    for (const c of fallbackCandidates) add(c)

    // 4) 兜底 /favicon.ico（仅当未被 HEAD 探测失败时添加）
    const defaultFavicon = `${origin}/favicon.ico`
    if (!failedProbePaths.has(defaultFavicon)) {
      add({ url: defaultFavicon, source: 'default' })
    }

    const fallbackCount = fallbackCandidates.filter(c => seen.has(c.url)).length + (failedProbePaths.has(defaultFavicon) ? 0 : 1)
    logger.done(probeCandidates.length, htmlCandidates.length, fallbackCount, allCandidates.length)

    // 7. 缓存结果
    faviconCache.set(origin, { candidates: allCandidates, ts: Date.now() })

    return ok(c, { iconUrls: allCandidates.map(c => c.url) })
  } catch (e: unknown) {
    console.error(`[Favicon] unhandled error`, e)
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 代理获取外部图标
 * POST /api/panel/itemIcon/proxyIcon
 *
 * 当外部图标因 Referrer-Policy 等原因无法在前端直接加载时，通过后端代理获取
 * 并返回 base64 编码的图片数据
 */
panelApp.post('/itemIcon/proxyIcon', validate(proxyIconSchema), async (c) => {
  try {
    const { url } = c.var.validatedBody as { url: string }

    if (!isValidUrl(url)) {
      return fail(c, 'URL 不合法或包含内网地址', 400)
    }

    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), 8000)

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SunPanel/1.0)',
        Accept: 'image/*',
      },
      signal: abort.signal,
      redirect: 'follow',
      cf: { cacheTtl: 86400 },
    } as RequestInit)
    clearTimeout(timeout)

    if (!res.ok) {
      return fail(c, '代理图标失败: 目标服务器返回错误', 502)
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      return fail(c, '代理图标失败: 返回内容不是图片', 502)
    }

    const arrayBuffer = await res.arrayBuffer()

    // 限制最大 500KB
    const MAX_SIZE = 500 * 1024
    if (arrayBuffer.byteLength > MAX_SIZE) {
      return fail(c, '代理图标失败: 图片过大', 413)
    }
    if (arrayBuffer.byteLength === 0) {
      return fail(c, '代理图标失败: 图片为空', 502)
    }

    const base64 = btoa(
      Array.from(new Uint8Array(arrayBuffer))
        .map((b) => String.fromCharCode(b))
        .join(''),
    )

    return ok(c, {
      base64: `data:${contentType};base64,${base64}`,
      contentType,
    })
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

export default panelApp
