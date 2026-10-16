export class RoomManager {
  private rooms = new Map<string, Set<string>>();

  join(roomId:string,userId:string){
    if(!this.rooms.has(roomId)) this.rooms.set(roomId,new Set());
    this.rooms.get(roomId)?.add(userId);
  }

  members(roomId:string){
    return Array.from(this.rooms.get(roomId) || []);
  }
}
