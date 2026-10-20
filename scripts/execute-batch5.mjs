import fs from 'fs';
import path from 'path';

const commDir = 'apps/web/src/inspiration/samples/commercial';
const files = fs.readdirSync(commDir).filter(f => f.endsWith('.tsx'));

let updated = 0;

for (const file of files) {
  if (file === 'Proto1Gen.tsx') continue; // Already manually wired for PDF export
  
  const filePath = path.join(commDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // We are going to wire up the Figma bridge for all other components.
  // 1. Add handleExport function
  if (!content.includes('const handleExport')) {
    const handleExportLogic = `
  const handleExport = () => {
    fetch('http://' + window.location.hostname + ':4124/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'figma-bridge', args: { fileUrl: 'https://figma.com/file/mock' } })
    }).then(r => r.json()).then(res => {
      if (res.status === 'ok') {
        alert("Figma 同步成功，抽取了 Design Tokens：\\n" + res.output);
      } else {
        alert("Figma 同步失败：" + res.error);
      }
    }).catch(e => alert("网络错误：" + e.message));
  };
`;
    content = content.replace(
      'const handleRemix = () => {', 
      handleExportLogic + '\n  const handleRemix = () => {'
    );
  }

  // 2. Replace the alert in the button
  content = content.replace(
    /onClick=\{\(\) => alert\("OS MCP Daemon received Export Command!"\)\}/g,
    'onClick={handleExport}'
  );
  content = content.replace(
    /onClick=\{\(\) => alert\("Export triggered to MCP OS Daemon!"\)\}/g,
    'onClick={handleExport}'
  );
  
  // 3. Rename button text to signify Figma Integration
  content = content.replace(
    />导出到代码 \/ Figma \(Export\)</g,
    '>双向同步 Figma (Figma Bridge)<'
  );
  content = content.replace(
    />导出资产 \(Export\)</g,
    '>双向同步 Figma (Figma Bridge)<'
  );

  fs.writeFileSync(filePath, content, 'utf-8');
  updated++;
}

console.log(`Successfully wired up Figma Bridge to ${updated} commercial components.`);
