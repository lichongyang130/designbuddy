export interface Version {
  id:string;
  projectId:string;
  message:string;
  createdAt:Date;
}

export function createVersion(projectId:string,message:string):Version{
 return {
  id:crypto.randomUUID(),
  projectId,
  message,
  createdAt:new Date()
 };
}
