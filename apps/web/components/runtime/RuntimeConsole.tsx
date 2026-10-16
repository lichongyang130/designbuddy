export function RuntimeConsole({ logs }: { logs: string[] }) {
  return <pre>{logs.join('\n')}</pre>;
}
