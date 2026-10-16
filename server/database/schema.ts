export interface UserTable {
  id: string;
  email: string;
  passwordHash: string;
}

export interface ProjectTable {
  id: string;
  userId: string;
  name: string;
}

export interface FileTable {
  id: string;
  projectId: string;
  content: string;
}

export interface PluginTable {
  id: string;
  name: string;
}

export interface SubscriptionTable {
  id: string;
  userId: string;
  plan: string;
}
