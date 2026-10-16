import { ExportResult } from './html-export';

export function exportImage(html:string):ExportResult {
  return {
    fileName:"design.png",
    content:`Image snapshot generated\n${html}`
  };
}
