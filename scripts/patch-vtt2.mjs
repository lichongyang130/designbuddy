import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericMedia.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace('function formatVttTime(seconds) {', 'function formatVttTime(seconds: number) {');
content = content.replace('function vtt(captions) {', 'function vtt(captions: Array<{start: number, end: number, text: string}>) {');
content = content.replace('captions.map(c =>', 'captions.map((c: any) =>');

fs.writeFileSync(file, content, 'utf-8');
