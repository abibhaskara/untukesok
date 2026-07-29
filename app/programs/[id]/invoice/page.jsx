'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiCheckCircle, FiDownload, FiMessageCircle, FiImage, FiInstagram, FiUpload, FiAlertCircle, FiClock } from 'react-icons/fi';
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

      // Record to applications collection in Firestore
      if (existingCancelAppId) {
        await updateDoc(doc(db, 'applications', existingCancelAppId), {
          status: 'Terdaftar',
          appliedAt: new Date().toISOString(),
          cancelReason: '',
          canceledAt: ''
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
          credentialId: `CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
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
              <div style={{ display: 'inline-block', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '12px', padding: '4px 12px', borderRadius: '999px', marginBottom: '8px' }}>
                STATUS: SUDAH TERDAFTAR
              </div>
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
              boxShadow: '0 10px 25px rgba(16, 185, 129, 0.25)',
              textAlign: 'center'
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <FiMessageCircle size={24} color="#ffffff" />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Grup WhatsApp Relawan</h3>
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
                background: Boolean(igProof) ? '#10b981' : 'var(--primary)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0
              }}>
                {Boolean(igProof) ? <FiCheckCircle size={18} /> : '2'}
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
                disabled={!isAllStepsCompleted || isVerifying}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '16px',
                  background: (!isAllStepsCompleted || isVerifying) ? '#cbd5e1' : 'var(--primary)',
                  border: 'none',
                  color: 'white',
                  fontWeight: 700,
                  cursor: (!isAllStepsCompleted || isVerifying) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  boxShadow: isAllStepsCompleted ? '0 6px 20px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                {isVerifying ? 'Memverifikasi Pendaftaran...' : 'Verifikasi'}
              </button>
              {!isAllStepsCompleted && (
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
