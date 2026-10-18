export interface ExportResult {
  fileName: string;
  content: string;
}

export function exportHTML(html: string): ExportResult {
  return {
    fileName: "design.html",
    content: html
  };
}
