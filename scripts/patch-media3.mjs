import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericMedia.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Update GenericFilm to use Google sample videos
const filmBlock = `const googleVideos = [
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
];

export function GenericFilm({ draftId, sample }: { draftId?: string; sample: any }) {
  const seed = parseInt(sample.id.split('-')[1]) || 1;
  const vidUrl = googleVideos[seed % googleVideos.length];
`;

content = content.replace(
  /export function GenericFilm\(\{ draftId, sample \}: \{ draftId\?: string; sample: any \}\) \{\s*const seed = parseInt\(sample\.id\.split\('-'\)\[1\]\) \|\| 1;\s*const startTime = \(seed \* 3\.7\) % 15;\s*const hue = \(seed \* 65\) % 360;\s*const filterStyle = `hue-rotate\(\$\{hue\}deg\)`;/,
  filmBlock
);

content = content.replace(
  /src=\{\`\$\{filmUrl\}#t=\$\{startTime\}\`\}/g,
  'src={vidUrl}'
);

content = content.replace(
  /style=\{\{ filter: filterStyle \}\}/g,
  ''
);

content = content.replace(
  /const response = await fetch\(filmUrl\);/g,
  'const response = await fetch(vidUrl);'
);

// Update GenericSound to pass seed
content = content.replace(
  /const pcm = useMemo\(\s*\(\) => soundSamples\(state\.tempo, state\.tone, state\.gain\),/m,
  'const pcm = useMemo(\n      () => soundSamples(state.tempo, state.tone, state.gain, seed),'
);
content = content.replace(
  /\[state\.tempo, state\.tone, state\.gain\]/g,
  '[state.tempo, state.tone, state.gain, seed]'
);

fs.writeFileSync(file, content, 'utf-8');
