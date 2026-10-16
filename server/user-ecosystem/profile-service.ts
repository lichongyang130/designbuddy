export interface UserProfile {
  id:string;
  name:string;
  avatar?:string;
}

export class ProfileService {
  get(id:string):UserProfile {
    return {id,name:'New User'};
  }
}
