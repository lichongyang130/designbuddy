export interface DesignToken {
  name:string;
  value:string;
}

export class DesignTokenSync {
  sync(tokens:DesignToken[]){
    return tokens.map(token=>({
      ...token,
      synced:true
    }));
  }
}
