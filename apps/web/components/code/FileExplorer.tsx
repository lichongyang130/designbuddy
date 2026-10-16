import React from 'react';

export default function FileExplorer({ files = [] }: { files?: string[] }) {
  return <div>{files.map(file => <div key={file}>{file}</div>)}</div>;
}
