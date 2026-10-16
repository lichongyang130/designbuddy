export type Role = 'user' | 'admin' | 'team';

export interface Permission {
  role:Role;
  actions:string[];
}

export const permissions:Permission[]=[
  {role:'user',actions:['create-design','save-project']},
  {role:'team',actions:['share-project','invite-user']},
  {role:'admin',actions:['manage-plugin','manage-user']}
];
