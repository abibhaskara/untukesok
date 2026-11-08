'use client';
import { useEffect } from 'react';

export default function ProgramInFeedAd() {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {
      console.warn("AdSense In-Feed error:", e);
    }
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 3',
        borderRadius: '24px',
        overflow: 'hidden',
        border: '1px solid var(--card-border)',
        background: 'var(--card-bg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700, width: '100%', textAlign: 'left' }}>
        Iklan
      </div>
      <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '100%' }}
          data-ad-format="fluid"
          data-ad-layout-key="-6t+ed+2i-1n-4w"
          data-ad-client="ca-pub-3616844824692827"
          data-ad-slot="2719840676"
        />
      </div>
    </div>
  );
}
