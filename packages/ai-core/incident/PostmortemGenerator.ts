export class PostmortemGenerator {
  generate(incident: unknown) {
    return { title: 'Incident Report', incident };
  }
}
