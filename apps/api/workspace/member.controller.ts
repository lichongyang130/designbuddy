export class MemberController {
  addMember(workspaceId: string, userId: string, role: string) {
    return {
      workspaceId,
      userId,
      role,
    };
  }

  removeMember(workspaceId: string, userId: string) {
    return {
      workspaceId,
      userId,
      removed: true,
    };
  }
}
