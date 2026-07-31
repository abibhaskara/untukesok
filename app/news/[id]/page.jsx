'use client';
export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCachedNewsDetail } from '../../../src/lib/dataService';
import { FiArrowLeft, FiCalendar } from 'react-icons/fi';
import { motion } from 'framer-motion';

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
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '40px 24px', maxWidth: '800px', margin: '0 auto', color: 'white' }}>
          <button 
            onClick={() => router.back()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '100px', cursor: 'pointer', marginBottom: '24px', fontWeight: 600, transition: 'background 0.2s' }}
            onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.3)'}
            onMouseOut={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
          >
            <FiArrowLeft /> Kembali
          </button>
          
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'black', fontSize: '13px', fontWeight: 700 }}>
              {article.category}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'white', fontSize: '13px', fontWeight: 600 }}>
              <FiCalendar /> {article.date}
            </span>
          </div>
          
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(32px, 5vw, 48px)', lineHeight: 1.2, margin: 0 }}
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
            style={{ fontSize: '20px', lineHeight: 1.6, color: '#1e293b', fontWeight: 600, marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid #e2e8f0' }}
          >
            {article.summary}
          </motion.div>
        )}

        {article.content && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ fontSize: '18px', lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-line' }}
          >
            {article.content}
          </motion.div>
        )}
        
        {/* Tombol Share / Footer Artikel (Opsional) */}
        <div style={{ marginTop: '64px', paddingTop: '32px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>Terima kasih telah membaca Untuk Esok.</p>
        </div>
      </div>
    </div>
  );
}
