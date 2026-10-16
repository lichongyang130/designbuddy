export interface PreviewEnvironmentProps {
  url?: string;
  status?: 'starting' | 'ready' | 'failed';
}

export function PreviewEnvironment({ url, status = 'starting' }: PreviewEnvironmentProps) {
  return (
    <section>
      <h3>Preview Environment</h3>
      <p>Status: {status}</p>
      {url ? <a href={url}>{url}</a> : <span>No preview available</span>}
    </section>
  );
}
