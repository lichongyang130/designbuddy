export interface DesignRequest {
  prompt: string;
  framework?: 'html' | 'react';
}

export interface GeneratedDesign {
  files: Record<string,string>;
}

export class DesignGenerator {

  generate(request: DesignRequest): GeneratedDesign {
    return {
      files: {
        'index.html': this.createHtml(request.prompt),
        'style.css': this.createCss()
      }
    };
  }

  private createHtml(prompt:string){
    return `<!doctype html>
<html>
<head>
<title>${prompt}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div id="app">
<h1>${prompt}</h1>
</div>
</body>
</html>`;
  }

  private createCss(){
    return `body{
font-family:Arial,sans-serif;
margin:40px;
}`;
  }
}
