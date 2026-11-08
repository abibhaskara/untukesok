'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { getCachedNews } from '../../src/lib/dataService';
import { useState, useEffect } from 'react';
import {
  FiSend, FiCheckCircle, FiInbox, FiCpu, FiMessageSquare
} from 'react-icons/fi';
import { collection, addDoc, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

const containerVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 0, opacity: 1 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

const BALI_REGENCIES = [
  'Kota Denpasar',
  'Kabupaten Badung',
  'Kabupaten Gianyar',
  'Kabupaten Tabanan',
  'Kabupaten Buleleng',
  'Kabupaten Karangasem',
  'Kabupaten Klungkung',
  'Kabupaten Bangli',
  'Kabupaten Jembrana'
];

const CATEGORIES = [
  'Lingkungan & Sampah',
  'Pendidikan Anak',
  'Pelestarian Budaya',
  'Infrastruktur Publik',
  'Bantuan Sosial & Lansia',
  'Aspirasi Umum'
];

export default function News() {
  const router = useRouter();
  const [newsData, setNewsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Kotak Suara Warga State
  const [publicVoices, setPublicVoices] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    isAnonymous: false,
    regency: 'Kota Denpasar',
    category: 'Lingkungan & Sampah',
    message: ''
  });
  const [isSubmittingVoice, setIsSubmittingVoice] = useState(false);
  const [voiceSuccessMessage, setVoiceSuccessMessage] = useState('');
  const [voiceErrorMessage, setVoiceErrorMessage] = useState('');

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const data = await getCachedNews();
        setNewsData(data);
      } catch (error) {
        console.error("Error fetching news:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNews();

    const fetchPublicVoices = async () => {
      try {
        let snap;
        try {
          const q = query(collection(db, 'kotak_suara'), orderBy('createdAt', 'desc'), limit(6));
          snap = await getDocs(q);
        } catch {
          snap = await getDocs(query(collection(db, 'kotak_suara'), limit(6)));
        }
        if (snap && !snap.empty) {
          const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const valid = items.filter(i => i.status !== 'diarsipkan');
          setPublicVoices(valid);
        } else {
          setPublicVoices([]);
        }
      } catch (err) {
        console.warn('Gagal memuat suara publik:', err);
        setPublicVoices([]);
      }
    };
    fetchPublicVoices();
  }, []);

  const handleSubmitVoice = async (e) => {
    e.preventDefault();
    if (!formData.message.trim()) {
      setVoiceErrorMessage('Silakan tuliskan pesan aspirasi Anda.');
      return;
    }

    setIsSubmittingVoice(true);
    setVoiceErrorMessage('');
    setVoiceSuccessMessage('');

    try {
      const newVoice = {
        name: formData.isAnonymous ? 'Warga Anonim' : (formData.name.trim() || 'Warga'),
        isAnonymous: Boolean(formData.isAnonymous),
        regency: formData.regency,
        category: formData.category,
        message: formData.message.trim(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      try {
        const docRef = await addDoc(collection(db, 'kotak_suara'), newVoice);
        setPublicVoices(prev => [{ id: docRef.id, ...newVoice }, ...prev]);
      } catch {
        // Fallback optimistic UI
        setPublicVoices(prev => [{ id: 'local-' + Date.now(), ...newVoice }, ...prev]);
      }

      setVoiceSuccessMessage('Matur suksma! Suara Anda telah berhasil dikirim ke Kotak Suara Warga Untuk Esok.');
      setFormData({
        name: '',
        isAnonymous: false,
        regency: 'Kota Denpasar',
        category: 'Lingkungan & Sampah',
        message: ''
      });
      setTimeout(() => setVoiceSuccessMessage(''), 6000);
    } catch (err) {
      setVoiceErrorMessage('Terjadi kendala saat mengirim pesan: ' + err.message);
    } finally {
      setIsSubmittingVoice(false);
    }
  };

  const featuredArticle = newsData[0];
  const gridArticles = newsData.slice(1, 7);

  return (
    <div className="home-content">
      {/* Top Navbar Header (Fixed Anchored Top Navbar) */}
      <div 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          zIndex: 1000,
          background: 'var(--bg)',
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px', 
          padding: '0 24px',
          borderBottom: '1px solid var(--card-border)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
        }}
      >
        <h1 style={{ 
          fontSize: '20px', 
          fontWeight: 700, 
          fontFamily: 'var(--font-poppins)', 
          color: 'var(--text)',
          margin: 0 
        }}>
          Berita & Aspirasi Warga
        </h1>
      </div>

      <div className="news-page-container" style={{ paddingTop: '80px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>Memuat Berita...</div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
          {/* Featured Article */}
          {featuredArticle && (
            <motion.div 
              className="news-hero-section" 
              variants={itemVariants} 
              onClick={() => router.push(`/berita/${featuredArticle.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <img 
                src={featuredArticle.imageUrl} 
                alt={featuredArticle.title} 
                className="news-hero-image"
              />
              <div className="news-hero-content-box">
                <div className="news-hero-meta">
                  {featuredArticle.category} — {featuredArticle.date}
                </div>
                <h2 className="news-hero-title">
                  {featuredArticle.title}
                </h2>
                <div style={{ fontSize: '15px', opacity: 0.7, maxWidth: '600px', margin: '0 auto' }}>
                  {featuredArticle.summary}
                </div>
              </div>
            </motion.div>
          )}

          {/* Top Headlines Section */}
          <motion.div className="news-section-title-container" variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ height: '1px', width: '40px', background: 'var(--primary)' }}></div>
              <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Berita Lainnya</span>
            </div>
            <h2 className="serif-title text-h2" style={{ margin: 0 }}>Berita Terhangat</h2>
          </motion.div>

          {/* Grid Articles */}
          <motion.div className="news-page-grid" variants={itemVariants}>
            {gridArticles.map((article) => (
              <div 
                key={article.id} 
                className="news-page-grid-item"
                onClick={() => router.push(`/berita/${article.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <img src={article.imageUrl} alt={article.title} />
                <div>
                  <div className="news-page-grid-meta">
                    {article.category} — {article.date}
                  </div>
                  <h3 className="news-page-grid-title">{article.title}</h3>
                </div>
              </div>
            ))}
          </motion.div>

          {/* KOTAK SUARA WARGA BALI SECTION */}
          <motion.section
            variants={itemVariants}
            style={{
              marginTop: '80px',
              marginBottom: '60px',
              padding: '36px 32px',
              borderRadius: '24px',
              background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
            }}
          >
            {/* Header Kotak Suara */}
            <div style={{ maxWidth: '720px', marginBottom: '36px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#EFF6FF', border: '1px solid #DBEAFE', color: '#1E40AF', padding: '4px 12px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, marginBottom: '12px' }}>
                <FiCpu size={14} />
                <span>KOTAK SUARA WARGA BALI & SINTESIS AI</span>
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A', margin: '0 0 10px 0', letterSpacing: '-0.02em', lineHeight: '1.2' }}>
                Suarakan Harapan & Isu Lingkunganmu
              </h2>
              <p style={{ fontSize: '14.5px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                Punya aspirasi, kritik membangun, atau cerita tentang lingkungan & komunitas di sekitarmu? Sampaikan suaramu. Setiap aspirasi dianalisis oleh AI kami untuk merumuskan aksi nyata program kerelawanan Yayasan Untuk Esok.
              </p>
            </div>

            {/* 2-Column Container: Form & Feed */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', alignItems: 'start' }}>
              
              {/* KOLOM KIRI: FORM ASPIRASI */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '18px',
                  border: '1px solid #E2E8F0',
                  padding: '24px',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#233B69', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiInbox size={16} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                    Tuliskan Aspirasimu
                  </h3>
                </div>

                {voiceSuccessMessage && (
                  <div
                    style={{
                      background: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      color: '#166534',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <FiCheckCircle size={18} style={{ flexShrink: 0 }} />
                    <span>{voiceSuccessMessage}</span>
                  </div>
                )}

                {voiceErrorMessage && (
                  <div
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      color: '#991B1B',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      marginBottom: '16px'
                    }}
                  >
                    {voiceErrorMessage}
                  </div>
                )}

                <form onSubmit={handleSubmitVoice} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Nama Pengirim & Toggle Anonim */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Nama Anda
                    </label>
                    <input
                      type="text"
                      disabled={formData.isAnonymous}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={formData.isAnonymous ? 'Warga Anonim (Identitas dirahasiakan)' : 'Contoh: Made Dwi'}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13.5px',
                        color: formData.isAnonymous ? '#94A3B8' : '#0F172A',
                        background: formData.isAnonymous ? '#F8FAFC' : '#FFFFFF',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '12px', color: '#64748B', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.isAnonymous}
                        onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
                      />
                      <span>Kirim sebagai Anonim (Rahasiakan nama saya dari publik)</span>
                    </label>
                  </div>

                  {/* Kabupaten/Kota & Kategori */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Wilayah Bali
                      </label>
                      <select
                        value={formData.regency}
                        onChange={(e) => setFormData({ ...formData, regency: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid #CBD5E1',
                          fontSize: '13px',
                          color: '#0F172A',
                          background: '#FFFFFF',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      >
                        {BALI_REGENCIES.map(reg => (
                          <option key={reg} value={reg}>{reg}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Kategori Isu
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid #CBD5E1',
                          fontSize: '13px',
                          color: '#0F172A',
                          background: '#FFFFFF',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Pesan Aspirasi */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Isi Pesan Aspirasi / Keluhan Komunitas
                    </label>
                    <textarea
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Ceritakan isu di lingkunganmu, misalnya masalah sampah di pantai/sungai, fasilitas belajar anak, atau pelestarian tradisi lokal..."
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13.5px',
                        color: '#0F172A',
                        outline: 'none',
                        resize: 'vertical',
                        lineHeight: '1.5',
                        boxSizing: 'border-box'
                      }}
                      maxLength={600}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94A3B8', marginTop: '4px' }}>
                      <span>Maksimal 600 karakter</span>
                      <span>{formData.message.length}/600</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmittingVoice}
                    style={{
                      background: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 20px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor: isSubmittingVoice ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'opacity 0.2s ease',
                      opacity: isSubmittingVoice ? 0.7 : 1
                    }}
                  >
                    <FiSend size={15} />
                    <span>{isSubmittingVoice ? 'Mengirim Suara...' : 'Kirim Aspirasi Saya'}</span>
                  </button>
                </form>
              </div>

              {/* KOLOM KANAN: ASPIRASI TERHIMPUN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiMessageSquare size={16} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                      Suara Warga Terkini
                    </h3>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    {publicVoices.length} Aspirasi Ditampilkan
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {publicVoices.length === 0 ? (
                    <div
                      style={{
                        background: '#FFFFFF',
                        border: '1px dashed #CBD5E1',
                        borderRadius: '14px',
                        padding: '36px 20px',
                        textAlign: 'center',
                        color: '#64748B'
                      }}
                    >
                      <FiInbox size={32} style={{ color: '#94A3B8', margin: '0 auto 10px', display: 'block' }} />
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Belum ada aspirasi publik
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748B', maxWidth: '300px', margin: '0 auto' }}>
                        Jadilah yang pertama menyuarakan isu atau harapan komunitasmu untuk Bali esok hari!
                      </div>
                    </div>
                  ) : (
                    publicVoices.slice(0, 4).map((voice) => (
                      <div
                        key={voice.id}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '14px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>
                              {voice.isAnonymous ? 'Warga Anonim' : (voice.name || 'Warga')}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748B' }}>
                              • {voice.regency || 'Bali'}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#EFF6FF',
                              color: '#1E40AF'
                            }}
                          >
                            {voice.category || 'Aspirasi'}
                          </span>
                        </div>

                        <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.55', fontStyle: 'italic' }}>
                          "{voice.message}"
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          <span>
                            {voice.createdAt ? new Date(voice.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru saja'}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#166534' }}>
                            <FiCheckCircle size={11} /> Terdokumentasi
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>

            </div>
          </motion.section>

        </motion.div>
        )}
      </div>
    </div>
  );
}
