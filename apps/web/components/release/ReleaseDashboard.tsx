export function ReleaseDashboard({ version }: { version?: string }) {
  return <section>Release Dashboard: {version ?? 'No release'}</section>;
}
