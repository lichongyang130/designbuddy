export interface ApiKey {
  id: string;
  userId: string;
  provider: string;
  encryptedKey: string;
  createdAt: Date;
}
