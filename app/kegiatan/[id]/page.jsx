'use client';
export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiArrowLeft, FiMapPin, FiCalendar, FiClock, 
  FiUsers, FiShare2, FiCheck,
  FiAward, FiCamera, FiTruck, FiNavigation, FiPackage, FiCoffee, FiTag, FiUserCheck, FiDollarSign
} from 'react-icons/fi';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase';
import { getCachedProgramDetail } from '../../../src/lib/dataService';
import { calculateDaysLeftGMT8, formatDateDDMMYYYY } from '../../../src/lib/dateUtils';
import { useAuth } from '../../../src/context/AuthContext';
import Image from 'next/image';

const parseListItems = (text) => {
  if (!text) return [];
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/^[-*•\s]+|^(\d+[.)]\s*)/, '').trim())
    .filter(line => line.length > 0);
};

const getFacilityIcon = (name) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('sertifikat') || lower.includes('certif')) {
    return <FiAward size={15} color="#d97706" style={{ flexShrink: 0 }} />;
  }
  if (lower.includes('kaos') || lower.includes('baju') || lower.includes('merch') || lower.includes('shirt') || lower.includes('atribut')) {
    return <FiTag size={15} color="#d97706" style={{ flexShrink: 0 }} />;
  }
  if (lower.includes('konsumsi') || lower.includes('snack') || lower.includes('makan') || lower.includes('lunch') || lower.includes('food')) {
    return <FiPackage size={15} color="#d97706" style={{ flexShrink: 0 }} />;
  }
  if (lower.includes('minum') || lower.includes('drink') || lower.includes('kopi') || lower.includes('coffee')) {
    return <FiCoffee size={15} color="#d97706" style={{ flexShrink: 0 }} />;
  }
  if (lower.includes('dokumentasi') || lower.includes('foto') || lower.includes('kamera') || lower.includes('photo')) {
    return <FiCamera size={15} color="#d97706" style={{ flexShrink: 0 }} />;
  }
  if (lower.includes('pribadi')) {
    return <FiNavigation size={15} color="#d97706" style={{ flexShrink: 0 }} />;
  }
  if (lower.includes('transport') || lower.includes('hiace') || lower.includes('mobil') || lower.includes('bus') || lower.includes('kendaraan')) {
    return <FiTruck size={15} color="#d97706" style={{ flexShrink: 0 }} />;
  }
  if (lower.includes('id card') || lower.includes('badge') || lower.includes('nametag')) {
    return <FiUserCheck size={15} color="#d97706" style={{ flexShrink: 0 }} />;
  }
  if (lower.includes('uang') || lower.includes('insentif') || lower.includes('honor') || lower.includes('fee')) {
    return <FiDollarSign size={15} color="#d97706" style={{ flexShrink: 0 }} />;
  }
  return <FiCheck size={15} color="#d97706" strokeWidth={2.5} style={{ flexShrink: 0 }} />;
};

