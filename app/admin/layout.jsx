'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiGrid, FiBriefcase, FiUsers, FiAward, FiFileText,
  FiArrowLeft, FiLogOut, FiMenu, FiX,
  FiDollarSign, FiBarChart2, FiRefreshCw,
  FiMessageSquare, FiInbox
} from 'react-icons/fi';
import { useAuth } from '../../src/context/AuthContext';
import { AdminDataProvider, useAdminData } from '../../src/context/AdminDataContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

const DEPARTMENTS = [
  { id: 'ringkasan', label: 'Ringkasan', href: '/admin', icon: FiGrid, group: 'Sentral' },
  { id: 'analitik', label: 'Analitik', href: '/admin/analitik', icon: FiBarChart2, group: 'Sentral' },
  { id: 'kegiatan', label: 'Kegiatan', href: '/admin/kegiatan', icon: FiBriefcase, group: 'Operasional' },
  { id: 'relawan', label: 'Relawan', href: '/admin/relawan', icon: FiAward, group: 'Operasional', showBadge: true },
  { id: 'ulasan', label: 'Ulasan', href: '/admin/ulasan', icon: FiMessageSquare, group: 'Operasional' },
  { id: 'keuangan', label: 'Keuangan', href: '/admin/keuangan', icon: FiDollarSign, group: 'Operasional' },
  { id: 'pengguna', label: 'Pengguna', href: '/admin/pengguna', icon: FiUsers, group: 'Operasional' },
  { id: 'berita', label: 'Berita', href: '/admin/berita', icon: FiFileText, group: 'Operasional' },
  { id: 'suara', label: 'Kotak Suara', href: '/admin/suara', icon: FiInbox, group: 'Operasional' }
];

