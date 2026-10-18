export function DeploymentApproval({ approved = false }: { approved?: boolean }) {
  return <span>{approved ? 'Approved' : 'Pending Approval'}</span>;
}
