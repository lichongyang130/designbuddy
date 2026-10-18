export class Sandbox {
  sanitize(html:string){
    return html
      .replace(/<script.*?>.*?<\/script>/gis,'');
  }
}
