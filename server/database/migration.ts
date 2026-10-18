export interface Migration {
  version: number;
  name: string;
  up(): Promise<void>;
}

const migrations: Migration[] = [];

export async function runMigrations() {
  for (const migration of migrations) {
    await migration.up();
  }
}
