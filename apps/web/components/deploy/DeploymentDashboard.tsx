import React from 'react';

export interface DeploymentStatus {
  id: string;
  environment: string;
  status: 'pending' | 'building' | 'running' | 'failed';
}

export function DeploymentDashboard({ deployments = [] }: { deployments?: DeploymentStatus[] }) {
  return <section>{deployments.map(item => <div key={item.id}>{item.environment}: {item.status}</div>)}</section>;
}
