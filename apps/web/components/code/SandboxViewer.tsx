import React from 'react';

export default function SandboxViewer({ status = 'idle' }: { status?: string }) {
  return <div className="sandbox-viewer">Sandbox: {status}</div>;
}
