export class PackageManager {
  install(packages: string[]) {
    return {
      command: `npm install ${packages.join(' ')}`,
      packages
    };
  }
}
