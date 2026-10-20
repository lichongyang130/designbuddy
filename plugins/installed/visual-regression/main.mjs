import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function run() {
  const args = JSON.parse(process.argv[2] || '{}');
  const workspaceDir = process.env.WORKSPACE_DIR || process.cwd();
  
  const img1Path = path.join(workspaceDir, args.imagePath1);
  const img2Path = path.join(workspaceDir, args.imagePath2);
  const diffPath = path.join(workspaceDir, args.diffOutputPath);
  
  if (!fs.existsSync(img1Path) || !fs.existsSync(img2Path)) {
    console.error("Input images do not exist.");
    process.exit(1);
  }
  
  console.log("Analyzing visual regressions...");
  // Using sharp to composite diff (simplified subtract)
  await sharp(img1Path)
    .composite([{ input: img2Path, blend: 'difference' }])
    .toFile(diffPath);
    
  console.log(`Visual diff generated at ${args.diffOutputPath}`);
}

run().catch(console.error);
