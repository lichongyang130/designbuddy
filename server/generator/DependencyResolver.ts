export interface Dependency {
  name: string;
  version?: string;
}

export class DependencyResolver {
  resolve(framework: string): Dependency[] {
    if (framework === 'react') {
      return [
        { name: 'react' },
        { name: 'react-dom' }
      ];
    }

    return [];
  }
}
