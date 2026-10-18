export interface TenantMember {
  userId: string;
  organizationId: string;
  role: string;
}

export class MemberService {
  addMember(member: TenantMember) {
    return member;
  }

  removeMember(userId: string) {
    return { userId, removed: true };
  }
}
