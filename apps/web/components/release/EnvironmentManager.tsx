export function EnvironmentManager({ environments = [] }: { environments?: string[] }) {
  return <ul>{environments.map(env => <li key={env}>{env}</li>)}</ul>;
}
