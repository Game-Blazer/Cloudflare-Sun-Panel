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

/** 从 HTML 中解析 favicon 链接（返回所有候选，去重） */
export function parseFaviconFromHtml(html: string, baseUrl: string): string[] {
  const candidates: string[] = []
  const seen = new Set<string>()

  function addCandidate(href: string) {
    try {
      const resolved = new URL(href, baseUrl).href
      if (seen.has(resolved)) return
      seen.add(resolved)
      candidates.push(resolved)
    } catch {
      /* ignore invalid href */
    }
  }

  // 1. <link rel="icon|shortcut icon|apple-touch-icon|mask-icon|fluid-icon" href="...">
  // 支持 href 在 rel 前后、属性用单/双引号或无引号
  const linkRegex = /<link[^>]*?>/gi
  let linkMatch: RegExpExecArray | null
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const tag = linkMatch[0]
    const rel = /rel=["']?([^"'\s>]+)["']?/i.exec(tag)
    if (!rel) continue
    const relVal = rel[1].toLowerCase()
    if (!/\b(?:icon|shortcut|apple-touch|mask-icon|fluid-icon)\b/i.test(relVal)) continue

    const href = /href=["']?([^"'\s>]+)["']?/i.exec(tag)
    if (href && href[1]) {
      addCandidate(href[1])
    }
  }

  // 2. <meta name="msapplication-TileImage" content="...">
  const msTileRegex = /<meta\s[^>]*name=["']?msapplication-TileImage["']?[^>]*>/gi
  let msMatch: RegExpExecArray | null
  while ((msMatch = msTileRegex.exec(html)) !== null) {
    const content = /content=["']?([^"'\s>]+)["']?/i.exec(msMatch[0])
    if (content && content[1]) addCandidate(content[1])
  }

  return candidates
}

/** 快速探测 favicon 路径（HEAD 请求，不下载 body） */
export async function probeFavicon(origin: string, path: string): Promise<string | null> {
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
    if (res.ok) {
      const ct = res.headers.get('content-type') || ''
      if (ct.startsWith('image/') || ct.includes('icon')) {
        return `${origin}${path}`
      }
    }
  } catch {
    /* probe failed */
  }
  return null
}