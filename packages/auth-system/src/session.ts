export interface Session {
  id:string;
  userId:string;
  token:string;
  expiresAt:Date;
}

export function createSession(userId:string):Session {
  return {
    id:crypto.randomUUID(),
    userId,
    token:crypto.randomUUID(),
    expiresAt:new Date(Date.now()+86400000)
  };
}
