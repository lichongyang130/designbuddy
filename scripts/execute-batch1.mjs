import fs from 'fs';
import path from 'path';

const sharedFile = 'apps/web/src/inspiration/samples/shared.tsx';
const sharedContent = fs.readFileSync(sharedFile, 'utf-8');

const idRegex = /id:\s*"([^"]+-gen)"/g;
let match;
const ids = [];
while ((match = idRegex.exec(sharedContent)) !== null) {
  ids.push(match[1]);
}

const commDir = 'apps/web/src/inspiration/samples/commercial';
if (!fs.existsSync(commDir)) {
  fs.mkdirSync(commDir, { recursive: true });
}

const toPascal = (str) => str.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');

const lazyImports = [];

ids.forEach(id => {
  const compName = toPascal(id);
  const filePath = path.join(commDir, `${compName}.tsx`);
  
  if (id !== 'proto-1-gen') {
    if (!fs.existsSync(filePath)) {
      const tpl = `import React from 'react';
import { SampleTop } from "../shared";

export default function ${compName}({ draftId, sample }: { draftId?: string; sample: any }) {
  return (
    <main className="sample-view proto-view" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <SampleTop type="商业级独立组件" title={sample.title} draftId={draftId} onCopy={() => {}}>
        <div className="proto-top-actions"></div>
      </SampleTop>
      <div style={{ padding: 40, background: '#f8fafc', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
           <h2 style={{ fontSize: 24, marginBottom: 16 }}>WIP: {sample.title}</h2>
           <p style={{ color: '#64748b' }}>1 Case = 1 Component. Scheduled for Phase 3 construction.</p>
        </div>
      </div>
    </main>
  );
}
`;
      fs.writeFileSync(filePath, tpl, 'utf-8');
    }
  }
  lazyImports.push(`  "${id}": lazy(() => import('./samples/commercial/${compName}'))`);
});

const registryPath = 'apps/web/src/inspiration/commercialRegistry.ts';
const registryContent = `import { lazy } from 'react';\n\nexport const commercialViewers: Record<string, any> = {\n${lazyImports.join(',\n')}\n};\n`;
fs.writeFileSync(registryPath, registryContent, 'utf-8');

// Patch InspirationPage
const inspFile = 'apps/web/src/inspiration/InspirationPage.tsx';
let inspContent = fs.readFileSync(inspFile, 'utf-8');
if (!inspContent.includes('commercialViewers')) {
  inspContent = inspContent.replace(
    `import { drafts, samples, type SampleId, type DraftRecord } from './samples/shared';`,
    `import { drafts, samples, type SampleId, type DraftRecord } from './samples/shared';\nimport { commercialViewers } from '../commercialRegistry';`
  );
  
  inspContent = inspContent.replace(
    `viewers[sample.id] || ((props: any) => {`,
    `viewers[sample.id] || commercialViewers[sample.id] || ((props: any) => {`
  );
  fs.writeFileSync(inspFile, inspContent, 'utf-8');
}

console.log(`Successfully generated ${ids.length} commercial component references.`);
