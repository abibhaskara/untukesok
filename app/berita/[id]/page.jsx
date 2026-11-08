'use client';
export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCachedNewsDetail } from '../../../src/lib/dataService';
import { FiArrowLeft, FiCalendar } from 'react-icons/fi';
import { motion } from 'framer-motion';
import InstagramCarousel from '../../../src/components/InstagramCarousel';

export default function NewsDetail() {
  const router = useRouter();
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const data = await getCachedNewsDetail(id);
        if (data) {
          setArticle(data);
        } else {
          console.error("Artikel tidak ditemukan");
        }
      } catch (error) {
        console.error("Error fetching article:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchArticle();
  }, [id]);

  if (isLoading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontFamily: 'var(--font-playfair)' }}>Memuat artikel...</div>;
  }

  if (!article) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', fontFamily: 'var(--font-playfair)' }}>
        <h2>Artikel Tidak Ditemukan</h2>
        <button onClick={() => router.push('/')} style={{ marginTop: '16px', padding: '12px 24px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: '100px' }}>
      {/* HEADER SECTION DENGAN GAMBAR FULL */}
      <div style={{ position: 'relative', height: '60vh', minHeight: '400px', width: '100%', overflow: 'hidden' }}>
        <img 
          src={article.imageUrl} 
          alt={article.title} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8))' }}></div>
        
        {/* Konten Header */}
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '40px 24px', maxWidth: '800px', margin: '0 auto', color: '#ffffff' }}>
          <button 
            onClick={() => router.back()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)', padding: '8px 18px', borderRadius: '100px', cursor: 'pointer', marginBottom: '20px', fontWeight: 600, fontSize: '13px', transition: 'background 0.2s' }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <FiArrowLeft /> Kembali
          </button>
          
          <div style={{ display: 'flex', gap: '14px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              background: 'rgba(255, 255, 255, 0.25)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              padding: '4px 12px',
              borderRadius: '99px',
              color: '#ffffff', 
              fontSize: '12px', 
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              {article.category || 'Berita'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ffffff', fontSize: '13px', fontWeight: 600, opacity: 0.95 }}>
              <FiCalendar /> {article.date}
            </span>
          </div>
          
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4.5vw, 44px)', lineHeight: 1.25, margin: 0, color: '#ffffff', fontWeight: 700 }}
          >
            {article.title}
          </motion.h1>
        </div>
      </div>

      {/* BODY ARTIKEL */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        {article.summary && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ fontSize: '19px', lineHeight: 1.6, color: 'var(--text-bold)', fontWeight: 600, marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--card-border)' }}
          >
            {article.summary}
          </motion.div>
        )}

        {article.content && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text)', whiteSpace: 'pre-line' }}
          >
            {article.content}
          </motion.div>
        )}

        {/* POSTINGAN CAROUSEL INSTAGRAM */}
        <InstagramCarousel 
          images={article.carouselImages || article.instagramImages} 
          instagramUrl={article.instagramUrl} 
          articleTitle={article.title}
        />
        
        {/* Tombol Share / Footer Artikel (Opsional) */}
        <div style={{ marginTop: '64px', paddingTop: '32px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>Terima kasih telah membaca Untuk Esok.</p>
        </div>
      </div>
    </div>
  );
}

