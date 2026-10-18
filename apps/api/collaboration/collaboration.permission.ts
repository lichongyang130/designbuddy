export type CollaborationPermission =
  | 'workspace:sync'
  | 'workspace:presence'
  | 'workspace:edit';

export function canCollaborate(
  permission: CollaborationPermission,
  required: CollaborationPermission,
) {
  return permission === required;
}
