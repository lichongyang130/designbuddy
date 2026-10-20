import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericMedia.tsx';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace('import { soundSamples, wavBlob, waveform, vtt } from "./media-utils";', 'import { soundSamples, wavBlob, waveform } from "./media-utils";');

const vttFunc = `
function formatVttTime(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return \`\${h}:\${m}:\${s}.\${ms}\`;
}

function vtt(captions) {
  return "WEBVTT\\n\\n" + captions.map(c => 
    \`\${formatVttTime(c.start)} --> \${formatVttTime(c.end)}\\n\${c.text}\\n\\n\`
  ).join("");
}
`;

content = content.replace('const captionSeed = [', vttFunc + '\nconst captionSeed = [');
fs.writeFileSync(file, content, 'utf-8');
