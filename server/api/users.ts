export interface UserDTO {
  id: string;
  name: string;
  email: string;
  plan: string;
}

const users: UserDTO[] = [];

export function createUser(user: UserDTO) {
  users.push(user);
  return user;
}

export function getUser(id: string) {
  return users.find((user) => user.id === id) ?? null;
}

export function listUsers() {
  return users;
}
