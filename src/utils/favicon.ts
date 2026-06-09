export interface FaviconCandidate {
  url: string
  size?: number       // 图标尺寸（取 width），如 32 表示 32x32
  source: 'probe' | 'link' | 'meta' | 'fallback' | 'default'
}

/** 校验 URL 是否合法（SSRF 防护） */
export function isValidUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return false

    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const match = hostname.match(ipv4Pattern)
    if (match) {
      const [, a, b] = match.map(Number)
      if (a === 10) return false
      if (a === 172 && b >= 16 && b <= 31) return false
      if (a === 192 && b === 168) return false
      if (a === 127) return false
      if (a === 169 && b === 254) return false
      if (a === 0) return false
    }
    return true
  } catch {
    return false
  }
}

/** 规范化用户输入的 URL，提取标准化 origin 和 domain */
export function normalizeInputUrl(rawUrl: string): { origin: string; domain: string } | null {
  let urlStr = rawUrl.trim()
  if (!urlStr) return null
  
  // 自动补全协议
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = 'https://' + urlStr
  }
  
  try {
    const url = new URL(urlStr)
    return { origin: url.origin, domain: url.hostname }
  } catch {
    return null
  }
}

/** 从 HTML 中解析 favicon 链接（返回候选列表，按尺寸降序） */
export function parseFaviconFromHtml(html: string, baseUrl: string): FaviconCandidate[] {
  const candidates: FaviconCandidate[] = []
  const seen = new Set<string>()

  function parseSize(sizesAttr: string): number | undefined {
    if (!sizesAttr || sizesAttr.toLowerCase() === 'any') return undefined
    const match = sizesAttr.match(/(\d+)x(\d+)/i)
    if (match) {
      const w = parseInt(match[1], 10)
      return isNaN(w) ? undefined : w
    }
    return undefined
  }

  function addCandidate(href: string, size: number | undefined, source: FaviconCandidate['source']) {
    try {
      const resolved = new URL(href, baseUrl).href
      if (seen.has(resolved)) return
      seen.add(resolved)
      candidates.push({ url: resolved, size, source })
    } catch {
      /* ignore invalid href */
    }
  }

  // 1. <link rel="icon|shortcut icon|apple-touch-icon|mask-icon|fluid-icon" href="..." sizes="...">
  const linkRegex = /<link[^>]*?>/gi
  let linkMatch: RegExpExecArray | null
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const tag = linkMatch[0]
    const rel = /rel=["']?([^"'\s>]+)["']?/i.exec(tag)
    if (!rel) continue
    const relVal = rel[1].toLowerCase()
    if (!/\b(?:icon|shortcut|apple-touch|mask-icon|fluid-icon)\b/i.test(relVal)) continue

    const href = /href=["']?([^"'\s>]+)["']?/i.exec(tag)
    if (!href || !href[1]) continue

    const sizes = /sizes=["']?([^"'\s>]+)["']?/i.exec(tag)
    const size = sizes ? parseSize(sizes[1]) : undefined
    addCandidate(href[1], size, 'link')
  }

  // 2. <meta name="msapplication-TileImage" content="...">
  const msTileRegex = /<meta\s[^>]*name=["']?msapplication-TileImage["']?[^>]*>/gi
  let msMatch: RegExpExecArray | null
  while ((msMatch = msTileRegex.exec(html)) !== null) {
    const content = /content=["']?([^"'\s>]+)["']?/i.exec(msMatch[0])
    if (content && content[1]) addCandidate(content[1], undefined, 'meta')
  }

  // 按尺寸降序排列（有尺寸的优先，大尺寸优先）
  candidates.sort((a, b) => {
    if (a.size && b.size) return b.size - a.size
    if (a.size) return -1
    if (b.size) return 1
    return 0
  })

  return candidates
}

/** 快速探测 favicon 路径（HEAD 请求），返回 FaviconCandidate 或 null */
export async function probeFavicon(origin: string, path: string): Promise<FaviconCandidate | null> {
  try {
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), 3000)
    const res = await fetch(`${origin}${path}`, {
      method: 'HEAD',
      signal: abort.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SunPanel/1.0)' },
      cf: { cacheTtl: 3600 },
    } as RequestInit)
    clearTimeout(timeout)
    
    if (!res.ok) return null
    
    // Content-Length 校验：不为 0
    const cl = res.headers.get('content-length')
    if (cl !== null && parseInt(cl, 10) === 0) return null
    
    // Content-Type 校验：接受 image/*、application/octet-stream、含 icon 的类型
    const ct = res.headers.get('content-type') || ''
    const ctLower = ct.toLowerCase()
    if (!ctLower.startsWith('image/') && ctLower !== 'application/octet-stream' && !ctLower.includes('icon')) {
      return null
    }
    
    return { url: `${origin}${path}`, source: 'probe' }
  } catch {
    /* probe failed */
  }
  return null
}

/** 创建 favicon 流程专用 logger */
export function createFaviconLogger(domain: string) {
  const startTime = Date.now()
  return {
    log(phase: string, detail?: string) {
      console.log(`[Favicon] domain=${domain} phase=${phase}${detail ? ' ' + detail : ''}`)
    },
    done(probes: number, html: number, fallback: number, total: number) {
      const elapsed = Date.now() - startTime
      console.log(`[Favicon] domain=${domain} cache=miss probes=${probes} html=${html} fallback=${fallback} candidates=${total} time=${elapsed}ms`)
    },
    hit(total: number) {
      console.log(`[Favicon] domain=${domain} cache=hit candidates=${total}`)
    },
    error(phase: string, err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Favicon] domain=${domain} phase=${phase} error=${msg}`)
    },
  }
}