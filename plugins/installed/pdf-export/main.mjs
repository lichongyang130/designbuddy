import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

async function run() {
  const args = JSON.parse(process.argv[2] || '{}');
  const filename = args.outputFilename || 'export.pdf';
  const workspaceDir = process.env.WORKSPACE_DIR || process.cwd();
  
  console.log("Initializing PDF engine...");
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([800, 600]);
  
  page.drawText('DesignBuddy - Native PDF Export', {
    x: 50,
    y: 500,
    size: 30,
    color: rgb(0, 0.53, 0.71),
  });
  
  const pdfBytes = await pdfDoc.save();
  const outPath = path.join(workspaceDir, filename);
  await fs.writeFile(outPath, pdfBytes);
  console.log("Successfully exported to", outPath);
}

run().catch(console.error);
