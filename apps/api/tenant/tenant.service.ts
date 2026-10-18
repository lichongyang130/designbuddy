import { OrganizationModel } from './organization.model';

export class TenantService {
  createOrganization(data: OrganizationModel) {
    return data;
  }

  getOrganization(id: string) {
    return { id };
  }
}
