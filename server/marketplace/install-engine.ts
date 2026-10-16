export class InstallEngine {
  install(assetType: string, assetId: string, userId: string) {
    return {
      assetType,
      assetId,
      userId,
      installed: true,
    };
  }
}
