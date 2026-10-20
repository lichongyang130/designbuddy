import { useMemo } from 'react';

export function FakeUIRenderer({ seed, page, device, colors }: { seed: number, page: number, device: string, colors: string[] }) {
  const primary = colors[0];
  const secondary = colors[1];
  const bg = '#f1f5f9';
  const surface = '#ffffff';
  const text = colors[3];
  const textLight = '#94a3b8';
  const border = '#e2e8f0';

  const domain = Math.floor((seed - 1) / 5) % 6; // 0: SaaS, 1: Ecom, 2: Finance, 3: AI, 4: Edu, 5: Booking
  const layout = page % 3; 
  const isMobile = device === 'mobile';

  const TopNav = () => (
    <div style={{ height: '60px', background: surface, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ width: '32px', height: '32px', background: primary, borderRadius: '8px' }}></div>
        {!isMobile && <div style={{ width: '120px', height: '16px', background: text, borderRadius: '4px' }}></div>}
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        {!isMobile && [1,2,3].map(i => <div key={i} style={{ width: '60px', height: '16px', background: border, borderRadius: '4px' }}></div>)}
        <div style={{ width: '32px', height: '32px', background: '#cbd5e1', borderRadius: '50%' }}></div>
      </div>
    </div>
  );

  const Sidebar = () => (
    <div style={{ width: '240px', background: surface, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', padding: '24px', gap: '20px', flexShrink: 0 }}>
      <div style={{ width: '100%', height: '36px', background: primary, opacity: 0.1, borderRadius: '8px', marginBottom: '8px' }}></div>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ width: '16px', height: '16px', background: i === 1 ? primary : '#cbd5e1', borderRadius: '4px' }}></div>
          <div style={{ width: '70%', height: '14px', background: i === 1 ? text : textLight, borderRadius: '4px' }}></div>
        </div>
      ))}
    </div>
  );

  const renderSaaS = () => (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
        <div style={{ width: '200px', height: '28px', background: text, borderRadius: '6px' }}></div>
        {layout === 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '16px' }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ background: surface, padding: '20px', borderRadius: '12px', border: `1px solid ${border}` }}>
                  <div style={{ width: '40%', height: '14px', background: textLight, borderRadius: '4px', marginBottom: '16px' }}></div>
                  <div style={{ width: '80%', height: '32px', background: text, borderRadius: '6px' }}></div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, background: surface, borderRadius: '12px', border: `1px solid ${border}`, padding: '24px' }}>
              <div style={{ width: '150px', height: '20px', background: text, borderRadius: '4px', marginBottom: '24px' }}></div>
              <div style={{ height: '200px', borderBottom: `2px solid ${border}`, display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
                {[40, 70, 45, 90, 60, 85, 55, 75, 50, 100].map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 7 ? primary : border, borderRadius: '4px 4px 0 0' }}></div>
                ))}
              </div>
            </div>
          </>
        )}
        {layout === 1 && (
          <div style={{ flex: 1, background: surface, borderRadius: '12px', border: `1px solid ${border}`, padding: '0' }}>
            <div style={{ padding: '20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ width: '200px', height: '36px', background: bg, borderRadius: '6px' }}></div>
              <div style={{ width: '100px', height: '36px', background: primary, borderRadius: '6px' }}></div>
            </div>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${border}`, gap: '16px' }}>
                <div style={{ width: '20px', height: '20px', border: `2px solid ${border}`, borderRadius: '4px' }}></div>
                <div style={{ flex: 1, height: '16px', background: text, borderRadius: '4px' }}></div>
                {!isMobile && <div style={{ flex: 1, height: '16px', background: textLight, borderRadius: '4px' }}></div>}
                {!isMobile && <div style={{ flex: 1, height: '16px', background: textLight, borderRadius: '4px' }}></div>}
                <div style={{ width: '60px', height: '28px', background: bg, borderRadius: '14px' }}></div>
              </div>
            ))}
          </div>
        )}
        {layout === 2 && (
          <div style={{ background: surface, borderRadius: '12px', border: `1px solid ${border}`, padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ width: '100%', height: '16px', background: textLight, borderRadius: '4px' }}></div>
            <div style={{ width: '100%', height: '48px', border: `1px solid ${border}`, borderRadius: '8px' }}></div>
            <div style={{ width: '100%', height: '16px', background: textLight, borderRadius: '4px' }}></div>
            <div style={{ width: '100%', height: '120px', border: `1px solid ${border}`, borderRadius: '8px' }}></div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
              <div style={{ width: '120px', height: '44px', background: primary, borderRadius: '8px' }}></div>
              <div style={{ width: '120px', height: '44px', background: bg, borderRadius: '8px' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderEcom = () => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
      <div style={{ width: '100%', height: isMobile ? '200px' : '400px', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '60%', height: '40px', background: 'rgba(255,255,255,0.9)', borderRadius: '8px' }}></div>
      </div>
      <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '24px' }}>
        {[1,2,3,4,5,6,7,8].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '100%', aspectRatio: '1', background: '#cbd5e1', borderRadius: '12px' }}></div>
            <div style={{ width: '80%', height: '16px', background: text, borderRadius: '4px' }}></div>
            <div style={{ width: '40%', height: '16px', background: primary, borderRadius: '4px' }}></div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAI = () => (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: surface }}>
        <div style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px', alignSelf: 'flex-end', width: '70%' }}>
                <div style={{ flex: 1, background: primary, padding: '16px', borderRadius: '16px 16px 0 16px', height: '60px' }}></div>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: text }}></div>
              </div>
              <div style={{ display: 'flex', gap: '16px', width: '80%' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: secondary }}></div>
                <div style={{ flex: 1, background: bg, padding: '16px', borderRadius: '16px 16px 16px 0', minHeight: '120px', border: `1px solid ${border}` }}></div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '24px', borderTop: `1px solid ${border}` }}>
          <div style={{ width: '100%', height: '60px', background: bg, border: `1px solid ${border}`, borderRadius: '30px', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
            <div style={{ width: '40%', height: '16px', background: textLight, borderRadius: '4px' }}></div>
            <div style={{ width: '40px', height: '40px', background: primary, borderRadius: '20px' }}></div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDefault = () => (
    <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ width: '100%', height: '300px', background: surface, borderRadius: '16px', border: `1px solid ${border}` }}></div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: '160px', background: surface, borderRadius: '16px', border: `1px solid ${border}` }}></div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%', background: bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      <TopNav />
      {domain === 0 ? renderSaaS() :
       domain === 1 ? renderEcom() :
       domain === 3 ? renderAI() :
       renderDefault()}
    </div>
  );
}
