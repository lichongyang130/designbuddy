export function ToolCallStream({ calls }: { calls: string[] }) {
  return <ul>{calls.map((call) => <li key={call}>{call}</li>)}</ul>;
}
