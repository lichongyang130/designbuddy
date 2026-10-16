export interface PresenceState {
  userId:string;
  online:boolean;
}

export class PresenceService {
  private users = new Map<string,boolean>();

  update(state:PresenceState){
    this.users.set(state.userId,state.online);
  }

  status(userId:string){
    return this.users.get(userId) || false;
  }
}
