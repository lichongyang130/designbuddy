export class HumanApprovalGate {
  constructor(private required = false) {}

  async approve(context: unknown) {
    if (!this.required) return true;
    return Boolean(context);
  }
}
