import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericTemplate.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Upgrade the visual presentation of generic UI
content = content.replace(
  'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);',
  'background: linear-gradient(135deg, #0f111a 0%, #1e1b4b 100%);\n          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3);'
);

content = content.replace(
  '.generic-template-hero h2 {',
  '.generic-template-hero h2 {\n          font-weight: 800;\n          letter-spacing: -0.02em;'
);

content = content.replace(
  '.generic-template-hero p {',
  '.generic-template-hero p {\n          color: #9ca3af;'
);

content = content.replace(
  '.thumbnail {',
  '.thumbnail {\n          aspect-ratio: 4/3;'
);

content = content.replace(
  '.thumbnail img {',
  '.thumbnail img {\n          height: 100%;\n          object-fit: cover;'
);

content = content.replace(
  '.generic-template-info {',
  '.generic-template-info {\n          border-left: 4px solid #4f46e5;'
);

fs.writeFileSync(file, content, 'utf-8');
