import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericMedia.tsx';
let content = fs.readFileSync(file, 'utf-8');

// The issue is likely caused by the dynamic CSS injection missing the correct backticks in the JSX syntax
// Find where we injected \`}</style>
content = content.replace(/\\`\}\<\/style>/g, '\`}</style>');
content = content.replace(/<style>\{`/g, '<style>{\`');

fs.writeFileSync(file, content, 'utf-8');
