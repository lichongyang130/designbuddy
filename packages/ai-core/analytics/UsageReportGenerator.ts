export class UsageReportGenerator {
  generate(data: unknown[]) { return { generatedAt: new Date().toISOString(), records: data }; }
}
