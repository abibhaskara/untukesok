'use client';
export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiArrowLeft, FiMapPin, FiCalendar, FiClock, 
  FiUsers, FiShare2, FiHeart, FiCheckCircle, 
  FiCheck 
} from 'react-icons/fi';
import { doc, updateDoc, increment, collection, addDoc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase';
import { getCachedProgramDetail } from '../../../src/lib/dataService';
import { calculateDaysLeftGMT8 } from '../../../src/lib/dateUtils';
import { useAuth } from '../../../src/context/AuthContext';
import Image from 'next/image';

const getValidImageUrl = (url) => {
  if (!url) return 'https://picsum.photos/seed/fallback/800/600';
  if (url.startsWith('/') || url.startsWith('http') || url.startsWith('data:')) return url;
  return 'https://picsum.photos/seed/fallback/800/600';
};

const containerVariants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const itemVariants = {
  hidden: { y: 0, opacity: 1 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 120 } }
};

export default function ProgramDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [applied, setApplied] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [program, setProgram] = useState(null);
  
  const { user } = useAuth();
  const [hasApplied, setHasApplied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [existingCancelAppId, setExistingCancelAppId] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    const fetchProgram = async () => {
      if (!id) return;
      try {
        const data = await getCachedProgramDetail(id);
        if (data) {
          setProgram(data);
        } else {
          console.error("Program tidak ditemukan");
        }
      } catch (error) {
        console.error("Error fetching program:", error);
      }
    };
    
    const checkApplication = async () => {
      if (!id || !user) return;
      try {
        const q = query(collection(db, 'applications'), where('userId', '==', user.uid), where('programId', '==', id));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const activeApp = querySnapshot.docs.find(doc => doc.data().status !== 'Dibatalkan');
          if (activeApp) {
            setHasApplied(true);
          } else {
            setExistingCancelAppId(querySnapshot.docs[0].id);
          }
        }
      } catch (error) {
        console.error("Error checking application:", error);
      }
    };

    fetchProgram();
    checkApplication();
  }, [id, user]);

  const handleApply = () => {
    if (!user) {
      alert("Silakan masuk (login) ke akun Anda terlebih dahulu untuk mendaftar.");
      router.push('/account');
      return;
    }
    
    // Direct user to quest (Status Pendaftaran) page without recording registration yet
    router.push(`/programs/${id}/invoice`);
  };

  const handleShare = () => {
    if (typeof window !== 'undefined' && navigator.share) {
      navigator.share({
        title: program.title,
        text: program.description,
        url: window.location.href,
      }).catch(() => {});
    } else if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  };

  if (!program) {
    return (
      <div className="home-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Memuat detail program...</p>
      </div>
    );
  }

  const percentFilled = Math.min(Math.round((program.volunteersJoined / program.volunteersTarget) * 100), 100);

  return (
    <div className="home-content">
      {/* ── TOP FIXED NAVBAR (PEDULY STYLE) ── */}
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
          justifyContent: 'space-between',
          padding: '0 24px',
          borderBottom: '1px solid var(--card-border)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => router.push('/programs')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', padding: '4px' }}
              aria-label="Kembali ke Daftar Program"
            >
              <FiArrowLeft size={20} />
            </button>
            <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-poppins)', color: 'var(--text)' }}>
              Detail Kegiatan
            </span>
          </div>
        </div>

        <button 
          onClick={handleShare}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: '6px' }}
          aria-label="Bagikan"
        >
          <FiShare2 size={20} />
        </button>
      </div>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="news-page-container" style={{ paddingTop: '80px', paddingBottom: '120px', maxWidth: '680px' }}>
        <motion.div variants={containerVariants} initial="hidden" animate="visible">

          {/* Toast Feedback */}
          <AnimatePresence>
            {applied && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                style={{
                  position: 'fixed',
                  top: '74px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#10b981',
                  color: '#ffffff',
                  padding: '12px 24px',
                  borderRadius: '999px',
                  boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
                  zIndex: 1100,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-poppins)'
                }}
              >
                <FiCheckCircle size={20} />
                Pendaftaran Berhasil! Anda terdaftar pada {program.title}.
              </motion.div>
            )}

            {copiedShare && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                style={{
                  position: 'fixed',
                  top: '74px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: '999px',
                  zIndex: 1100,
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Link aktivitas berhasil disalin!
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── TITLE & HEADER META ── */}
          <motion.div variants={itemVariants} style={{ marginBottom: '20px' }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '999px',
              border: '1px solid #ef4444',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '12px'
            }}>
              {program.category || "Relawan Tatap Muka"}
            </span>

            <h1 style={{
              fontSize: '26px',
              fontWeight: 800,
              lineHeight: 1.35,
              color: 'var(--text-bold)',
              fontFamily: 'var(--font-poppins)',
              marginBottom: '12px'
            }}>
              {program.title}
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', opacity: 0.75 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiMapPin size={14} style={{ color: 'var(--primary)' }} />
                <span>{program.location}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiCalendar size={14} style={{ color: 'var(--primary)' }} />
                  <span>{program.date}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiClock size={14} style={{ color: 'var(--primary)' }} />
                  <span>{program.startTime && program.endTime ? `${program.startTime} - ${program.endTime} WIB` : '09:00 - 15:00 WIB'}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── MAIN HERO IMAGE / GALLERY CONTAINER ── */}
          <motion.div variants={itemVariants} style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', marginBottom: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', aspectRatio: '16/10', width: '100%' }}>
            <Image 
              src={getValidImageUrl(program.imageUrl)} 
              alt={program.title} 
              fill
              style={{ objectFit: 'cover' }} 
            />

            {/* Favorite Floating Button (Bottom-Right) */}
            <button
              onClick={() => setIsFavorited(!isFavorited)}
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#ffffff',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              aria-label="Simpan Favorit"
            >
              <FiHeart size={20} style={{ color: isFavorited ? '#ef4444' : '#64748b', fill: isFavorited ? '#ef4444' : 'none' }} />
            </button>
          </motion.div>

          {/* ── ORGANIZATOR CARD ── */}
          <motion.div variants={itemVariants} style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '18px',
              flexShrink: 0
            }}>
              UE
            </div>
            <div>
              <p style={{ fontSize: '11px', opacity: 0.6, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dibuat oleh:</p>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-bold)', margin: 0 }}>Untuk Esok Organization</h4>
              <p style={{ fontSize: '12px', opacity: 0.6 }}>Organisasi Non-Profit Pendidikan & Kebudayaan</p>
            </div>
          </motion.div>

          {/* ── VOLUNTEER PROGRESS STATUS ── */}
          <motion.div variants={itemVariants} style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '28px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '13px', fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiUsers size={16} style={{ color: 'var(--primary)' }} />
                Status Kuota Relawan
              </span>
              <span style={{ color: 'var(--primary)' }}>{program.volunteersJoined} dari {program.volunteersTarget} Terkumpul</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: 'var(--card-border)', borderRadius: '999px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{
                height: '100%',
                width: `${percentFilled}%`,
                background: 'linear-gradient(to right, var(--primary), var(--accent))',
                borderRadius: '999px',
                transition: 'width 0.5s ease'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', opacity: 0.6 }}>
              <span>⏱ Batas Waktu: {calculateDaysLeftGMT8(program)} Hari lagi</span>
              <span>{percentFilled}% Terisi</span>
            </div>
          </motion.div>

          {/* ── SECTIONS / DETAILS ── */}
          <motion.div variants={itemVariants} style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--card-border)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-bold)' }}>Detail Program</h3>
            <p style={{ fontSize: '15px', lineHeight: 1.7, opacity: 0.85, whiteSpace: 'pre-line' }}>
              {program.description}
            </p>
          </motion.div>

          <motion.div variants={itemVariants} style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--card-border)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-bold)' }}>Informasi Utama</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'var(--card-bg)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <p style={{ fontSize: '11px', opacity: 0.5, marginBottom: '4px', textTransform: 'uppercase' }}>Kategori</p>
                <p style={{ fontSize: '14px', fontWeight: 700 }}>{program.category || "Pendidikan"}</p>
              </div>
              <div style={{ background: 'var(--card-bg)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <p style={{ fontSize: '11px', opacity: 0.5, marginBottom: '4px', textTransform: 'uppercase' }}>Kuota Tersedia</p>
                <p style={{ fontSize: '14px', fontWeight: 700 }}>{program.volunteersTarget} Orang</p>
              </div>
              <div style={{ background: 'var(--card-bg)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <p style={{ fontSize: '11px', opacity: 0.5, marginBottom: '4px', textTransform: 'uppercase' }}>Tanggal Kegiatan</p>
                <p style={{ fontSize: '14px', fontWeight: 700 }}>{program.date}</p>
              </div>
              <div style={{ background: 'var(--card-bg)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <p style={{ fontSize: '11px', opacity: 0.5, marginBottom: '4px', textTransform: 'uppercase' }}>Lokasi Utama</p>
                <p style={{ fontSize: '14px', fontWeight: 700 }}>{program.location}</p>
              </div>
            </div>
          </motion.div>

          {program.tasks && (
            <motion.div variants={itemVariants} style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--card-border)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-bold)' }}>Tugas Relawan</h3>
              <div style={{ fontSize: '14px', lineHeight: 1.8, opacity: 0.85, whiteSpace: 'pre-line' }}>
                {program.tasks}
              </div>
            </motion.div>
          )}

          {program.criteria && (
            <motion.div variants={itemVariants} style={{ paddingBottom: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-bold)' }}>Kriteria Relawan</h3>
              <div style={{ fontSize: '14px', lineHeight: 1.8, opacity: 0.85, whiteSpace: 'pre-line' }}>
                {program.criteria}
              </div>
            </motion.div>
          )}

        </motion.div>
      </div>

      {/* ── FIXED BOTTOM ACTION BAR ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '76px',
        background: 'var(--bg)',
        borderTop: '1px solid var(--card-border)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px'
      }}>
        <div style={{ width: '100%', maxWidth: '680px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleShare}
            style={{
              padding: '12px 20px',
              height: '48px',
              borderRadius: '999px',
              border: '1px solid var(--card-border)',
              background: 'var(--card-bg)',
              color: 'var(--text)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
              fontFamily: 'var(--font-poppins)'
            }}
          >
            <FiShare2 size={16} /> Bagikan
          </button>

          <button
            onClick={handleApply}
            disabled={isApplying}
            className="btn-primary"
            style={{
              flex: 1,
              height: '48px',
              borderRadius: '999px',
              fontSize: '15px',
              fontWeight: 700,
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isApplying ? 0.6 : 1,
              cursor: isApplying ? 'not-allowed' : 'pointer',
              background: hasApplied ? '#10b981' : 'var(--primary)'
            }}
          >
            {hasApplied ? (
              <>
                <FiCheckCircle size={18} /> Sudah Terdaftar
              </>
            ) : isApplying ? (
              'Memproses...'
            ) : (
              <>
                <FiCheck size={18} /> Jadi Relawan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
