import { ExportResult } from './html-export';

export function exportPPTX(content:string):ExportResult {
  return {
    fileName:"design.pptx",
    content:`PPTX generated\n${content}`
  };
}
