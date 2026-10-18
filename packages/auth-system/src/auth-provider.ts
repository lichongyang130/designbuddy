export interface AuthProvider {
  login(identifier:string,password:string):Promise<boolean>;
  logout(sessionId:string):Promise<void>;
}

export class LocalAuthProvider implements AuthProvider {
  async login(identifier:string,password:string){
    return Boolean(identifier && password);
  }

  async logout(sessionId:string){
    return;
  }
}
