import fs from 'fs';
const file = 'apps/web/src/inspiration/InspirationPage.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('GenericSlide')) {
  content = content.replace(
    "import { GenericDocument } from './samples/GenericDocument';",
    "import { GenericDocument } from './samples/GenericDocument';\nimport { GenericSlide } from './samples/GenericSlide';"
  );
}

content = content.replace(
  'if (sample.category === "文档") {',
  `if (sample.category === "幻灯片") {
        return <GenericSlide draftId={props.draftId} sample={sample} />;
      }
      if (sample.category === "文档") {`
);

fs.writeFileSync(file, content, 'utf-8');
