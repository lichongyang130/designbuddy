export function RollbackManager({ enabled = true }: { enabled?: boolean }) {
  return <button disabled={!enabled}>Rollback</button>;
}
