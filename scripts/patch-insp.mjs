import fs from 'fs';
const file = 'apps/web/src/inspiration/InspirationPage.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Insert import if not exists
if (!content.includes('GenericDocument')) {
  content = content.replace(
    "import { GenericFilm, GenericSound } from './samples/GenericMedia';",
    "import { GenericFilm, GenericSound } from './samples/GenericMedia';\nimport { GenericDocument } from './samples/GenericDocument';"
  );
}

// Update ViewerComponent fallback
content = content.replace(
  'if (sample.category === "音频") {',
  `if (sample.category === "文档") {
        return <GenericDocument draftId={props.draftId} sample={sample} />;
      }
      if (sample.category === "音频") {`
);

fs.writeFileSync(file, content, 'utf-8');
