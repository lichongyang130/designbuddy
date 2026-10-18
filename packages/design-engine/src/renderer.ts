export function renderDesign(files:Record<string,string>){
  return {
    html: files['index.html'] || '',
    css: files['style.css'] || ''
  };
}
