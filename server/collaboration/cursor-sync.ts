export interface CursorPosition {
  userId:string;
  x:number;
  y:number;
}

export class CursorSync {
  sync(position:CursorPosition){
    return position;
  }
}
