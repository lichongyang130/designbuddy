export class RootCauseAnalyzer {
  analyze(event: unknown) {
    return { rootCause: 'unknown', event };
  }
}
