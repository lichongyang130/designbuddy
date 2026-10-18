import React from 'react';

export default function TerminalConsole({ logs = [] }: { logs?: string[] }) {
  return <div className="terminal-console"><pre>{logs.join('\n')}</pre></div>;
}
