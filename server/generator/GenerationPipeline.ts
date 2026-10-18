import { PromptAnalyzer } from './PromptAnalyzer';
import { CodeGenerator } from './CodeGenerator';

export class GenerationPipeline {
  private analyzer = new PromptAnalyzer();
  private generator = new CodeGenerator();

  run(prompt: string) {
    const analysis = this.analyzer.analyze(prompt);
    return analysis.components.map(item => this.generator.generate(item));
  }
}
