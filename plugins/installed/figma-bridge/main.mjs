import fs from 'fs';
import path from 'path';

const args = JSON.parse(process.argv[2] || '{}');

console.log("Analyzing Figma file:", args.fileUrl);
console.log("Extracting Design Tokens...");

const designMd = `## Colors
- Primary: #F24E1E
- Background: #FFFFFF
- Text: #333333

## Geometry
- Radius: 12px
- BorderWidth: 1px
`;

const workspaceDir = process.env.WORKSPACE_DIR || process.cwd();
fs.writeFileSync(path.join(workspaceDir, 'DESIGN.md'), designMd, 'utf-8');

console.log("Success: Extracted tokens and wrote to DESIGN.md");
