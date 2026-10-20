import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericPrototype.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('FakeUIRenderer')) {
  content = content.replace(
    'import { SampleTop',
    "import { FakeUIRenderer } from './FakeUIRenderer';\nimport { SampleTop"
  );
}

content = content.replace(
  '<img src={currentPhoto.url} alt="Desktop Prototype" />',
  '<FakeUIRenderer seed={seed} page={active} device="desktop" colors={colors} />'
);

content = content.replace(
  '<img src={currentPhoto.url} alt="Mobile Prototype" />',
  '<FakeUIRenderer seed={seed} page={active} device="mobile" colors={colors} />'
);

fs.writeFileSync(file, content, 'utf-8');
