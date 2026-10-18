export class SREAgent {
  handleIncident(incident: unknown) {
    return { status: 'analyzing', incident };
  }
}
