import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericMedia.tsx';
let content = fs.readFileSync(file, 'utf-8');

const cssInjection = `
      <style>{` + "\\`" + `
        .media-workspace {
          background: #0f111a;
          color: #fff;
          padding: 40px;
          border-radius: 16px;
          margin-bottom: 24px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .media-workspace header input {
          background: transparent;
          border: none;
          color: #fff;
          font-size: 32px;
          font-weight: 700;
          width: 100%;
          outline: none;
          border-bottom: 2px solid rgba(255,255,255,0.1);
          padding-bottom: 12px;
          transition: border-color 0.2s;
        }
        .media-workspace header input:focus {
          border-color: #667eea;
        }
        .media-film-stage {
          border-radius: 12px;
          overflow: hidden;
          background: #000;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .media-film-stage video {
          width: 100%;
          display: block;
        }
        .media-film-tools {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 32px;
          padding: 24px;
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .media-film-tools h3 {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #9ca3af;
          margin: 0 0 16px 0;
        }
        .media-film-timeline > div {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
          opacity: 0.5;
          transition: all 0.3s;
        }
        .media-film-timeline > div.active {
          opacity: 1;
        }
        .media-film-timeline input {
          flex: 1;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 14px;
        }
        .media-film-timeline input:focus {
          border-color: #667eea;
          outline: none;
        }
        .media-film-timeline small {
          font-family: monospace;
          color: #6b7280;
          width: 80px;
          text-align: right;
        }
        
        .media-sound-stage {
          background: rgba(0,0,0,0.3);
          border-radius: 12px;
          padding: 32px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .media-sound-stage audio {
          width: 100%;
          margin-bottom: 24px;
          filter: invert(1) hue-rotate(180deg);
        }
        .media-sound-waveform {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 120px;
        }
        .media-sound-waveform i {
          flex: 1;
          background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
          border-radius: 2px;
          transition: height 0.1s ease;
        }
        
        .media-sound-tools {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          padding: 24px;
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .media-sound-tools label {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .media-sound-tools span {
          font-size: 13px;
          font-weight: 600;
          color: #9ca3af;
        }
        .media-sound-tools input[type="range"] {
          width: 100%;
          accent-color: #667eea;
        }
        
        .media-provenance {
          background: rgba(243,244,246,0.5);
          padding: 24px;
          border-radius: 12px;
          margin-top: 32px;
        }
        .media-provenance strong {
          display: block;
          margin-bottom: 8px;
          color: #111827;
        }
        .media-provenance p {
          color: #4b5563;
          margin: 0 0 12px 0;
          line-height: 1.6;
        }
        .media-provenance small {
          color: #9ca3af;
          display: block;
        }
      ` + "\\`" + `}</style>
`;

content = content.replace(
  '</DynamicShell>',
  cssInjection + '    </DynamicShell>'
);

fs.writeFileSync(file, content, 'utf-8');
