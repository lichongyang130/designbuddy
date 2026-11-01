import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { Context } from '@designbuddy/core'

export interface Skill {
  name: string
  title: string
  description: string
  body: string
  path: string
}

/**
 * Skills are plain Markdown files with a small frontmatter block.
 *
 * They are loaded as data, not code: adding a skill never requires a rebuild,
 * and the model only pays the token cost of the ones it actually opens.
 */
export class SkillService {
  private skills = new Map<string, Skill>()

  constructor(
    private readonly ctx: Context,
    dir: string,
  ) {
    this.load(resolve(dir))
  }

  list(): Array<Omit<Skill, 'body'>> {
    return [...this.skills.values()].map(({ body, ...rest }) => rest)
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  /** Names + descriptions only — what the system prompt can afford. */
  index(): string {
    return this.list()
      .map((skill) => `- ${skill.name}: ${skill.description || skill.title}`)
      .join('\n')
  }

  private load(dir: string): void {
    if (!existsSync(dir)) {
      this.ctx.log('warn', `skills directory not found: ${dir}`)
      return
    }
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      try {
        const raw = readFileSync(join(dir, file), 'utf8')
        const parsed = parseSkill(raw)
        const name = parsed.attrs.name || basename(file, '.md')
        this.skills.set(name, {
          name,
          title: parsed.attrs.title || name,
          description: parsed.attrs.description || '',
          body: parsed.body,
          path: join(dir, file),
        })
      } catch (error) {
        this.ctx.log('warn', `skill ${file} skipped: ${(error as Error).message}`)
      }
    }
    this.ctx.log('info', `loaded ${this.skills.size} skill(s) from ${dir}`)
    this.ctx.emit('skills/changed', this.list())
  }
}

function parseSkill(raw: string): { attrs: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (!match) return { attrs: {}, body: raw.trim() }
  const attrs: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index < 0) continue
    const key = line.slice(0, index).trim()
    const value = line
      .slice(index + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (key) attrs[key] = value
  }
  return { attrs, body: raw.slice(match[0].length).trim() }
}
