/**
 * 商业图片素材源抽象层（阶段 1 扩展）。
 *
 * 解决“缺少完整素材和图表体系”的问题，提供可插拔的图片素材源：
 *   - LocalSource：本地素材目录，零成本、无网络依赖，企业自有素材
 *   - UnsplashSource：Unsplash 免费高质量照片（需 API Key）
 *   - PexelsSource：Pexels 免费照片/视频（需 API Key）
 *   - FallbackSource：降级占位，所有源都失败时兜底
 *
 * 所有素材都带版权信息（摄影师、来源、许可证），导出时自动生成
 * 图片版权清单，避免商业使用侵权风险。
 *
 * 网络受限于 sandbox 出站白名单，Unsplash/Pexels 需在有网络且
 * 配置了 API Key 的环境下使用；LocalSource 可在本地离线使用。
 *
 * @module designbuddy/core/image-source
 */

import { createHash } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export type ImageLicense = 'unsplash' | 'pexels' | 'local' | 'cc0' | 'placeholder'

export interface ImageAsset {
  /** 素材唯一 ID */
  id: string
  /** 原图 URL（可下载） */
  url: string
  /** 缩略图 URL */
  thumbUrl: string
  /** 图片宽度（px） */
  width: number
  /** 图片高度（px） */
  height: number
  /** 摄影师 / 作者 */
  photographer: string
  /** 作者主页 URL */
  photographerUrl: string
  /** 许可证类型 */
  license: ImageLicense
  /** 署名文本（导出时可渲染到 PPT） */
  attribution: string
  /** 素材来源名称 */
  source: string
}

/** 图片素材源接口。 */
export interface ImageSource {
  /** 关键词搜索素材 */
  search(keyword: string, width?: number, height?: number, count?: number): Promise<ImageAsset[]>
  /** 按 ID 获取单张素材 */
  getById(id: string): Promise<ImageAsset | null>
  /** 下载图片二进制 */
  download(url: string): Promise<Buffer>
}

/** 图片下载缓存目录 */
const CACHE_DIR = join(process.env.DB_OUTPUT_DIR ?? '.designbuddy/output', 'assets', 'images')

/** 确保缓存目录存在 */
function ensureCacheDir(): string {
  try {
    mkdirSync(CACHE_DIR, { recursive: true })
  } catch {
    // 目录已存在或无权限，忽略
  }
  return CACHE_DIR
}

/** URL → 文件名哈希 */
function urlToFileName(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}

/** 本地素材目录源：读取本地 assets/images/ 目录下的图片。 */
export class LocalSource implements ImageSource {
  private localDir: string

  constructor(localDir: string) {
    this.localDir = localDir
  }

  async search(keyword: string, width?: number, height?: number, count = 5): Promise<ImageAsset[]> {
    if (!existsSync(this.localDir)) return []
    const files = readdirSync(this.localDir)
    const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const matched = files.filter((f) => {
      const ext = join('', f).slice(f.lastIndexOf('.')).toLowerCase()
      if (!exts.includes(ext)) return false
      if (!keyword) return true
      return f.toLowerCase().includes(keyword.toLowerCase())
    })
    return matched
      .slice(0, count)
      .map((f) => {
        const path = join(this.localDir, f)
        return {
          id: `local-${f}`,
          url: path,
          thumbUrl: path,
          width: width ?? 1280,
          height: height ?? 720,
          photographer: 'Local Asset',
          photographerUrl: '',
          license: 'local' as const,
          attribution: `Image: ${f}`,
          source: 'local',
        }
      })
  }

  async getById(id: string): Promise<ImageAsset | null> {
    return null
  }

  async download(url: string): Promise<Buffer> {
    return readFileSync(url)
  }
}

/** Unsplash 源：https://unsplash.com/developers */
export class UnsplashSource implements ImageSource {
  private accessKey: string

  constructor(accessKey: string) {
    this.accessKey = accessKey
  }

