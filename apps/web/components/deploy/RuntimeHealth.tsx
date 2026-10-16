export interface RuntimeHealthProps {
  healthy?: boolean;
  cpu?: number;
  memory?: number;
}

export function RuntimeHealth({ healthy = true, cpu = 0, memory = 0 }: RuntimeHealthProps) {
  return (
    <section>
      <span>{healthy ? 'Runtime Healthy' : 'Runtime Error'}</span>
      <div>CPU: {cpu}%</div>
      <div>Memory: {memory}%</div>
    </section>
  );
}
