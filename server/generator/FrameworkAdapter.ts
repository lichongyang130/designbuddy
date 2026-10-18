export interface FrameworkAdapter {
  name: string;
  generateEntry(): string;
}

export class ReactAdapter implements FrameworkAdapter {
  name = 'react';

  generateEntry() {
    return 'src/main.tsx';
  }
}