const FALLBACK_IMG = 'https://picsum.photos/seed/fallback/800/600';
const getValidImageUrl = (url) => url?.match(/^(\/|http|data:)/) ? url : FALLBACK_IMG;

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
    
    const fetchAndCheck = async () => {
      if (!id) return;
      try {
        const data = await getCachedProgramDetail(id);
        if (data) {
          setProgram(data);

          if (user) {
            const actualId = data.id || id;
            try {
              const q = query(
                collection(db, 'applications'), 
                where('userId', '==', user.uid), 
                where('programId', '==', actualId)
              );
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                const activeApp = querySnapshot.docs.find(doc => doc.data().status !== 'Dibatalkan');
                if (activeApp) {
                  setHasApplied(true);
                }
              }
            } catch (appErr) {
              console.error("Error checking application:", appErr);
            }
          }
        } else {
          console.error("Program tidak ditemukan");
        }
      } catch (error) {
        console.error("Error fetching program:", error);
      }
    };

    fetchAndCheck();
  }, [id, user]);

  const handleApply = async () => {
    if (!user) {
      alert("Silakan masuk (login) ke akun Anda terlebih dahulu untuk mendaftar.");
      router.push('/akun');
      return;
    }

    // Check if user has completed their profile (name and phone)
    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const hasName = Boolean(uData.name && uData.name.trim().length > 0);
        const hasPhone = Boolean(uData.phone && uData.phone.trim().length > 0);
        if (!hasName || !hasPhone) {
          alert("Harap lengkapi profil (Nama Lengkap & Nomor WhatsApp) Anda terlebih dahulu sebelum mendaftar program relawan.");
          router.push('/akun');
          return;
        }
      } else {
        alert("Harap lengkapi profil Anda terlebih dahulu.");
        router.push('/akun');
        return;
      }
    } catch (checkErr) {
      console.warn("Error checking profile before apply:", checkErr);
    }

    // Block if quota is full
    if (program.volunteersJoined >= program.volunteersTarget) {
      alert("Maaf, kuota relawan untuk kegiatan ini sudah penuh. Pendaftaran ditutup.");
      return;
    }
    
    // Direct user to quest (Status Pendaftaran) page without recording registration yet
    router.push(`/kegiatan/${program.slug || program.id || id}/invoice`);
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
        <p>Memuat detail kegiatan...</p>
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
          boxShadow: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => router.push('/kegiatan')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', padding: '4px' }}
              aria-label="Kembali ke Daftar Kegiatan"
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
        <motion.div>

          {/* Toast Feedback */}
          <AnimatePresence>


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
          <motion.div style={{ marginBottom: '20px' }}>

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
          <motion.div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', marginBottom: '24px', boxShadow: 'none', aspectRatio: '16/10', width: '100%' }}>
            <Image 
              src={getValidImageUrl(program.imageUrl)} 
              alt={program.title} 
              fill
              style={{ objectFit: 'cover', filter: daysLeft < 0 ? 'grayscale(100%)' : 'none' }} 
            />
          </motion.div>

          {/* ── CREATOR / ORGANIZER CARD ── */}
          <motion.div style={{ 
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
          <motion.div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: program.isPaid && program.price > 0 ? '16px' : '28px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '13px', fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiUsers size={16} style={{ color: 'var(--primary)' }} />
                Kuota Relawan
              </span>
              <span style={{ color: 'var(--primary)' }}>{program.volunteersJoined}/{program.volunteersTarget}</span>
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
          </motion.div>

          {/* ── PRICING CARD (ONLY WHEN PAID) ── */}
          {program.isPaid && program.price > 0 && (
            <motion.div style={{
              background: 'transparent',
              border: '1px solid var(--card-border)',
              borderRadius: '12px',
              padding: '10px 14px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'var(--font-poppins)'
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text)', opacity: 0.7, display: 'block' }}>
                  Commitment Fee
                </span>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-bold)', marginTop: '2px' }}>
                  Rp {Number(program.price).toLocaleString('id-ID')}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── SECTIONS / DETAILS ── */}
          <motion.div style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--card-border)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-bold)' }}>Detail Kegiatan</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.7, opacity: 0.85, whiteSpace: 'pre-line', textAlign: 'justify' }}>
              {program.description}
            </p>
          </motion.div>

          {/* ── TUGAS ── */}
          {program.tasks && (() => {
            const taskItems = parseListItems(program.tasks);
            if (taskItems.length === 0) return null;
            return (
              <motion.div style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--card-border)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-bold)' }}>
                  Tugas
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {taskItems.map((task, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <span style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#f59e0b',
                        color: '#ffffff',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                        boxShadow: 'none'
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{ fontSize: '14.5px', color: 'var(--text)', lineHeight: 1.6 }}>
                        {task}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })()}

          {/* ── KRITERIA ── */}
          {program.criteria && (() => {
            const criteriaItems = parseListItems(program.criteria);
            if (criteriaItems.length === 0) return null;
            return (
              <motion.div style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--card-border)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-bold)' }}>
                  Kriteria
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {criteriaItems.map((crit, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <span style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#f59e0b',
                        color: '#ffffff',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                        boxShadow: 'none'
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{ fontSize: '14.5px', color: 'var(--text)', lineHeight: 1.6 }}>
                        {crit}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })()}

          {/* ── FASILITAS KEGIATAN ── */}
          {(() => {
            const rawFacilities = Array.isArray(program.facilities) && program.facilities.length > 0 
              ? program.facilities 
              : ['E-Sertifikat', 'Dokumentasi Kegiatan'];
            
            const rawTransport = Array.isArray(program.transportation) ? program.transportation : [];
            const mergedFacilities = [...rawFacilities];
            rawTransport.forEach(t => {
              if (!mergedFacilities.some(f => f.toLowerCase().includes(t.toLowerCase()))) {
                mergedFacilities.push(t.toLowerCase().startsWith('transport') ? t : `Transportasi (${t})`);
              }
            });

            return (
              <motion.div style={{ paddingBottom: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-bold)' }}>
                  Fasilitas
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {mergedFacilities.map((fac, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 18px',
                        borderRadius: '999px',
                        background: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: 'var(--text-bold)'
                      }}
                    >
                      {getFacilityIcon(fac)}
                      <span>{fac}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })()}

        </motion.div>
      </div>

      {/* ── BOTTOM STICKY ACTION BAR ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--bg)',
        borderTop: '1px solid var(--card-border)',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 1000,
        boxShadow: 'none'
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
            disabled={daysLeft < 0 || isFull || hasApplied}
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
              opacity: hasApplied ? 1 : ((daysLeft < 0 || isFull) ? 0.6 : 1),
              cursor: (daysLeft < 0 || isFull || hasApplied) ? 'default' : 'pointer',
              background: hasApplied 
                ? '#205a28' 
                : ((daysLeft < 0 || isFull) 
                  ? 'var(--card-border)' 
                  : 'var(--primary)'),
              color: hasApplied 
                ? '#ffffff' 
                : ((daysLeft < 0 || isFull) ? 'var(--text)' : '#ffffff')
            }}
          >
            {hasApplied ? (
              'Sudah Terdaftar'
            ) : daysLeft < 0 ? (
              'Selesai'
            ) : isFull ? (
              'Kuota Penuh'
            ) : (
              'Jadi Relawan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
