import type { ProjectRepository } from "./http-handler";
import { FileProjectRepository } from "./file-project-repository";
import { SQLiteProjectRepository } from "./sqlite-project-repository";
import { SQLiteCollaborationEventStore } from "../collaboration/sqlite-event-store";
import { SQLiteProjectMembershipStore } from "./project-memberships";

/** Repository factory used by local daemon and server entrypoints. */
export function createProjectRepository(): ProjectRepository {
  const backend = process.env.DESIGNBUDDY_STORAGE ?? "sqlite";
  if (backend === "sqlite") return new SQLiteProjectRepository();
  if (backend === "file") return new FileProjectRepository();
  throw new Error(`Unsupported DESIGNBUDDY_STORAGE backend: ${backend}`);
}

export function createLocalPersistence() {
  const projects = createProjectRepository();
  const collaborationStore = process.env.DESIGNBUDDY_STORAGE === "file" ? undefined : new SQLiteCollaborationEventStore();
  const memberships = process.env.DESIGNBUDDY_STORAGE === "file" ? undefined : new SQLiteProjectMembershipStore();
  return { projects, collaborationStore, memberships };
}
