'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  FiUser, FiMail, FiCheckCircle, FiAward, 
  FiSettings, FiHelpCircle, FiLogOut, FiChevronRight, 
  FiArrowLeft, FiHeart, FiFileText, FiShield, 
  FiBell, FiCalendar, FiMapPin, FiClock 
} from 'react-icons/fi';
import { useAuth } from '../../src/context/AuthContext';
import { db, auth, googleProvider } from '../../src/lib/firebase';
import { signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, updateProfile } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, increment } from 'firebase/firestore';

const containerVariants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const itemVariants = {
  hidden: { y: 0, opacity: 1 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 120 } }
};

export default function Account() {
  const router = useRouter();

  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'activities', 'certificates', 'settings'
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [myPrograms, setMyPrograms] = useState([]);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // Guest Form State
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  
  // Cancel Registration State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelingApp, setCancelingApp] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  
  // Fetch applied programs
  useEffect(() => {
    if (!user) {
      setMyPrograms([]);
      return;
    }
    
    const q = query(collection(db, 'applications'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const progs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyPrograms(progs);
    });
    
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Simpan profil Google ke koleksi users
      await setDoc(doc(db, 'users', result.user.uid), {
        name: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        role: 'user',
        lastLoginAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error("Login failed:", error);
      alert("Gagal login dengan Google.");
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          role: 'user',
          createdAt: new Date().toISOString()
        });
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', result.user.uid), {
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (error) {
      console.error("Auth error:", error);
      if (error.code === 'auth/email-already-in-use') setAuthError('Email ini sudah terdaftar.');
      else if (error.code === 'auth/invalid-credential') setAuthError('Email atau kata sandi salah.');
      else if (error.code === 'auth/weak-password') setAuthError('Kata sandi terlalu lemah (minimal 6 karakter).');
      else setAuthError(error.message);
    }
  };

  const handleAnonymousLogin = async (e) => {
    e?.preventDefault();
    if (showGuestForm) {
      // Validate Indo Phone
      const phoneRegex = /^(?:\+62|62|0)8[1-9][0-9]{6,11}$/;
      if (!phoneRegex.test(guestPhone)) {
        setAuthError('Mohon masukkan nomor telepon Indonesia yang valid (contoh: 08123456789).');
        return;
      }
      if (guestName.trim().length < 3) {
        setAuthError('Nama minimal 3 karakter.');
        return;
      }

      setAuthError('');
      try {
        const userCred = await signInAnonymously(auth);
        
        // Perbarui profil auth dengan nama tamu
        await updateProfile(userCred.user, {
          displayName: guestName
        });

        // Simpan data tamu ke Firestore
        await setDoc(doc(db, 'users', userCred.user.uid), {
          name: guestName,
          phone: guestPhone,
          role: 'guest',
          createdAt: new Date().toISOString()
        });
        
        setShowGuestForm(false);
      } catch (error) {
        console.error("Anonymous login failed:", error);
        setAuthError("Gagal masuk sebagai tamu.");
      }
    } else {
      setShowGuestForm(true);
      setAuthError('');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowLogoutModal(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleCancelApplication = async (e) => {
    e.preventDefault();
    if (!cancelingApp) return;

    try {
      await updateDoc(doc(db, 'applications', cancelingApp.id), {
        status: 'Dibatalkan',
        cancelReason: cancelReason,
        canceledAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'programs', cancelingApp.programId), {
        volunteersJoined: increment(-1)
      });

      setCancelModalOpen(false);
      setCancelingApp(null);
      setCancelReason('');
      alert('Pendaftaran Anda telah berhasil dibatalkan.');
    } catch (error) {
      console.error("Error canceling application:", error);
      alert('Terjadi kesalahan saat membatalkan pendaftaran.');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="home-content">
      {/* ── TOP FIXED ANCHORED HEADER ── */}
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
          Akun Saya
        </h1>
      </div>

      <div className="news-page-container" style={{ paddingTop: '80px', paddingBottom: '120px' }}>
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          
          {/* LOADING STATE */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p>Memuat profil...</p>
            </div>
          ) : !user ? (
            <motion.div variants={itemVariants} style={{ maxWidth: '400px', margin: '0 auto', padding: '20px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>
                {isRegistering ? 'Daftar Akun' : 'Masuk Akun'}
              </h2>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '24px' }}>
                {isRegistering ? 'Buat akun baru untuk mulai berkontribusi.' : 'Masuk untuk melihat aktivitas relawan Anda.'}
              </p>

              {authError && (
                <div style={{ background: '#fef2f2', color: '#ef4444', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                  {authError}
                </div>
              )}

              {showGuestForm ? (
                <form onSubmit={handleAnonymousLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  <input 
                    type="text" 
                    placeholder="Nama Lengkap" 
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                    required
                  />
                  <input 
                    type="tel" 
                    placeholder="Nomor HP (cth: 0812...)" 
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                    required
                  />
                  <button type="submit" className="btn-primary" style={{ padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '15px', marginTop: '4px' }}>
                    Masuk Sekarang
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setShowGuestForm(false); setAuthError(''); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text)', opacity: 0.6, padding: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '4px' }}
                  >
                    Batal
                  </button>
                </form>
              ) : (
                <>
                  <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    <input 
                      type="email" 
                      placeholder="Alamat Email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                      required
                    />
                    <input 
                      type="password" 
                      placeholder="Kata Sandi" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                      required
                      minLength="6"
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '15px', marginTop: '4px' }}>
                      {isRegistering ? 'Daftar dengan Email' : 'Masuk'}
                    </button>
                  </form>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0', opacity: 0.3 }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--text)' }}></div>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>ATAU</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--text)' }}></div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button 
                      onClick={handleLogin}
                      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text)', padding: '14px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '14px' }}
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
                      Lanjutkan dengan Google
                    </button>
                    <button 
                      onClick={() => handleAnonymousLogin()}
                      style={{ background: 'transparent', border: 'none', color: 'var(--primary)', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}
                    >
                      Lanjutkan sebagai Tamu
                    </button>
                  </div>
                </>
              )}

              {!showGuestForm && (
                <p style={{ marginTop: '32px', fontSize: '14px', opacity: 0.8 }}>
                  {isRegistering ? 'Sudah punya akun? ' : 'Belum punya akun? '}
                  <button 
                    onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
                  >
                    {isRegistering ? 'Masuk di sini' : 'Daftar di sini'}
                  </button>
                </p>
              )}
            </motion.div>
          ) : (
            <>
              {/* ── PROFILE HEADER CARD (PEDULY STYLE) ── */}
              <motion.div variants={itemVariants} className="account-profile-card" style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '24px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                position: 'relative'
              }}>
                <div className="account-profile-avatar" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '22px',
                  fontFamily: 'var(--font-poppins)',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  overflow: 'hidden'
                }}>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    getInitials(user.displayName || user.email)
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h2 className="account-profile-name" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-bold)', margin: 0, fontFamily: 'var(--font-poppins)' }}>
                      {user.displayName || 'Relawan'}
                    </h2>
                    <span style={{ background: '#dcfce7', color: '#166534', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>
                      Relawan Aktif
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', opacity: 0.6, margin: 0 }}>{user.email}</p>
                </div>
              </motion.div>

              {/* ── STATS OVERVIEW CARDS ── */}
              <motion.div variants={itemVariants} className="account-stats-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '28px'
              }}>
                <div className="account-stats-card" style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '16px',
                  padding: '16px 12px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', margin: '0 0 4px 0' }}>
                    {myPrograms.filter(p => p.status !== 'Dibatalkan').length}
                  </h3>
                  <p style={{ fontSize: '11px', opacity: 0.6, margin: 0, fontWeight: 600 }}>Aktivitas Diikuti</p>
                </div>

                <div className="account-stats-card" style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '16px',
                  padding: '16px 12px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent)', margin: '0 0 4px 0' }}>
                    {myPrograms.filter(p => p.status !== 'Dibatalkan').length * 5}
                  </h3>
                  <p style={{ fontSize: '11px', opacity: 0.6, margin: 0, fontWeight: 600 }}>Jam Kontribusi</p>
                </div>

                <div className="account-stats-card" style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '16px',
                  padding: '16px 12px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', margin: '0 0 4px 0' }}>
                    0
                  </h3>
                  <p style={{ fontSize: '11px', opacity: 0.6, margin: 0, fontWeight: 600 }}>Sertifikat Digital</p>
                </div>
              </motion.div>

              {/* ── MENU GROUP: AKTIVITAS & RELAWAN ── */}
              <motion.div variants={itemVariants} style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, opacity: 0.5, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Aktivitas & Relawan
                </p>
                <div style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '20px',
                  overflow: 'hidden'
                }}>
                  <div 
                    onClick={() => setActiveTab(activeTab === 'activities' ? 'profile' : 'activities')}
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--card-border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiHeart size={18} />
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-bold)' }}>Aktivitas Relawan Saya</span>
                    </div>
                    <FiChevronRight size={18} style={{ opacity: 0.5 }} />
                  </div>

                  <div 
                    onClick={() => setActiveTab(activeTab === 'certificates' ? 'profile' : 'certificates')}
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(234, 179, 8, 0.15)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiAward size={18} />
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-bold)' }}>Sertifikat Digital</span>
                    </div>
                    <FiChevronRight size={18} style={{ opacity: 0.5 }} />
                  </div>
                </div>
              </motion.div>

              {/* ── EXPANDABLE CONTENT SECTION (ACTIVITIES / CERTIFICATES) ── */}
              <AnimatePresence>
                {activeTab === 'activities' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ marginBottom: '28px' }}
                  >
                    {/* AKTIVITAS AKTIF (TERDAFTAR) */}
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>Daftar Aktivitas Terdaftar</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                      {myPrograms.filter(p => p.status !== 'Dibatalkan').length === 0 ? (
                        <p style={{ fontSize: '14px', opacity: 0.6 }}>Belum ada aktivitas aktif yang Anda ikuti.</p>
                      ) : (
                        myPrograms.filter(p => p.status !== 'Dibatalkan').map(prog => (
                          <div 
                            key={prog.id} 
                            onClick={() => router.push(`/programs/${prog.programId}/invoice`)}
                            style={{
                              background: 'var(--card-bg)',
                              border: '1px solid var(--card-border)',
                              borderRadius: '16px',
                              padding: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '14px',
                              cursor: 'pointer',
                              transition: 'transform 0.2s, box-shadow 0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            <img src={prog.programImageUrl} alt={prog.programTitle} style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover' }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: prog.status === 'Selesai' ? '#10b981' : 'var(--primary)', textTransform: 'uppercase' }}>{prog.status}</span>
                              <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '2px 0 4px 0' }}>{prog.programTitle}</h4>
                              <p style={{ fontSize: '12px', opacity: 0.6, margin: 0 }}>{prog.programDate} • {prog.programLocation}</p>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {prog.status === 'Terdaftar' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCancelingApp(prog);
                                    setCancelModalOpen(true);
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    background: '#fef2f2',
                                    color: '#ef4444',
                                    border: '1px solid #fecaca',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Batalkan
                                </button>
                              )}
                              <FiChevronRight size={20} color="var(--primary)" style={{ opacity: 0.5 }} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* RIWAYAT PEMBATALAN */}
                    {myPrograms.filter(p => p.status === 'Dibatalkan').length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          Riwayat Pembatalan Pendaftaran
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {myPrograms.filter(p => p.status === 'Dibatalkan').map(prog => (
                            <div 
                              key={prog.id} 
                              onClick={() => router.push(`/programs/${prog.programId}`)}
                              style={{
                                background: 'var(--card-bg)',
                                border: '1px border-dashed #fca5a5',
                                borderRadius: '16px',
                                padding: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                opacity: 0.85,
                                cursor: 'pointer'
                              }}
                            >
                              <img src={prog.programImageUrl} alt={prog.programTitle} style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', filter: 'grayscale(60%)' }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Dibatalkan</span>
                                  {prog.canceledAt && (
                                    <span style={{ fontSize: '11px', opacity: 0.5 }}>{new Date(prog.canceledAt).toLocaleDateString('id-ID')}</span>
                                  )}
                                </div>
                                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '4px 0' }}>{prog.programTitle}</h4>
                                {prog.cancelReason && (
                                  <p style={{ fontSize: '12px', color: '#ef4444', margin: '2px 0 0 0', fontStyle: 'italic' }}>Alasan: {prog.cancelReason}</p>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/programs/${prog.programId}`);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  background: 'var(--primary)',
                                  color: 'white',
                                  border: 'none',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Daftar Lagi
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'certificates' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ marginBottom: '28px' }}
                  >
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>Sertifikat Relawan Saya</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {myPrograms.filter(p => p.certificateUrl).length === 0 ? (
                        <p style={{ fontSize: '14px', opacity: 0.6 }}>Anda belum memiliki sertifikat.</p>
                      ) : (
                        myPrograms.filter(p => p.certificateUrl).map(cert => (
                          <div key={cert.id} style={{
                            background: 'var(--card-bg)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '16px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(234, 179, 8, 0.15)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FiAward size={24} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0' }}>{cert.programTitle}</h4>
                                <p style={{ fontSize: '12px', opacity: 0.6, margin: 0, fontFamily: 'monospace' }}>ID: {cert.credentialId}</p>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', background: '#f8f9fa', padding: '16px', borderRadius: '12px', border: '1px dashed #ccc' }}>
                              <div style={{ background: 'white', padding: '8px', borderRadius: '8px', border: '1px solid #eaeaea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${typeof window !== 'undefined' ? encodeURIComponent(`${window.location.origin}/verify/${cert.credentialId}`) : ''}`}
                                  alt="QR Code Sertifikat"
                                  style={{ width: '80px', height: '80px' }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                                  Pindai QR ini untuk memverifikasi keaslian sertifikat Anda.
                                </p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <a href={cert.certificateUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 12px', background: 'var(--primary)', color: 'white', borderRadius: '8px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                                    Lihat / Unduh
                                  </a>
                                  <a href={`/verify/${cert.credentialId}`} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 12px', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '8px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                                    Halaman Verifikasi
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── MENU GROUP: PENGATURAN & BANTUAN ── */}
              <motion.div variants={itemVariants} style={{ marginBottom: '28px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, opacity: 0.5, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Pengaturan & Bantuan
                </p>
                <div style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '20px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--card-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiShield size={18} />
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-bold)' }}>Keamanan & Sandi</span>
                    </div>
                    <FiChevronRight size={18} style={{ opacity: 0.5 }} />
                  </div>

                  <div style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiHelpCircle size={18} />
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-bold)' }}>Pusat Bantuan & FAQ</span>
                    </div>
                    <FiChevronRight size={18} style={{ opacity: 0.5 }} />
                  </div>
                </div>
              </motion.div>

              {/* ── LOGOUT BUTTON (PEDULY STYLE) ── */}
              <motion.div variants={itemVariants}>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '16px',
                    border: '1px solid #fee2e2',
                    background: '#fff1f2',
                    color: '#e11d48',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontFamily: 'var(--font-poppins)'
                  }}
                >
                  <FiLogOut size={18} /> Keluar dari Akun
                </button>
              </motion.div>

              {/* Logout Confirmation Modal */}
              <AnimatePresence>
                {showLogoutModal && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                      zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '20px'
                    }}
                  >
                    <motion.div 
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.95 }}
                      style={{
                        background: 'var(--card-bg)',
                        borderRadius: '24px',
                        padding: '24px',
                        maxWidth: '360px',
                        width: '100%',
                        textAlign: 'center'
                      }}
                    >
                      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Keluar dari akun?</h2>
                      <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '24px' }}>Anda harus login kembali untuk melihat tiket dan riwayat donasi Anda.</p>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          onClick={() => setShowLogoutModal(false)}
                          style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'transparent', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Batal
                        </button>
                        <button 
                          onClick={handleLogout}
                          style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Ya, Keluar
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cancel Registration Modal */}
              {cancelModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <motion.div 
                    initial={{ y: '100%' }} animate={{ y: 0 }}
                    style={{ width: '100%', maxWidth: '480px', background: 'var(--bg)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '32px' }}
                  >
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Batalkan Pendaftaran</h2>
                    <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '24px' }}>
                      Anda akan membatalkan partisipasi di <strong>{cancelingApp?.programTitle}</strong>. Mohon sertakan alasan agar panitia mengetahuinya.
                    </p>
                    <form onSubmit={handleCancelApplication}>
                      <textarea
                        required
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Misal: Saya ada jadwal mendadak..."
                        rows={4}
                        style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', outline: 'none', marginBottom: '24px', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          type="button"
                          onClick={() => { setCancelModalOpen(false); setCancelReason(''); }}
                          style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'transparent', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Batal
                        </button>
                        <button 
                          type="submit"
                          style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Kirim & Batalkan
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </>
          )}

        </motion.div>
      </div>
    </div>
  );
}
