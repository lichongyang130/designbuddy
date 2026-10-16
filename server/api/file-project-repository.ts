import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ApiProject, ProjectRepository } from "./http-handler";

interface StoredRecord {
  ownerId: string;
  project: ApiProject;
}

export class FileProjectRepository implements ProjectRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath = process.env.DESIGNBUDDY_PROJECT_STORE_PATH || "./data/projects.json"
  ) {}

  private async readAll(): Promise<StoredRecord[]> {
    try {
      const raw = await readFile(resolve(this.filePath), "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Project store file has an invalid structure.");
      return parsed.filter((entry): entry is StoredRecord =>
        Boolean(entry && typeof entry === "object" &&
          "ownerId" in entry && typeof entry.ownerId === "string" &&
          "project" in entry && entry.project && typeof entry.project === "object" &&
          typeof (entry.project as ApiProject).id === "string")
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async updateAll<T>(operation: (records: StoredRecord[]) => T): Promise<T> {
    let release!: () => void;
    const previous = this.writeQueue;
    this.writeQueue = new Promise<void>((resolveQueue) => { release = resolveQueue; });
    await previous;
    try {
      const records = await this.readAll();
      const result = operation(records);
      const destination = resolve(this.filePath);
      await mkdir(dirname(destination), { recursive: true });
      const temporary = destination + "." + process.pid + ".tmp";
      await writeFile(temporary, JSON.stringify(records, null, 2), "utf8");
      await rename(temporary, destination);
      return result;
    } finally {
      release();
    }
  }

  async listByOwner(ownerId: string): Promise<ApiProject[]> {
    return (await this.readAll())
      .filter((record) => record.ownerId === ownerId)
      .map((record) => structuredClone(record.project))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getById(ownerId: string, projectId: string): Promise<ApiProject | null> {
    const record = (await this.readAll()).find((item) => item.ownerId === ownerId && item.project.id === projectId);
    return record ? structuredClone(record.project) : null;
  }

  async save(ownerId: string, project: ApiProject): Promise<ApiProject> {
    return this.updateAll((records) => {
      const index = records.findIndex((item) => item.ownerId === ownerId && item.project.id === project.id);
      const saved = { ...structuredClone(project), updatedAt: new Date().toISOString() };
      if (index >= 0) records[index] = { ownerId, project: saved };
      else {
        if (records.some((item) => item.project.id === project.id && item.ownerId !== ownerId)) {
          throw new Error("Project id is already in use.");
        }
        records.push({ ownerId, project: saved });
      }
      return structuredClone(saved);
    });
  }

  async delete(ownerId: string, projectId: string): Promise<boolean> {
    return this.updateAll((records) => {
      const index = records.findIndex((item) => item.ownerId === ownerId && item.project.id === projectId);
      if (index < 0) return false;
      records.splice(index, 1);
      return true;
    });
  }
}
