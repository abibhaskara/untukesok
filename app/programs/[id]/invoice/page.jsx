'use client';
export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiCheckCircle, FiDownload, FiMessageCircle, FiImage, FiUpload, FiAlertCircle, FiClock } from 'react-icons/fi';
import { db } from '../../../../src/lib/firebase';
import { doc, getDoc, getDocs, collection, query, where, addDoc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../../../../src/context/AuthContext';
import { getCachedProgramDetail, clearCache } from '../../../../src/lib/dataService';
export default function InvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [program, setProgram] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUploadedTwibbon, setHasUploadedTwibbon] = useState(false);
  const [igProof, setIgProof] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [existingCancelAppId, setExistingCancelAppId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!id) return;
      try {
        // Fetch program detail with fallback
        let progData = await getCachedProgramDetail(id);

        if (isMounted && progData) {
          setProgram(progData);
        }

        // Check user application status if logged in
        if (user && isMounted) {
          try {
            const q = query(
              collection(db, 'applications'),
              where('userId', '==', user.uid),
              where('programId', '==', id)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty && isMounted) {
              const activeApp = querySnapshot.docs.find(d => d.data().status !== 'Dibatalkan');
              if (activeApp) {
                setIsVerified(true);
                setHasUploadedTwibbon(true);
                setIgProof({ name: 'Terverifikasi' });
              } else {
                setExistingCancelAppId(querySnapshot.docs[0].id);
              }
            }
          } catch (appErr) {
            console.warn("Error checking user application:", appErr);
          }
        }
      } catch (error) {
        console.error("Error fetching program data:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [id, user]);

  const handleVerify = async () => {
    if (!user) {
      alert("Silakan masuk (login) ke akun Anda terlebih dahulu untuk memverifikasi pendaftaran.");
      router.push('/account');
      return;
    }

    if (!hasUploadedTwibbon || !igProof) {
      alert("Harap selesaikan semua langkah quest pendaftaran terlebih dahulu!");
      return;
    }

    // Re-check quota from Firestore to prevent race conditions
    try {
      const freshProgDoc = await getDoc(doc(db, 'programs', id));
      if (freshProgDoc.exists()) {
        const freshData = freshProgDoc.data();
        if (freshData.volunteersJoined >= freshData.volunteersTarget) {
          setProgram(prev => ({ ...prev, volunteersJoined: freshData.volunteersJoined, volunteersTarget: freshData.volunteersTarget }));
          alert("Maaf, kuota relawan untuk program ini sudah penuh. Pendaftaran ditutup.");
          return;
        }
      }
    } catch (quotaCheckErr) {
      console.warn("Error re-checking quota:", quotaCheckErr);
    }

    setIsVerifying(true);
    try {
      let userName = user.displayName || 'Relawan';
      let userPhone = '';
      let userEmail = user.email || '';

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.name) userName = userData.name;
          if (userData.phone) userPhone = userData.phone;
          if (userData.email) userEmail = userData.email;
        }
      } catch (err) {
        console.warn("Failed to fetch user profile", err);
      }

      // Upload IG Proof File: Skip Firebase Storage and use Compressed Base64 to save directly in Firestore
      let igProofUrl = '';
      if (igProof) {
        igProofUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(igProof);
          reader.onload = (event) => {
            const img = new window.Image();
            img.src = event.target.result;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 600; // Kompres ukuran agar tidak melebihi batas 1MB Firestore
              const scaleSize = MAX_WIDTH / img.width;
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              // Kualitas 0.6 menghasilkan string base64 yang sangat ringan (~50-100kb)
              const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
              resolve(dataUrl);
            };
            img.onerror = () => resolve('');
          };
          reader.onerror = () => resolve('');
        });
      }

      // Record to applications collection in Firestore
      if (existingCancelAppId) {
        await updateDoc(doc(db, 'applications', existingCancelAppId), {
          status: 'Terdaftar',
          appliedAt: new Date().toISOString(),
          cancelReason: '',
          canceledAt: '',
          igProofUrl: igProofUrl || ''
        });
      } else {
        await addDoc(collection(db, 'applications'), {
          userId: user.uid,
          userName: userName,
          userPhone: userPhone,
          userEmail: userEmail,
          programId: id,
          programTitle: program.title,
          programImageUrl: program.imageUrl,
          programDate: program.date,
          programLocation: program.location,
          status: 'Terdaftar',
          appliedAt: new Date().toISOString(),
          credentialId: `CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          igProofUrl: igProofUrl || ''
        });
      }

      // Increment volunteersJoined count in programs collection
      await updateDoc(doc(db, 'programs', id), {
        volunteersJoined: increment(1)
      });
      clearCache('programs');

      setProgram(prev => ({ ...prev, volunteersJoined: (prev?.volunteersJoined || 0) + 1 }));
      setIsVerified(true);
    } catch (error) {
      console.error("Gagal melakukan verifikasi:", error);
      alert("Terjadi kesalahan saat memverifikasi pendaftaran. Silakan coba lagi.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="home-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Memuat status pendaftaran...</p>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="home-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <p>Program tidak ditemukan.</p>
        <button onClick={() => router.push('/')} style={{ marginTop: '16px', padding: '12px 24px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px' }}>
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const isAllStepsCompleted = hasUploadedTwibbon && Boolean(igProof);
  const waLink = program.whatsappGroupLink || 'https://chat.whatsapp.com/';
  const isFull = program.volunteersJoined >= program.volunteersTarget;

  return (
    <div className="home-content" style={{ paddingBottom: '100px' }}>
      {/* TOP NAVBAR */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '60px', zIndex: 1000,
        background: 'var(--bg)', display: 'flex', alignItems: 'center', padding: '0 24px',
        borderBottom: '1px solid var(--card-border)', boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => router.push(`/programs/${id}`)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', padding: '4px' }}
            aria-label="Kembali"
          >
            <FiArrowLeft size={20} />
          </button>
          <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-poppins)', color: 'var(--text)' }}>
            Status Pendaftaran
          </span>
        </div>
      </div>

      <div style={{ marginTop: '80px', padding: '0 24px', maxWidth: '680px', margin: '80px auto 0' }}>
        {/* HEADER SECTION */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', marginBottom: '32px' }}
        >
          {isVerified ? (
            <>
              <FiCheckCircle size={64} color="#10b981" style={{ marginBottom: '16px' }} />
              <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '28px', marginBottom: '8px' }}>
                Pendaftaran Berhasil!
              </h1>
              <p style={{ color: 'var(--text)', opacity: 0.8, fontSize: '14px', maxWidth: '420px', margin: '0 auto', lineHeight: 1.6 }}>
                Selamat! Kamu resmi terdaftar sebagai relawan di program <strong style={{ color: 'var(--primary)' }}>{program.title}</strong>. Silakan bergabung ke Grup WhatsApp untuk koordinasi kegiatan.
              </p>
            </>
          ) : (
            <>
              <FiClock size={56} color="var(--primary)" style={{ marginBottom: '16px' }} />
              <div style={{ display: 'inline-block', background: '#fef3c7', color: '#d97706', fontWeight: 700, fontSize: '12px', padding: '4px 12px', borderRadius: '999px', marginBottom: '8px' }}>
                QUEST STATUS PENDAFTARAN
              </div>
              <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '28px', marginBottom: '8px' }}>
                Selesaikan Quest Pendaftaran
              </h1>
              <p style={{ color: 'var(--text)', opacity: 0.8, fontSize: '14px', maxWidth: '440px', margin: '0 auto', lineHeight: 1.6 }}>
                Selesaikan semua langkah quest wajib di bawah ini, lalu klik tombol <strong style={{ color: 'var(--primary)' }}>Verifikasi</strong> untuk menyelesaikan pendaftaranmu di <strong style={{ color: 'var(--text)', opacity: 1 }}>{program.title}</strong>.
              </p>
            </>
          )}
        </motion.div>

        {/* WHATSAPP GROUP CARD (VISIBLE WHEN VERIFIED) */}
        {isVerified && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '20px',
              padding: '24px',
              color: 'white',
              marginBottom: '32px',
              textAlign: 'center'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <motion.svg 
                width="190" 
                height="160" 
                viewBox="0 0 200 170" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                animate={{
                  y: [0, -8, 0],
                  rotate: [-2, 2, -2],
                  scale: [1, 1.025, 1]
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.18))' }}
              >
                {/* Feet */}
                <rect x="68" y="142" width="22" height="18" rx="8" fill="#1d4ed8" />
                <rect x="110" y="142" width="22" height="18" rx="8" fill="#1d4ed8" />

                {/* Ears */}
                <path d="M 46 45 C 32 10 68 18 72 40 Z" fill="#2563eb" />
                <path d="M 52 42 C 40 18 64 24 66 38 Z" fill="#93c5fd" opacity="0.6" />
                
                <path d="M 154 45 C 168 10 132 18 128 40 Z" fill="#2563eb" />
                <path d="M 148 42 C 160 18 136 24 134 38 Z" fill="#93c5fd" opacity="0.6" />

                {/* Body */}
                <ellipse cx="100" cy="96" rx="68" ry="56" fill="#3b82f6" />
                
                {/* Light Blue Face Patch */}
                <ellipse cx="100" cy="85" rx="52" ry="40" fill="#bfdbfe" opacity="0.9" />

                {/* Eyes */}
                <ellipse cx="74" cy="80" rx="16" ry="19" fill="#0f172a" />
                <circle cx="70" cy="73" r="6" fill="#ffffff" />
                <circle cx="80" cy="87" r="2.5" fill="#ffffff" opacity="0.8" />

                <ellipse cx="126" cy="80" rx="16" ry="19" fill="#0f172a" />
                <circle cx="122" cy="73" r="6" fill="#ffffff" />
                <circle cx="132" cy="87" r="2.5" fill="#ffffff" opacity="0.8" />

                {/* Nose & Smile */}
                <ellipse cx="100" cy="94" rx="3.5" ry="2.5" fill="#0f172a" />
                <path d="M 91 101 Q 100 114 109 101 Z" fill="#ef4444" stroke="#0f172a" strokeWidth="2" />
                <path d="M 94 101 Q 100 106 106 101" fill="#ffffff" opacity="0.9" />

                {/* Right Arm (Waving) */}
                <path d="M 162 90 C 185 80 188 65 178 60 C 172 57 166 66 160 80 Z" fill="#2563eb" />

                {/* Megaphone & Left Arm */}
                <g transform="translate(12, 68) rotate(-12)">
                  {/* Soundwaves */}
                  <path d="M -2 15 Q -10 30 -2 45" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M -10 20 Q -17 30 -10 40" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Megaphone Cone */}
                  <path d="M 38 30 L 8 10 L 8 50 Z" fill="#2563eb" stroke="#0f172a" strokeWidth="3.5" />
                  <ellipse cx="8" cy="30" rx="4" ry="20" fill="#60a5fa" stroke="#0f172a" strokeWidth="2" />
                  <rect x="34" y="24" width="16" height="12" rx="3" fill="#60a5fa" stroke="#0f172a" strokeWidth="2" />
                  
                  {/* Left Paw holding Megaphone */}
                  <ellipse cx="44" cy="36" rx="9" ry="8" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
                </g>
              </motion.svg>
            </div>
            <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '20px', lineHeight: 1.5 }}>
              Bergabunglah sekarang ke grup WhatsApp resmi relawan untuk berdiskusi, mendapatkan info brief, dan jadwal kegiatan.
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '14px 28px',
                borderRadius: '999px',
                background: '#ffffff',
                color: '#059669',
                fontWeight: 800,
                fontSize: '15px',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                transition: 'transform 0.2s'
              }}
            >
              <FiMessageCircle size={20} /> Gabung Grup WhatsApp
            </a>
          </motion.div>
        )}

        {/* INSTRUCTIONS & QUEST CARD */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.04)'
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Langkah Quest Pendaftaran</span>
            <span style={{ fontSize: '12px', background: isVerified ? '#dcfce7' : '#fef3c7', color: isVerified ? '#15803d' : '#d97706', padding: '4px 10px', borderRadius: '100px', fontWeight: 600 }}>
              {isVerified ? 'Selesai' : 'Wajib'}
            </span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* STEP 1: TWIBBON */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: hasUploadedTwibbon ? '#10b981' : 'var(--primary)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0
              }}>
                {hasUploadedTwibbon ? <FiCheckCircle size={18} /> : '1'}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Upload 'Your’re invited to'</h3>
                <p style={{ fontSize: '14px', opacity: 0.75, marginBottom: '14px', lineHeight: 1.5 }}>
                  Download dan Upload gambar di bawah kedalam instagram story pribadi dan tag @untukesok jangan lupa isi kolom kosong dengan nama mu! Selamat menjadi bagian dari agent of change!
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {program.twibbonLink ? (
                    <a
                      href={program.twibbonLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}
                    >
                      <FiDownload /> Unduh Template 'Your're invited to'
                    </a>
                  ) : (
                    <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.03)', fontSize: '13px', color: 'var(--text)', opacity: 0.6, border: '1px dashed var(--card-border)' }}>
                      *Template 'Your're invited to' tersedia.
                    </div>
                  )}

                  <button
                    onClick={() => setHasUploadedTwibbon(true)}
                    disabled={hasUploadedTwibbon || isVerified}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', border: 'none',
                      background: hasUploadedTwibbon ? '#10b981' : 'var(--primary)',
                      color: 'white', fontWeight: 600, cursor: (hasUploadedTwibbon || isVerified) ? 'default' : 'pointer', fontSize: '14px',
                      transition: 'background 0.3s'
                    }}
                  >
                    {hasUploadedTwibbon ? (
                      <><FiCheckCircle /> Saya Sudah Upload</>
                    ) : (
                      <><FiImage /> Konfirmasi Sudah Upload</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ width: '100%', height: '1px', background: 'var(--card-border)' }}></div>

            {/* STEP 2: FOLLOW IG & BUKTI */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: igProof ? '#10b981' : 'var(--primary)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0
              }}>
                {igProof ? <FiCheckCircle size={18} /> : '2'}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Follow Instagram & Upload Bukti</h3>
                <p style={{ fontSize: '14px', opacity: 0.75, marginBottom: '14px', lineHeight: 1.5 }}>
                  Wajib follow Instagram <a href="https://instagram.com/untukesok" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>@untukesok</a> dan unggah bukti tangkapan layar (screenshot).
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="file"
                    id="ig-proof"
                    accept="image/*"
                    disabled={isVerified}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setIgProof(e.target.files[0]);
                      }
                    }}
                  />
                  <label
                    htmlFor="ig-proof"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px',
                      border: igProof ? 'none' : '1px solid var(--primary)',
                      background: igProof ? '#10b981' : 'transparent',
                      color: igProof ? 'white' : 'var(--primary)', fontWeight: 600,
                      cursor: isVerified ? 'default' : 'pointer', fontSize: '14px',
                      transition: 'all 0.3s'
                    }}
                  >
                    {igProof ? (
                      <><FiCheckCircle /> Bukti Terunggah: {igProof.name}</>
                    ) : (
                      <><FiUpload /> Unggah Bukti Screenshot</>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div style={{ width: '100%', height: '1px', background: 'var(--card-border)' }}></div>

            {/* STEP 3: WHATSAPP GROUP INFO */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: isVerified ? '#10b981' : 'rgba(0,0,0,0.1)',
                color: isVerified ? 'white' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0
              }}>
                {isVerified ? <FiCheckCircle size={18} /> : '3'}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Gabung Grup WhatsApp</h3>
                <p style={{ fontSize: '14px', opacity: 0.75, marginBottom: '14px', lineHeight: 1.5 }}>
                  Bergabunglah ke grup WhatsApp khusus relawan untuk mendapatkan berita & briefing langsung dari panitia.
                </p>

                {isVerified ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', border: 'none', background: '#25D366', color: 'white', fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}
                  >
                    <FiMessageCircle size={18} /> Gabung Grup WhatsApp
                  </a>
                ) : (
                  <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.03)', fontSize: '13px', color: 'var(--text)', opacity: 0.6, border: '1px dashed var(--card-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiAlertCircle size={16} /> Link grup WhatsApp terbuka setelah kamu mengklik tombol Verifikasi di bawah.
                  </div>
                )}
              </div>
            </div>

          </div>
        </motion.div>

        {/* QUOTA FULL BANNER */}
        {isFull && !isVerified && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: '24px',
              padding: '16px 20px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #fee2e2, #fef2f2)',
              border: '1px solid #fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#dc2626'
            }}
          >
            <FiAlertCircle size={22} style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: '0 0 4px 0', fontWeight: 700 }}>Kuota Relawan Penuh</p>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, opacity: 0.85 }}>
                Maaf, kuota pendaftaran untuk program ini sudah penuh. Pendaftaran ditutup secara otomatis.
              </p>
            </div>
          </motion.div>
        )}

        {/* BOTTOM ACTION BUTTON */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ marginTop: '28px', textAlign: 'center' }}
        >
          {isVerified ? (
            <button
              onClick={() => router.push('/account')}
              style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}
            >
              Lihat Akun Saya
            </button>
          ) : (
            <>
              <button
                onClick={handleVerify}
                disabled={!isAllStepsCompleted || isVerifying || isFull}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '16px',
                  background: (!isAllStepsCompleted || isVerifying || isFull) ? '#cbd5e1' : 'var(--primary)',
                  border: 'none',
                  color: 'white',
                  fontWeight: 700,
                  cursor: (!isAllStepsCompleted || isVerifying || isFull) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  boxShadow: (isAllStepsCompleted && !isFull) ? '0 6px 20px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                {isFull ? 'Kuota Penuh — Pendaftaran Ditutup' : isVerifying ? 'Memverifikasi Pendaftaran...' : 'Verifikasi'}
              </button>
              {!isAllStepsCompleted && !isFull && (
                <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '10px', fontWeight: 600 }}>
                  * Harap selesaikan Step 1 (Upload Twibbon) dan Step 2 (Unggah Bukti Follow IG) untuk mengaktifkan tombol Verifikasi.
                </p>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
