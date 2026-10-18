import React from 'react';

export default function ExecutionTimeline({ steps = [] }: { steps?: string[] }) {
  return <ul>{steps.map((step, i) => <li key={i}>{step}</li>)}</ul>;
}
