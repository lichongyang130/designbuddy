export interface BuildStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
}

export function BuildPipeline({ steps = [] }: { steps?: BuildStep[] }) {
  return (
    <ol>
      {steps.map(step => (
        <li key={step.name}>
          {step.name}: {step.status}
        </li>
      ))}
    </ol>
  );
}
