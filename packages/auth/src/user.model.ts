export interface UserModel {
  id: string;
  email: string;
  displayName?: string;
  passwordHash?: string;
  roles: string[];
  createdAt: Date;
}

export function createUserModel(input: Partial<UserModel>): UserModel {
  return {
    id: input.id ?? crypto.randomUUID(),
    email: input.email ?? '',
    displayName: input.displayName,
    passwordHash: input.passwordHash,
    roles: input.roles ?? ['user'],
    createdAt: input.createdAt ?? new Date()
  };
}
