import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/shared.tsx';
let content = fs.readFileSync(file, 'utf-8');
const match = /export type SampleId =[^;]+;/;
content = content.replace(match, 'export type SampleId = string;');
fs.writeFileSync(file, content, 'utf-8');
