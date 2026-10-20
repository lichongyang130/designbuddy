import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericDocument.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  'titles: {},',
  'titles: {} as Record<number, string>,'
);
content = content.replace(
  'bodies: {},',
  'bodies: {} as Record<number, string>,'
);
content = content.replace(
  /ref=\{\(el\) => \(papers\.current\[i\] = el\)\}/g,
  'ref={(el) => { papers.current[i] = el; }}'
);

fs.writeFileSync(file, content, 'utf-8');
