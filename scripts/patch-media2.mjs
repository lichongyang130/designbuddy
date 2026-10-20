import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericMedia.tsx';
let content = fs.readFileSync(file, 'utf-8');

// For GenericFilm
content = content.replace(
  'export function GenericFilm({ draftId, sample }: { draftId?: string; sample: any }) {',
  `export function GenericFilm({ draftId, sample }: { draftId?: string; sample: any }) {
  const seed = parseInt(sample.id.split('-')[1]) || 1;
  const startTime = (seed * 3.7) % 15;
  const hue = (seed * 65) % 360;
  const filterStyle = \`hue-rotate(\${hue}deg)\`;
`
);

content = content.replace(
  'src={filmUrl}',
  'src={`${filmUrl}#t=${startTime}`}\n            style={{ filter: filterStyle }}'
);


// For GenericSound
content = content.replace(
  'export function GenericSound({ draftId, sample }: { draftId?: string; sample: any }) {',
  `export function GenericSound({ draftId, sample }: { draftId?: string; sample: any }) {
  const seed = parseInt(sample.id.split('-')[1]) || 1;
  const initialTempo = 40 + (seed * 23) % 100;
  const initialTone = 20 + (seed * 37) % 80;
  const initialGain = 40 + (seed * 17) % 60;
`
);

content = content.replace(
  /tempo: 72,\s*tone: 45,\s*gain: 65,/,
  'tempo: initialTempo,\n    tone: initialTone,\n    gain: initialGain,'
);

fs.writeFileSync(file, content, 'utf-8');
