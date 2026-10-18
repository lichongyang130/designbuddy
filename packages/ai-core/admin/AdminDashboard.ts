export class AdminDashboard {
  getOverview() { return { status: 'ok', modules: ['users','agents','billing'] }; }
}
