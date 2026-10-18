export interface DocumentChange {
  documentId:string;
  content:string;
}

export class DocumentSync {
  apply(change:DocumentChange){
    return {
      synced:true,
      change
    };
  }
}
