export class IframeRenderer {
  render(html:string){
    return {
      type:'iframe',
      sandbox:true,
      content:html
    };
  }
}
