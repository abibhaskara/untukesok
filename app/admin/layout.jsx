'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiHome, FiList, FiFileText, FiUsers, FiLogOut } from 'react-icons/fi';

export default function AdminLayout({ children }) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Beranda Admin', path: '/admin', icon: <FiHome /> },
    { name: 'Kelola Program', path: '/admin/programs', icon: <FiList /> },
    { name: 'Kelola Berita', path: '/admin/news', icon: <FiFileText /> },
    { name: 'Pendaftar / Sertifikat', path: '/admin/applications', icon: <FiUsers /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Sidebar */}
      <aside style={{ width: '250px', background: 'white', borderRight: '1px solid #eaeaea', padding: '24px 0', position: 'fixed', height: '100vh', overflowY: 'auto' }}>
        <div style={{ padding: '0 24px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-playfair)' }}>Untuk Esok</h2>
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Admin Dashboard</p>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px' }}>
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
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: isActive ? 'var(--primary)' : '#444',
                  background: isActive ? '#fff0e6' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div style={{ position: 'absolute', bottom: '24px', width: '100%', padding: '0 12px' }}>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'transparent',
            border: 'none',
            color: '#dc3545',
            width: '100%',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: 500
          }}>
            <FiLogOut style={{ fontSize: '18px' }} />
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
