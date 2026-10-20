export function parseDesignMD(markdown: string) {
  const vars: Record<string, string> = {};
  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = line.match(/^-\s*([A-Za-z0-9_]+)\s*:\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      vars[`--${key}`] = value;
      // Map common keys to our template specific vars
      if (key === 'primary') {
        vars['--fm-primary'] = value;
        vars['--rt-primary'] = value;
        vars['--at-primary'] = value;
        vars['--dl-primary'] = value;
        vars['--td-primary'] = value;
        vars['--mr-primary'] = value;
        vars['--accent'] = value;
      }
      if (key === 'background') {
        vars['--bg-color'] = value;
      }
    }
  }
  return vars;
}

export function applyDesignTokens(tokens: Record<string, string>) {
  for (const [key, value] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(key, value);
  }
}
