/**
 * Shared primitives for the core layer: JSON-Schema subsets and id generation.
 *
 * DSH puts message/stream vocabulary in `llm/llm` and tool schemas in
 * `core/tools`. Both need a schema type, so it lives in its own module here to
 * keep the import graph acyclic (llm does not import tools).
 *
 * @module designbuddy/core/schema
 */

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array'
  description?: string
  enum?: (string | number)[]
  items?: JsonSchemaProperty
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
}

export interface JsonSchema {
  type: 'object'
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
  additionalProperties?: boolean
}

export interface ValidationIssue {
  path: string
  message: string
}

/**
 * Validate a tool argument object against the small schema subset this kernel
 * supports: required keys, primitive types and enums. Deliberately not a full
 * JSON-Schema engine — DSH validates with zod/Schemastery, we validate exactly
 * what the tool author declared and no more.
 */
export function validateArgs(schema: JsonSchema | undefined, args: unknown): ValidationIssue[] {
  if (!schema) return []
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return [{ path: '', message: 'arguments must be an object' }]
  }
  const issues: ValidationIssue[] = []
  const record = args as Record<string, unknown>

  for (const key of schema.required ?? []) {
    if (record[key] === undefined) issues.push({ path: key, message: 'is required' })
  }

  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    const value = record[key]
    if (value === undefined) continue
    const issue = validateValue(property, value, key)
    if (issue) issues.push(issue)
  }
  return issues
}

function validateValue(property: JsonSchemaProperty, value: unknown, path: string): ValidationIssue | null {
  const expected = property.type
  const actual = Array.isArray(value) ? 'array' : (typeof value === 'object' && value !== null ? 'object' : typeof value)
  const matches =
    expected === 'integer'
      ? typeof value === 'number' && Number.isInteger(value)
      : expected === 'number'
        ? typeof value === 'number'
        : expected === actual
  if (!matches) return { path, message: `expected ${expected}, received ${actual}` }
  if (property.enum && !property.enum.includes(value as string | number)) {
    return { path, message: `expected one of ${property.enum.join(' | ')}` }
  }
  return null
}

let counter = 0

/** Monotonic id with a prefix, stable for the lifetime of the process. */
export function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter.toString(36)}`
}

/** Test helper: reset the id counter so assertions can match exact ids. */
export function resetIds(): void {
  counter = 0
}