  async search(keyword: string, width?: number, height?: number, count = 5): Promise<ImageAsset[]> {
    const w = width ?? 1280
    const h = height ?? 720
    const url =
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}` +
      `&per_page=${count}&orientation=landscape&w=${w}&h=${h}`
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${this.accessKey}` },
    })
    if (!res.ok) throw new Error(`Unsplash API ${res.status}: ${res.statusText}`)
    const data = await res.json()
    return data.results.map((r: any) => ({
      id: r.id,
      url: r.urls.regular,
      thumbUrl: r.urls.thumb,
      width: r.width,
      height: r.height,
      photographer: r.user.name,
      photographerUrl: r.user.links.html,
      license: 'unsplash' as const,
      attribution: `Photo by ${r.user.name} on Unsplash`,
      source: 'unsplash',
    }))
  }

  async getById(id: string): Promise<ImageAsset | null> {
    const res = await fetch(`https://api.unsplash.com/photos/${id}`, {
      headers: { Authorization: `Client-ID ${this.accessKey}` },
    })
    if (!res.ok) return null
    const r = await res.json()
    return {
      id: r.id,
      url: r.urls.regular,
      thumbUrl: r.urls.thumb,
      width: r.width,
      height: r.height,
      photographer: r.user.name,
      photographerUrl: r.user.links.html,
      license: 'unsplash' as const,
      attribution: `Photo by ${r.user.name} on Unsplash`,
      source: 'unsplash',
    }
  }

  async download(url: string): Promise<Buffer> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  }
}

/** Pexels 源：https://www.pexels.com/api/ */
export class PexelsSource implements ImageSource {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async search(keyword: string, width?: number, height?: number, count = 5): Promise<ImageAsset[]> {
    const url =
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}` +
      `&per_page=${count}&orientation=landscape`
    const res = await fetch(url, {
      headers: { Authorization: this.apiKey },
    })
    if (!res.ok) throw new Error(`Pexels API ${res.status}: ${res.statusText}`)
    const data = await res.json()
    return data.photos.map((p: any) => ({
      id: String(p.id),
      url: p.src.large2x ?? p.src.large,
      thumbUrl: p.src.tiny,
      width: p.width,
      height: p.height,
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      license: 'pexels' as const,
      attribution: `Photo by ${p.photographer} on Pexels`,
      source: 'pexels',
    }))
  }

  async getById(id: string): Promise<ImageAsset | null> {
    return null
  }

  async download(url: string): Promise<Buffer> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  }
}

/** 降级源：生成 SVG 占位图，所有源都失败时兜底。 */
export class FallbackSource implements ImageSource {
  async search(keyword: string, width?: number, height?: number, count = 1): Promise<ImageAsset[]> {
    const w = width ?? 1280
    const h = height ?? 720
    return [
      {
        id: `fallback-${keyword}`,
        url: '',
        thumbUrl: '',
        width: w,
        height: h,
        photographer: 'DesignBuddy',
        photographerUrl: '',
        license: 'cc0' as const,
        attribution: `Illustration: ${keyword}`,
        source: 'placeholder',
      },
    ]
  }

  async getById(id: string): Promise<ImageAsset | null> {
    return null
  }

  async download(url: string): Promise<Buffer> {
    throw new Error('FallbackSource cannot download')
  }
}

/** 素材源管理器：按优先级尝试多个源，失败自动降级。 */
export class ImageSourceManager {
  private sources: ImageSource[] = []
  private fallback = new FallbackSource()
  /** 已下载图片缓存：URL → Buffer */
  private downloadCache = new Map<string, Buffer>()

  addSource(source: ImageSource): void {
    this.sources.push(source)
  }

  /** 搜索素材：按源顺序尝试，失败则尝试下一个源，全部失败则返回 fallback。 */
  async search(
    keyword: string,
    width?: number,
    height?: number,
    count = 1,
  ): Promise<ImageAsset[]> {
    for (const source of this.sources) {
      try {
        const assets = await source.search(keyword, width, height, count)
        if (assets.length > 0) return assets
      } catch {
        // 尝试下一个源
      }
    }
    return this.fallback.search(keyword, width, height, count)
  }

  /** 下载图片并缓存：URL → Buffer */
  async downloadCached(url: string): Promise<Buffer> {
    const cached = this.downloadCache.get(url)
    if (cached) return cached

    let buf: Buffer
    for (const source of this.sources) {
      try {
        buf = await source.download(url)
        this.downloadCache.set(url, buf)
        return buf
      } catch {
        // 尝试下一个源
      }
    }
    throw new Error(`Unable to download image: ${url}`)
  }

  /** 将图片素材写入本地缓存目录，返回本地文件路径。 */
  saveToCache(url: string, buf: Buffer): string {
    ensureCacheDir()
    const fileName = `${urlToFileName(url)}.${url.includes('.jpg') || url.includes('.jpeg') ? 'jpg' : 'png'}`
    const path = join(CACHE_DIR, fileName)
    try {
      writeFileSync(path, buf)
    } catch {
      // 缓存写入失败不影响主流程
    }
    return path
  }
}

/** 默认素材源管理器（单例）。可在应用启动时注入 Unsplash/Pexels 源。 */
export const imageSource = new ImageSourceManager()
