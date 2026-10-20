import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/media-utils.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  'export function soundSamples(tempo = 72, tone = 45, gain = 65) {',
  'export function soundSamples(tempo = 72, tone = 45, gain = 65, seed = 1) {'
);

content = content.replace(
  /const rate = 22050,\s*duration = 8,\s*pcm = new Float32Array\(rate \* duration\),\s*notes = \[\s*261.6256, 329.6276, 391.9954, 523.2511, 391.9954, 329.6276, 293.6648,\s*261.6256,\s*\];/m,
  `const rate = 22050, duration = 8, pcm = new Float32Array(rate * duration);
  const baseFreqs = [
    [261.6256, 329.6276, 391.9954, 523.2511, 391.9954, 329.6276, 293.6648, 261.6256], // C Major
    [220.0000, 261.6256, 329.6276, 440.0000, 329.6276, 261.6256, 220.0000, 164.8138], // A Minor
    [293.6648, 369.9944, 440.0000, 587.3295, 440.0000, 369.9944, 329.6276, 293.6648], // D Major
    [195.9977, 246.9417, 293.6648, 391.9954, 293.6648, 246.9417, 220.0000, 195.9977], // G Major
    [329.6276, 391.9954, 493.8833, 659.2551, 493.8833, 391.9954, 349.2282, 329.6276]  // E Minor
  ];
  // select notes based on seed, and optionally shift octave
  let notes = baseFreqs[seed % baseFreqs.length];
  if (seed % 2 === 0) {
    notes = notes.map(f => f * 0.5); // lower octave
  }
  if (seed % 3 === 0) {
    notes = [...notes].reverse(); // reverse sequence
  }`
);

fs.writeFileSync(file, content, 'utf-8');
