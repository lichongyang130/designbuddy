export interface ScaffoldConfig {
  name: string;
  framework: string;
  language: string;
}

export interface ProjectStructure {
  files: string[];
  dependencies: string[];
}

export class ProjectScaffold {
  create(config: ScaffoldConfig): ProjectStructure {
    const name = config.name.trim();
    const framework = config.framework.trim().toLowerCase();
    const language = config.language.trim().toLowerCase();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name)) {
      throw new Error('Project name must be 1-64 characters and contain only letters, numbers, dots, underscores, and hyphens');
    }
    if (!['react', 'vue', 'svelte', 'html'].includes(framework)) {
      throw new Error(`Unsupported framework: ${config.framework}`);
    }
    if (!['typescript', 'javascript', 'ts', 'js'].includes(language)) {
      throw new Error(`Unsupported language: ${config.language}`);
    }

    const ts = language === 'typescript' || language === 'ts';
    if (framework === 'html') {
      return { files: [`${name}/index.html`, `${name}/src/main.${ts ? 'ts' : 'js'}`, `${name}/package.json`], dependencies: [] };
    }
    const extension = ts ? 'tsx' : 'jsx';
    const dependencies = framework === 'react' ? ['react', 'react-dom', 'vite']
      : framework === 'vue' ? ['vue', 'vite']
      : ['svelte', 'vite', '@sveltejs/vite-plugin-svelte'];
    return {
      files: [
        `${name}/package.json`,
        `${name}/index.html`,
        `${name}/src/main.${ts ? 'ts' : 'js'}`,
        `${name}/src/App.${extension}`,
        ...(ts ? [`${name}/tsconfig.json`] : []),
      ],
      dependencies,
    };
  }
}
