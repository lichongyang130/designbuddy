export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type GeneratedFiles = string[] | Record<string, string>;

export class SourceValidator {
  validate(files: GeneratedFiles): ValidationResult {
    const errors: string[] = [];
    const entries = Array.isArray(files)
      ? files.map((path) => [path, undefined] as const)
      : Object.entries(files);

    if (!entries.length) return { valid: false, errors: ['No generated files'] };

    const seen = new Set<string>();
    for (const [rawPath, source] of entries) {
      const path = rawPath.trim().replace(/\\/g, '/');
      if (!path) {
        errors.push('Generated file path must not be empty');
        continue;
      }
      if (path.startsWith('/') || /^[a-zA-Z]:\//.test(path) || path.split('/').includes('..')) {
        errors.push('Unsafe generated file path: ' + rawPath);
      }
      if (seen.has(path)) errors.push('Duplicate generated file path: ' + path);
      seen.add(path);

      if (source !== undefined) {
        if (!source.trim()) errors.push('Generated file is empty: ' + path);
        if (/\b(TODO|FIXME|IMPLEMENT_ME|PLACEHOLDER)\b/.test(source)) {
          errors.push('Unresolved implementation marker in: ' + path);
        }
        const opens = (source.match(/[({[]/g) ?? []).length;
        const closes = (source.match(/[)}\]]/g) ?? []).length;
        if (opens !== closes) errors.push('Possible unbalanced delimiters in: ' + path);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}
