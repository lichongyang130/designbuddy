export class VersionResolver {
  compatible(current: string, required: string) {
    return current.split('.')[0] === required.replace('^', '').split('.')[0];
  }

  resolve(versions: string[], requirement: string) {
    return versions.find(v => this.compatible(v, requirement));
  }
}
