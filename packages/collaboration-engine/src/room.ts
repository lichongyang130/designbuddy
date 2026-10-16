export interface CollaborationRoom {
  id: string;
  projectId: string;
  members: string[];
}

export class RoomManager {
  private rooms: CollaborationRoom[] = [];

  create(projectId: string) {
    const room = {
      id: crypto.randomUUID(),
      projectId,
      members: []
    };

    this.rooms.push(room);
    return room;
  }
}