function TopBarControls({ onOpenMobileMenu }) {
  const adminData = useAdminData();

  return (
    <header className="admin-top">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="admin-mobile-toggle ue-icon-btn"
        aria-label="Buka navigasi"
      >
        <FiMenu size={18} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
        <div className="ue-sync-status">
          <span className="ue-sync-dot" />
          <span>{adminData?.isLoading ? 'Menyinkronkan data…' : 'Data tersinkron'}</span>
        </div>

        {adminData && (
          <button
            type="button"
            onClick={adminData.refreshAdminData}
            disabled={adminData.isLoading}
            className="ue-icon-btn"
            title="Segarkan data dari Firestore"
          >
            <FiRefreshCw size={16} style={{ animation: adminData.isLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        )}
      </div>
    </header>
  );
}

function SidebarActionBadge() {
  const adminData = useAdminData();
  if (!adminData?.applications) return null;
  const count = adminData.applications.filter(
    a => ((a.paymentProofUrl || a.storyProofUrl || a.igProofUrl) && a.status === 'Terdaftar') ||
      (a.status === 'Selesai' && !a.certificateUrl && !a.noCertificate)
  ).length;
  if (count <= 0) return null;
  return <span className="ue-nav-badge">{count}</span>;
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const { user, currentUser: ctxUser, loading: authLoading, loginWithGoogle, logout } = useAuth();
  const currentUser = ctxUser || user;
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isFirestoreAdmin, setIsFirestoreAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (authLoading) return;
    let isMounted = true;
    async function verifyUser() {
      if (!currentUser) {
        if (isMounted) {
          setIsFirestoreAdmin(false);
          setCheckingRole(false);
        }
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (isMounted) {
          const data = userDoc?.exists() ? userDoc.data() : null;
          setIsFirestoreAdmin(Boolean(data && (data.role === 'admin' || data.isAdmin === true)));
          setCheckingRole(false);
        }
      } catch {
        if (isMounted) {
          setIsFirestoreAdmin(false);
          setCheckingRole(false);
        }
      }
    }
    setCheckingRole(true);
    verifyUser();
    return () => { isMounted = false; };
  }, [currentUser, authLoading]);

  const isAuthorized = Boolean(currentUser && isFirestoreAdmin);

  const handleAdminLogin = async () => {
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setLoginError('Jendela login Google ditutup sebelum selesai.');
      } else if (err?.code === 'auth/popup-blocked') {
        setLoginError('Popup diblokir oleh browser. Izinkan popup untuk situs ini lalu coba lagi.');
      } else {
        setLoginError('Gagal masuk dengan Google. Silakan coba lagi.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';
  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const baseStyles = `
    :root {
      --navy: #233B69;
      --navy-deep: #1A2D52;
      --navy-tint: #EEF2F8;
      --primary: #233B69;
      --card-bg: #FFFFFF;
      --card-border: #E2E8F0;
      --text: #0F172A;
      --accent: #FFBD59;
      --accent-tint: #FFF7EA;
      --accent-line: #FFE2B0;
      --ground: #F8FAFC;
      --surface: #FFFFFF;
      --surface-subtle: #F8FAFC;
      --active: #EEF2F8;
      --hover: #F1F5F9;
      --ink: #0F172A;
      --ink-secondary: #334155;
      --muted: #64748B;
      --crumb: #94A3B8;
      --hairline: #E2E8F0;
      --border-strong: #CBD5E1;
      --pos: #166534;
      --pos-bg: #DCFCE7;
      --pos-ink: #166534;
      --neg: #991B1B;
      --neg-bg: #FEE2E2;
      --neg-ink: #991B1B;
      --warn: #B45309;
      --warn-bg: #FEF3C7;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .admin-shell,
    .admin-shell input,
    .admin-shell select,
    .admin-shell textarea,
    .admin-shell button,
    .admin-shell table,
    .admin-shell h1,
    .admin-shell h2,
    .admin-shell h3,
    .admin-shell h4 {
      font-family: var(--font-poppins), 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .admin-shell {
      display: grid;
      grid-template-columns: 256px 1fr;
      grid-template-rows: 72px 1fr;
      min-height: 100vh;
      background: var(--ground);
      color: var(--ink);
      font-size: 13.5px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .admin-side {
      grid-row: 1 / -1;
      background: var(--surface);
      border-right: 1px solid var(--hairline);
      padding: 24px 16px 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      user-select: none;
    }
    .admin-top {
      grid-column: 2;
      background: var(--surface);
      border-bottom: 1px solid var(--hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 40px;
      gap: 16px;
    }
    .admin-work {
      grid-column: 2;
      padding: 32px 40px 48px 40px;
      overflow-x: auto;
    }
    .ue-search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      height: 42px;
      padding: 0 14px;
      background: var(--ground);
      border: 1px solid var(--hairline);
      border-radius: 10px;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .ue-search-box:focus-within {
      background: var(--surface);
      border-color: var(--navy);
    }
    .ue-search-input {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      font-family: inherit;
      font-size: 13px;
      color: var(--ink);
    }
    .ue-search-input::placeholder {
      color: var(--crumb);
    }
    .ue-kbd {
      font-family: inherit;
      font-size: 11px;
      font-weight: 500;
      color: var(--muted);
      background: var(--surface);
      border: 1px solid var(--hairline);
      border-radius: 6px;
      padding: 1px 6px;
    }
    .ue-sync-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--muted);
      padding-right: 4px;
    }
    .ue-sync-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #22C55E;
    }
    .ue-icon-btn {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border: 1px solid var(--card-border, #E2E8F0);
      background: var(--card-bg, #FFFFFF);
      color: var(--primary, #233B69);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      text-decoration: none;
      box-shadow: none;
      flex-shrink: 0;
      transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }
    .ue-icon-btn svg {
      color: inherit;
    }
    .ue-icon-btn:hover:not(:disabled) {
      background: var(--hover, #F1F5F9);
      border-color: var(--border-strong, #CBD5E1);
    }
    .ue-icon-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .ue-notif-dot {
      position: absolute;
      top: 9px;
      right: 9px;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--accent);
      border: 2px solid var(--surface);
    }
    .ue-eyebrow {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--navy);
    }
    .ue-nav-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ue-nav-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--crumb);
      padding: 0 12px 6px 12px;
    }
    .ue-nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      height: 42px;
      padding: 0 12px;
      border-radius: 10px;
      color: var(--ink-secondary);
      font-weight: 400;
      font-size: 14px;
      text-decoration: none;
      transition: background 0.14s ease, color 0.14s ease;
    }
    .ue-nav-item:hover {
      background: var(--hover);
      color: var(--ink);
    }
    .ue-nav-item[aria-current="page"] {
      background: var(--navy);
      color: #FFFFFF;
      font-weight: 500;
    }
    .ue-nav-badge {
      background: var(--accent);
      color: var(--ink);
      font-size: 11.5px;
      font-weight: 600;
      padding: 1px 8px;
      border-radius: 999px;
      font-variant-numeric: tabular-nums;
    }
    .ue-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .ue-kpi {
      background: var(--surface, #FFFFFF);
      border: 1px solid var(--hairline, #E2E8F0);
      border-radius: 14px;
      padding: 18px 20px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    }
    .ue-kpi-label {
      font-size: 12px;
      color: var(--muted, #64748B);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }
    .ue-kpi-num,
    .ue-kpi-val {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--ink, #0F172A);
      line-height: 1.15;
      font-variant-numeric: tabular-nums;
    }
    .ue-kpi-sub {
      font-size: 12px;
      color: var(--muted, #64748B);
      margin-top: 6px;
    }
    .ue-card {
      background: var(--surface);
      border: 1px solid var(--hairline);
      border-radius: 16px;
      padding: 24px;
    }
    .ue-table-wrap {
      background: var(--surface);
      border: 1px solid var(--hairline);
      border-radius: 16px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .ue-table-wrap::-webkit-scrollbar {
      height: 6px;
    }
    .ue-table-wrap::-webkit-scrollbar-track {
      background: #f1f5f9;
    }
    .ue-table-wrap::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 999px;
    }
    .ue-table-wrap::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
    .ue-table,
    .admin-table-card table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    .ue-table th,
    .admin-table-card table th {
      background: var(--surface-subtle) !important;
      color: var(--muted) !important;
      font-weight: 600 !important;
      font-size: 11.5px !important;
      letter-spacing: 0.08em !important;
      text-transform: uppercase !important;
      padding: 12px 18px !important;
      text-align: left;
      border-bottom: 1px solid var(--hairline) !important;
    }
    .ue-table td,
    .admin-table-card table td {
      padding: 14px 18px !important;
      border-bottom: 1px solid var(--hairline) !important;
      color: var(--ink);
      font-size: 13.5px;
    }
    .ue-table tr:last-child td,
    .admin-table-card table tr:last-child td {
      border-bottom: 0 !important;
    }
    .ue-table tr:hover td,
    .admin-table-card table tbody tr:hover td {
      background: var(--hover);
    }
    .ue-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.2;
    }
    .ue-pill-pos {
      background: var(--pos-bg);
      color: var(--pos-ink);
    }
    .ue-pill-neg {
      background: var(--neg-bg);
      color: var(--neg-ink);
    }
    .ue-pill-warn {
      background: var(--warn-bg);
      color: var(--warn);
    }
    .ue-pill-neutral {
      background: var(--hover);
      color: var(--muted);
    }
    .ue-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0 16px;
      height: 38px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      border: 1px solid var(--hairline);
      background: var(--surface);
      color: var(--ink);
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .ue-btn:hover:not(:disabled) {
      background: var(--hover);
      border-color: var(--border-strong);
    }
    .ue-btn-primary {
      background: var(--navy);
      border-color: var(--navy);
      color: #FFFFFF;
    }
    .ue-btn-primary:hover:not(:disabled) {
      background: var(--navy-deep);
      border-color: var(--navy-deep);
    }
    .ue-btn-accent {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--ink);
      font-weight: 600;
    }
    .ue-btn-accent:hover:not(:disabled) {
      filter: brightness(0.96);
    }
    .ue-avatar {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: var(--navy-tint);
      color: var(--navy);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .admin-mobile-toggle {
      display: none;
    }
    .admin-overlay {
      display: none;
    }
    /* Universal Admin Responsive Helpers */
    .admin-table-card {
      background: white;
      border-radius: 16px;
      border: 1px solid #E2E8F0;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    }
    .admin-table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .admin-table-responsive::-webkit-scrollbar {
      height: 6px;
    }
    .admin-table-responsive::-webkit-scrollbar-track {
      background: #f1f5f9;
    }
    .admin-table-responsive::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 100px;
    }
    .admin-table-responsive::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
    .admin-mobile-swipe-hint {
      display: none;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 11px;
      font-weight: 600;
      border-bottom: 1px solid #bfdbfe;
    }
    .admin-grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .admin-modal-container {
      background: white;
      width: 100%;
      max-width: 720px;
      border-radius: 24px;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      position: relative;
    }
    .admin-modal-header {
      padding: 20px 28px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: white;
      z-index: 10;
    }
    .admin-modal-body {
      padding: 28px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    @media (max-width: 960px) {
      .admin-shell {
        grid-template-columns: 1fr;
        grid-template-rows: 64px 1fr;
      }
      .admin-side {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        width: 270px;
        z-index: 1000;
        transform: translateX(-100%);
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      }
      .admin-side.open {
        transform: translateX(0);
      }
      .admin-overlay {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.4);
        z-index: 999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      .admin-overlay.open {
        opacity: 1;
        pointer-events: auto;
      }
      .admin-mobile-toggle {
        display: inline-flex;
      }
      .admin-top {
        grid-column: 1;
        padding: 0 16px;
      }
      .admin-work {
        grid-column: 1;
        padding: 20px 16px;
      }
    }
    @media (max-width: 768px) {
      .admin-mobile-swipe-hint {
        display: flex;
      }
      .admin-grid-2col {
        grid-template-columns: 1fr !important;
      }
      .admin-modal-container {
        border-radius: 18px;
        max-height: 94vh;
      }
      .admin-modal-header {
        padding: 16px 20px;
      }
      .admin-modal-body {
        padding: 20px 16px;
        gap: 18px;
      }
    }
  `;

  if (checkingRole) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', color: '#64748B', fontSize: '13.5px', fontFamily: 'var(--font-poppins), sans-serif' }}>
        <style>{baseStyles}</style>
        Memverifikasi otorisasi admin Google...
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: '20px' }}>
        <style>{baseStyles}</style>
        <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '420px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <div className="ue-eyebrow" style={{ marginBottom: '6px' }}>Untuk Esok — Internal</div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#0F172A', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            {currentUser ? 'Akses terbatas' : 'Masuk ke panel operasional'}
          </h1>
          <p style={{ color: '#64748B', fontSize: '13.5px', margin: '0 0 20px 0', lineHeight: 1.55 }}>
            {currentUser
              ? `Akun ${currentUser.email} tidak terdaftar sebagai administrator operasional.`
              : 'Gunakan akun Google resmi organisasi untuk mengakses ruang kerja operasional Untuk Esok.'}
          </p>

          {loginError && (
            <div className="ue-pill ue-pill-neg" style={{ display: 'block', padding: '8px 12px', marginBottom: '14px', borderRadius: '8px' }}>
              {loginError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!currentUser ? (
              <button type="button" onClick={handleAdminLogin} disabled={isLoggingIn} className="ue-btn ue-btn-primary" style={{ justifyContent: 'center', height: '42px' }}>
                {isLoggingIn ? 'Memproses...' : 'Masuk dengan Google'}
              </button>
            ) : (
              <button type="button" onClick={logout} className="ue-btn ue-btn-primary" style={{ justifyContent: 'center', height: '42px' }}>
                <FiLogOut size={15} /> Ganti akun Google
              </button>
            )}
            <Link href="/" className="ue-btn" style={{ justifyContent: 'center', height: '40px' }}>
              <FiArrowLeft size={15} /> Kembali ke beranda publik
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const mainGroups = ['Sentral', 'Operasional'];

  return (
    <AdminDataProvider enabled={Boolean(isAuthorized)}>
      <div className="admin-shell">
        <style>{baseStyles}</style>

        <div className={`admin-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />

        {/* SIDEBAR */}
        <aside className={`admin-side ${isMobileMenuOpen ? 'open' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
            <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
              <img
                src="/logo_UE.webp"
                alt="Logo Untuk Esok"
                style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '16px', color: '#0F172A', lineHeight: 1.2 }}>
                  Untuk Esok
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Manajemen
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="admin-mobile-toggle ue-icon-btn"
              style={{ width: '32px', height: '32px' }}
            >
              <FiX size={16} />
            </button>
          </div>

          {/* Navigation Groups */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            {mainGroups.map(groupName => (
              <div key={groupName} className="ue-nav-group">
                <div className="ue-nav-label">{groupName}</div>
                {DEPARTMENTS.filter(d => d.group === groupName).map(item => {
                  const Icon = item.icon;
                  const isActive = item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname?.startsWith(item.href);

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className="ue-nav-item"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Icon size={18} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.78 }} />
                        <span>{item.label}</span>
                      </span>
                      {item.showBadge && <SidebarActionBadge />}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* User Profile & Public Link */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px', borderTop: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 6px' }}>
              <div className="ue-avatar" style={{ width: '36px', height: '36px' }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser?.email}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Keluar sesi"
                className="ue-icon-btn"
                style={{ width: '36px', height: '36px' }}
              >
                <FiLogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* TOP BAR */}
        <TopBarControls onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

        {/* WORKSPACE CANVAS */}
        <main className="admin-work">
          {children}
        </main>
      </div>
    </AdminDataProvider>
  );
}
