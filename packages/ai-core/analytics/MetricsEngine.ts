export class MetricsEngine {
  calculate(values: number[]) { return { count: values.length, total: values.reduce((a,b)=>a+b,0) }; }
}
