export interface BrandProfile {
  colors: string[];
  typography: string[];
  style: string;
}

export class BrandAnalyzer {
  analyze(input: string): BrandProfile {
    return {
      colors: [],
      typography: [],
      style: input
    };
  }
}
