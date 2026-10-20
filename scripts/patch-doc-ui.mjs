import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericDocument.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Modernize Document Template UI
content = content.replace(
  'box-shadow: 0 4px 15px rgba(0,0,0,0.1);',
  'box-shadow: 0 12px 32px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03);\n          border-radius: 4px;'
);

content = content.replace(
  'font-family: serif;',
  "font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;"
);

content = content.replace(
  'style={{ lineHeight: 1.8, color: \'#333\' }}',
  'style={{ lineHeight: 2.2, color: \'#4b5563\', fontSize: \'15px\', letterSpacing: \'0.02em\', textAlign: \'justify\' }}'
);

content = content.replace(
  '<h2>{s.titles[i]',
  '<h2 style={{ fontSize: \'32px\', fontWeight: 700, color: \'#111827\', marginBottom: \'8px\', letterSpacing: \'-0.02em\' }}>{s.titles[i]'
);

content = content.replace(
  'style={{ width: \'100%\', height: \'auto\', borderRadius: \'4px\' }}',
  'style={{ width: \'100%\', height: \'auto\', borderRadius: \'8px\', boxShadow: \'0 8px 24px rgba(0,0,0,0.08)\', margin: \'20px 0\' }}'
);

// Enhance the sidebars and workspace via injected css class
const cssInjection = `
        .report-workspace {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 0;
          height: calc(100vh - 60px);
          background: #f3f4f6;
        }
        .report-outline {
          background: #fff;
          border-right: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        .report-outline-head {
          padding: 24px;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(8px);
          z-index: 10;
        }
        .report-outline-head h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }
        .report-outline-head button {
          width: 100%;
          padding: 8px 12px;
          background: #f3f4f6;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #4b5563;
          cursor: pointer;
          transition: all 0.2s;
        }
        .report-outline-head button[aria-pressed="true"] {
          background: #111827;
          color: #fff;
        }
        .report-outline nav {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .report-outline nav button {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }
        .report-outline nav button:hover {
          background: #f9fafb;
        }
        .report-outline nav button.active {
          background: #eef2ff;
          color: #4f46e5;
        }
        .outline-page {
          font-size: 12px;
          font-weight: 600;
          color: #9ca3af;
          width: 20px;
        }
        .report-outline nav button.active .outline-page {
          color: #4f46e5;
        }
        .outline-text {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .report-desk {
          position: relative;
          overflow-y: auto;
          padding: 40px;
        }
        .report-tools {
          position: fixed;
          bottom: 32px;
          right: 32px;
          background: #fff;
          padding: 8px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          display: flex;
          gap: 8px;
          align-items: center;
          z-index: 100;
        }
        .report-tools button {
          padding: 8px 16px;
          border: none;
          background: transparent;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #4b5563;
          cursor: pointer;
        }
        .report-tools button[aria-pressed="true"] {
          background: #f3f4f6;
          color: #111827;
        }
        .report-zoom {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-left: 8px;
          border-left: 1px solid #e5e7eb;
        }
        .report-zoom span {
          font-size: 13px;
          font-weight: 600;
          width: 48px;
          text-align: center;
        }
`;

content = content.replace(
  '.generic-doc-paper {',
  cssInjection + '\n        .generic-doc-paper {'
);

fs.writeFileSync(file, content, 'utf-8');
