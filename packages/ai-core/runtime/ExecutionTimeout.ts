export class ExecutionTimeout {
  static async run<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Execution timeout')), timeoutMs);
    });

    return Promise.race([task, timeout]);
  }
}
