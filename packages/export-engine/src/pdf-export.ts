import { ExportResult } from './html-export';

export function exportPDF(html:string):ExportResult {
  return {
    fileName:"design.pdf",
    content:`PDF generated from HTML\n${html}`
  };
}
