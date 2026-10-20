import fs from 'fs';
const file = 'apps/web/src/inspiration/InspirationPage.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('GenericPrototype')) {
  content = content.replace(
    "import { GenericDocument } from './samples/GenericDocument';",
    "import { GenericDocument } from './samples/GenericDocument';\nimport { GenericPrototype } from './samples/GenericPrototype';"
  );
}

content = content.replace(
  'if (sample.category === "幻灯片") {',
  `if (sample.category === "原型") {
        return <GenericPrototype draftId={props.draftId} sample={sample} />;
      }
      if (sample.category === "幻灯片") {`
);

fs.writeFileSync(file, content, 'utf-8');
