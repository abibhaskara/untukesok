'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FiHome, FiList, FiFileText, FiUsers, FiUserCheck, FiLogOut, FiShield, FiLock, FiAlertTriangle, FiKey, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../../src/context/AuthContext';
import { db, auth, googleProvider } from '../../src/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';

// Superadmin Whitelist Emails & Passcode
const ADMIN_EMAILS = [
  'abibhaskaramulya@gmail.com',
  'rashaaz031@gmail.com',
  'kiran.nalini888@gmail.com'
];
const ADMIN_PASSCODE = '2026';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    // Check session PIN unlock state
    if (typeof window !== 'undefined') {
      const unlocked = sessionStorage.getItem('admin_session_unlocked') === 'true';
      setPinUnlocked(unlocked);
    }
  }, []);

  useEffect(() => {
    const verifyAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setCheckingRole(false);
        return;
      }

      setCheckingRole(true);
      const isSuperAdminEmail = Boolean(user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.role === 'admin' || isSuperAdminEmail) {
            setIsAdmin(true);
            if (isSuperAdminEmail && userData.role !== 'admin') {
              const { setDoc } = await import('firebase/firestore');
              await setDoc(userDocRef, { role: 'admin' }, { merge: true });
            }
          } else {
            setIsAdmin(false);
          }
        } else if (isSuperAdminEmail) {
          setIsAdmin(true);
          const { setDoc } = await import('firebase/firestore');
          await setDoc(userDocRef, { email: user.email, name: user.displayName || 'Admin', role: 'admin', createdAt: new Date().toISOString() }, { merge: true });
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Gagal memverifikasi hak akses admin:", err);
        if (isSuperAdminEmail) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } finally {
        setCheckingRole(false);
      }
    };

    if (!authLoading) {
      verifyAdminRole();
    }
  }, [user, authLoading]);

  const handleAdminGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Gagal login admin:", err);
      alert("Gagal melakukan autentikasi login.");
    }
  };

  const handleSignOut = async () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('admin_session_unlocked');
      }
      await signOut(auth);
      router.push('/');
    } catch (err) {
      console.error("Gagal keluar:", err);
    }
  };

  const handleUnlockPin = (e) => {
    e.preventDefault();
    if (pinInput === ADMIN_PASSCODE) {
      setPinUnlocked(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('admin_session_unlocked', 'true');
      }
      setPinError('');
    } else {
      setPinError('PIN / Passcode Keamanan Salah.');
    }
  };

  const handleLockSession = () => {
    setPinUnlocked(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_session_unlocked');
    }
  };

  const menuItems = [
    { name: 'Beranda Admin', path: '/admin', icon: <FiHome /> },
    { name: 'Kelola Program', path: '/admin/programs', icon: <FiList /> },
    { name: 'Kelola Berita', path: '/admin/news', icon: <FiFileText /> },
    { name: 'Pendaftar / Sertifikat', path: '/admin/applications', icon: <FiUsers /> },
    { name: 'Daftar Akun Terdaftar', path: '/admin/users', icon: <FiUserCheck /> },
  ];

  // 1. LOADING STATE
  if (authLoading || checkingRole) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', fontFamily: 'var(--font-poppins)' }}>
        <FiShield size={56} style={{ color: 'var(--primary)', marginBottom: '20px', animation: 'pulse 1.5s infinite' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Verifikasi Keamanan System</h2>
        <p style={{ fontSize: '13px', opacity: 0.6 }}>Memeriksa hak akses administrator...</p>
      </div>
    );
  }

  // 2. UNAUTHENTICATED (LOGIN REQUIRED)
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '24px', fontFamily: 'var(--font-poppins)' }}>
        <div style={{ background: 'white', borderRadius: '24px', padding: '40px', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: '#eff6ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <FiLock size={32} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Portal Admin Terkunci</h1>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '28px', lineHeight: 1.5 }}>
            Silakan masuk dengan akun Administrator resmi untuk mengakses dashboard pengelolaan.
          </p>

          <button
            onClick={handleAdminGoogleLogin}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Login Administrator Google
          </button>

          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
            <Link href="/" style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FiArrowLeft /> Kembali ke Beranda Utama
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. AUTHORIZATION FAILED (FORBIDDEN / NOT AN ADMIN)
  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '24px', fontFamily: 'var(--font-poppins)' }}>
        <div style={{ background: 'white', borderRadius: '24px', padding: '40px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <FiAlertTriangle size={32} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#991b1b', marginBottom: '8px' }}>403 Akses Ditolak</h1>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px', lineHeight: 1.6 }}>
            Akun Anda <strong style={{ color: '#0f172a' }}>{user.email || user.displayName}</strong> tidak memiliki otorisasi sebagai <strong>Administrator</strong>.
          </p>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', fontSize: '12px', color: '#475569', marginBottom: '28px', border: '1px solid #e2e8f0' }}>
            🔒 Peran akun Anda saat ini: <strong>Relawan (User)</strong>. Silakan hubungi Superadmin untuk mendapatkan hak akses.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleSignOut}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Ganti Akun / Keluar
            </button>
            <Link href="/" style={{ padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 600, fontSize: '14px', textDecoration: 'none', textAlign: 'center' }}>
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. SECONDARY SECURITY PIN LOCK SCREEN (SESSION LOCK)
  if (!pinUnlocked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '24px', fontFamily: 'var(--font-poppins)' }}>
        <div style={{ background: 'white', borderRadius: '24px', padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: '#eff6ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <FiKey size={32} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>Keamanan PIN Sesi Admin</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
            Masukkan PIN Keamanan Admin untuk membuka dashboard.
          </p>

          <form onSubmit={handleUnlockPin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="password"
              placeholder="Masukkan PIN Admin (contoh: 2026)"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                textAlign: 'center',
                fontSize: '18px',
                letterSpacing: '4px',
                fontWeight: 700,
                outline: 'none'
              }}
              autoFocus
            />

            {pinError && (
              <p style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, margin: 0 }}>{pinError}</p>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              Buka Dashboard
            </button>
          </form>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
            <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
              Keluar Akun Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. FULL ADMIN ACCESS GRANTED
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Sidebar */}
      <aside style={{ width: '250px', background: 'white', borderRight: '1px solid #eaeaea', padding: '24px 0', position: 'fixed', height: '100vh', overflowY: 'auto' }}>
        <div style={{ padding: '0 24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '20px', margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-playfair)' }}>Untuk Esok</h2>
            <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>PRO</span>
          </div>
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Admin Dashboard</p>
        </div>

        {/* User Info Pill */}
        <div style={{ padding: '0 16px', marginBottom: '20px' }}>
          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
              {(user.displayName || user.email || 'A').charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.displayName || 'Admin'}</div>
              <div style={{ fontSize: '10px', color: '#166534', fontWeight: 600 }}>● Authenticated</div>
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 12px' }}>
          {menuItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                href={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: isActive ? 'var(--primary)' : '#475569',
                  background: isActive ? '#fff0e6' : 'transparent',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div style={{ position: 'absolute', bottom: '20px', width: '100%', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={handleLockSession}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#f1f5f9',
              border: 'none',
              color: '#475569',
              width: '100%',
              cursor: 'pointer',
              textAlign: 'left',
              fontWeight: 600,
              fontSize: '12px'
            }}
          >
            <FiLock style={{ fontSize: '15px' }} />
            Kunci Sesi
          </button>

          <button
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              color: '#dc2626',
              width: '100%',
              cursor: 'pointer',
              textAlign: 'left',
              fontWeight: 600,
              fontSize: '12px'
            }}
          >
            <FiLogOut style={{ fontSize: '15px' }} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: '250px', padding: '40px' }}>
        {children}
      </main>
    </div>
  );
}
