export interface Conflict {
  local: unknown;
  remote: unknown;
}

export class ConflictResolver {
  resolve(conflict: Conflict) {
    return conflict.remote;
  }
}
