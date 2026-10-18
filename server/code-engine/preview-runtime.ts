export class PreviewRuntime {
  render(compiledCode:unknown) {
    return {
      preview:true,
      component:compiledCode
    };
  }
}
