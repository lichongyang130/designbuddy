export class VersionManager {
  createVersion(assetId: string, version: string) {
    return { assetId, version, createdAt: new Date().toISOString() };
  }
}
