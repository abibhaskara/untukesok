'use client';
export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiArrowLeft, FiMapPin, FiCalendar, FiClock, 
  FiUsers, FiShare2, FiCheckCircle
} from 'react-icons/fi';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getCachedProgramDetail } from '../../../src/lib/dataService';
import { calculateDaysLeftGMT8, formatDateDDMMYYYY } from '../../../src/lib/dateUtils';
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

  const [copiedShare, setCopiedShare] = useState(false);
  const [program, setProgram] = useState(null);
  
  const { user } = useAuth();
  const [hasApplied, setHasApplied] = useState(false);

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

    // Block if quota is full
    if (program.volunteersJoined >= program.volunteersTarget) {
      alert("Maaf, kuota relawan untuk program ini sudah penuh. Pendaftaran ditutup.");
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
  const daysLeft = calculateDaysLeftGMT8(program);
  const isFull = program.volunteersJoined >= program.volunteersTarget;

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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', opacity: 0.75 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiMapPin size={13} style={{ color: 'var(--primary)' }} />
                <span>{program.location}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiCalendar size={13} style={{ color: 'var(--primary)' }} />
                  <span>{formatDateDDMMYYYY(program.date)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiClock size={13} style={{ color: 'var(--primary)' }} />
                  <span>{program.startTime && program.endTime ? `${program.startTime} - ${program.endTime} WITA` : '10:00 - 12:00 WITA'}</span>
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
              style={{ objectFit: 'cover', filter: daysLeft < 0 ? 'grayscale(100%)' : 'none' }} 
            />
          </motion.div>

          {/* ── CREATOR / ORGANIZER CARD ── */}
          <motion.div variants={itemVariants} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            padding: '12px 16px', 
            background: '#ffffff', 
            borderRadius: '12px', 
            border: '1px solid var(--card-border)',
            marginBottom: '20px'
          }}>
            <img 
              src="/logo_UE.webp" 
              alt="Untuk Esok Logo" 
              style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }} 
            />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '9px', fontWeight: 700, opacity: 0.5, margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DIBUAT OLEH:</p>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-bold)' }}>Komunitas Untuk Esok</h3>
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
                background: '#FFBD59',
                borderRadius: '999px',
                transition: 'width 0.5s ease'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', opacity: 0.6 }}>
              <span>⏱ Batas Waktu: {daysLeft < 0 ? 'Selesai' : `${daysLeft} Hari lagi`}</span>
              <span>{percentFilled}% Terisi</span>
            </div>
            {isFull && daysLeft >= 0 && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #fee2e2, #fef2f2)',
                border: '1px solid #fca5a5',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#dc2626'
              }}>
                <FiUsers size={16} />
                Kuota relawan sudah penuh. Pendaftaran ditutup.
              </div>
            )}
          </motion.div>

          {/* ── SECTIONS / DETAILS ── */}
          <motion.div variants={itemVariants} style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--card-border)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-bold)' }}>Detail Program</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.7, opacity: 0.85, whiteSpace: 'pre-line', textAlign: 'justify' }}>
              {program.description}
            </p>
          </motion.div>

          <motion.div variants={itemVariants} style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--card-border)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-bold)' }}>Informasi Utama</h3>
            <div className="program-info-grid">
              <div className="program-info-card">
                <p className="program-info-card-label">Kategori</p>
                <p className="program-info-card-value">{program.category || "Pendidikan"}</p>
              </div>
              <div className="program-info-card">
                <p className="program-info-card-label">Kuota Tersedia</p>
                <p className="program-info-card-value">{program.volunteersTarget} Orang</p>
              </div>
              <div className="program-info-card">
                <p className="program-info-card-label">Tanggal Kegiatan</p>
                <p className="program-info-card-value">{formatDateDDMMYYYY(program.date)}</p>
              </div>
              <div style={{ gridColumn: '1 / -1', textAlign: 'left', padding: '8px 0', border: 'none', background: 'transparent' }}>
                <p className="program-info-card-label" style={{ textAlign: 'left' }}>Lokasi Utama</p>
                <p className="program-info-card-value" style={{ textAlign: 'left', fontSize: '14px' }}>{program.location}</p>
              </div>
            </div>
          </motion.div>

          {program.tasks && (
            <motion.div variants={itemVariants} style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--card-border)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-bold)' }}>Tugas Relawan</h3>
              <div style={{ fontSize: '14px', lineHeight: 1.7, opacity: 0.85, whiteSpace: 'pre-line', textAlign: 'justify' }}>
                {program.tasks}
              </div>
            </motion.div>
          )}

          {program.criteria && (
            <motion.div variants={itemVariants} style={{ paddingBottom: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-bold)' }}>Kriteria Relawan</h3>
              <div style={{ fontSize: '14px', lineHeight: 1.7, opacity: 0.85, whiteSpace: 'pre-line', textAlign: 'justify' }}>
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
            disabled={isApplying || daysLeft < 0 || isFull}
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
              opacity: (isApplying || daysLeft < 0 || isFull) ? 0.6 : 1,
              cursor: (isApplying || daysLeft < 0 || isFull) ? 'not-allowed' : 'pointer',
              background: hasApplied ? '#10b981' : ((daysLeft < 0 || isFull) ? 'var(--card-border)' : 'var(--primary)'),
              color: (daysLeft < 0 || isFull) ? 'var(--text)' : 'white'
            }}
          >
            {hasApplied ? (
              'Sudah Terdaftar'
            ) : isApplying ? (
              'Memproses...'
            ) : daysLeft < 0 ? (
              'Selesai'
            ) : isFull ? (
              <>
                <FiUsers size={18} /> Kuota Penuh
              </>
            ) : (
              'Jadi Relawan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
