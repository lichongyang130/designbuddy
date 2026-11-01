import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { Context } from '@designbuddy/core'

export interface FileEntry {
  path: string
  size: number
  updatedAt: number
}

const TEXT_LIMIT = 200_000
const IGNORED = new Set(['node_modules', '.git', 'dist', '.data', 'lib'])

/** A workspace rooted at one directory. Every path is sandboxed to it. */
export class WorkspaceService {
  readonly root: string

  constructor(
    private readonly ctx: Context,
    root: string,
  ) {
    this.root = resolve(root)
    if (!existsSync(this.root)) mkdirSync(this.root, { recursive: true })
  }

  /** Resolves a user-supplied path, refusing to escape the workspace. */
  resolvePath(path: string): string {
    const absolute = resolve(this.root, path || '.')
    const rel = relative(this.root, absolute)
    if (rel.startsWith('..') || (rel !== '' && resolve(this.root, rel) !== absolute)) {
      throw new Error(`path escapes the workspace: ${path}`)
    }
    return absolute
  }

  toRelative(absolute: string): string {
    return relative(this.root, absolute).split(sep).join('/') || '.'
  }

  list(path = '.', options: { recursive?: boolean } = {}): FileEntry[] {
    const absolute = this.resolvePath(path)
    if (!existsSync(absolute)) throw new Error(`no such path: ${path}`)
    const out: FileEntry[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (IGNORED.has(name)) continue
        const full = join(dir, name)
        const stat = statSync(full)
        if (stat.isDirectory()) {
          if (options.recursive) walk(full)
        } else {
          out.push({ path: this.toRelative(full), size: stat.size, updatedAt: stat.mtimeMs })
        }
      }
    }
    const stat = statSync(absolute)
    if (stat.isFile()) return [{ path: this.toRelative(absolute), size: stat.size, updatedAt: stat.mtimeMs }]
    walk(absolute)
    return out.sort((a, b) => a.path.localeCompare(b.path))
  }

  read(path: string): string {
    const absolute = this.resolvePath(path)
    if (!existsSync(absolute)) throw new Error(`no such file: ${path}`)
    const stat = statSync(absolute)
    if (stat.size > TEXT_LIMIT) throw new Error(`file too large (${stat.size} bytes): ${path}`)
    return readFileSync(absolute, 'utf8')
  }

  write(path: string, content: string): FileEntry {
    const absolute = this.resolvePath(path)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, content, 'utf8')
    const stat = statSync(absolute)
    this.ctx.emit('workspace/write', { path: this.toRelative(absolute) })
    return { path: this.toRelative(absolute), size: stat.size, updatedAt: stat.mtimeMs }
  }

  search(query: string, options: { limit?: number } = {}): Array<{ path: string; line: number; text: string }> {
    const needle = query.toLowerCase()
    const hits: Array<{ path: string; line: number; text: string }> = []
    for (const file of this.list('.', { recursive: true })) {
      if (!/\.(md|txt|json|ts|tsx|js|jsx|css|html|ya?ml)$/.test(file.path)) continue
      let content: string
      try {
        content = this.read(file.path)
      } catch {
        continue
      }
      content.split('\n').forEach((line, index) => {
        if (hits.length < (options.limit ?? 40) && line.toLowerCase().includes(needle)) {
          hits.push({ path: file.path, line: index + 1, text: line.trim().slice(0, 200) })
        }
      })
      if (hits.length >= (options.limit ?? 40)) break
    }
    return hits
  }
}
