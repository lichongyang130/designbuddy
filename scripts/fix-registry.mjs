import fs from 'fs';
const inspFile = 'apps/web/src/inspiration/InspirationPage.tsx';
let inspContent = fs.readFileSync(inspFile, 'utf-8');

inspContent = inspContent.replace(
  `import { commercialViewers } from '../commercialRegistry';`,
  `import { commercialViewers } from './commercialRegistry';`
);

fs.writeFileSync(inspFile, inspContent, 'utf-8');
