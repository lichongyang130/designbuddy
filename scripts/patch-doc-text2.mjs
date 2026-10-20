import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericDocument.tsx';
let content = fs.readFileSync(file, 'utf-8');

// There is a missing title render block in the replacement. Let's fix the JSX structure.
// The regex accidentally swallowed the Title input and image render block.

const correctJSX = `                      <div className="paper-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {editing ? (
                          <input 
                            value={s.titles[i] || \`章节 \${i + 1}: \${photo.label}\`}
                            onChange={(e) => set((prev) => ({ ...prev, titles: { ...prev.titles, [i]: e.target.value }}))}
                            style={{ fontSize: '24px', fontWeight: 'bold', width: '100%', border: 'none', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}
                          />
                        ) : (
                          <h2 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '8px', letterSpacing: '-0.02em' }}>{s.titles[i] || \`章节 \${i + 1}: \${photo.label}\`}</h2>
                        )}
                        <img src={photo.url} alt={photo.label} style={{ width: '100%', height: 'auto', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', margin: '20px 0' }} />
                        <div style={{ flex: 1 }}>
                          {editing ? (
                            <textarea 
                              value={s.bodies[i] || generatePlaceholderText(sample.id, i).join('\\n\\n')}
                              onChange={(e) => set((prev) => ({ ...prev, bodies: { ...prev.bodies, [i]: e.target.value }}))}
                              style={{ width: '100%', minHeight: '300px', border: '1px solid #ddd', borderRadius: '4px', padding: '12px', fontSize: '15px', lineHeight: 1.8, fontFamily: 'inherit' }}
                            />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', lineHeight: 2.2, color: '#4b5563', fontSize: '15px', letterSpacing: '0.02em', textAlign: 'justify' }}>
                              {(s.bodies[i] || generatePlaceholderText(sample.id, i).join('\\n\\n')).split('\\n\\n').map((paragraph: string, pIndex: number) => (
                                <p key={pIndex}>{paragraph}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>`;

const regex = /<div className="paper-content" style=\{\{ display: 'flex', flexDirection: 'column', gap: '20px' \}\}>[\s\S]*?<\/div>\s*<\/div>/;
content = content.replace(regex, correctJSX);

fs.writeFileSync(file, content, 'utf-8');
