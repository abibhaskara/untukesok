'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase';
import { FiMail, FiPhone, FiSearch, FiActivity, FiTrash2 } from 'react-icons/fi';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch all users
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch all applications to count user activities
        const appsSnap = await getDocs(collection(db, 'applications'));
        const appsData = appsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setUsers(usersData);
        setApplications(appsData);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Delete user handler
  const handleDeleteUser = async (userObj) => {
    const userName = userObj.name || userObj.displayName || 'Relawan';
    if (!confirm(`Apakah Anda yakin ingin menghapus akun "${userName}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userObj.id));
      setUsers(prev => prev.filter(u => u.id !== userObj.id));
      alert(`Akun "${userName}" berhasil dihapus.`);
    } catch (error) {
      console.error("Gagal menghapus akun:", error);
      alert("Gagal menghapus akun. Silakan coba lagi.");
    }
  };

  // Compute activity count per user
  const getUserAppCount = (userId) => {
    return applications.filter(app => app.userId === userId && app.status !== 'Dibatalkan').length;
  };

  // Filter users by search query
  const filteredUsers = users.filter(u => {
    const name = (u.name || u.displayName || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q);
  });

  const activeVolunteersCount = users.filter(u => getUserAppCount(u.id) > 0).length;

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 6px 0', fontFamily: 'var(--font-playfair)' }}>Daftar Akun Terdaftar</h1>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>Manajemen dan pemantauan seluruh akun pengguna & relawan terdaftar.</p>
        </div>
      </div>

      {/* STATS SUMMARY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #eaeaea', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <p style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', fontWeight: 700, margin: '0 0 6px 0' }}>Total Akun Terdaftar</p>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>{users.length}</h2>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #eaeaea', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <p style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', fontWeight: 700, margin: '0 0 6px 0' }}>Relawan Aktif (1+ Kegiatan)</p>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#10b981', margin: 0 }}>{activeVolunteersCount}</h2>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #eaeaea', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <p style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', fontWeight: 700, margin: '0 0 6px 0' }}>Total Pendaftaran Kegiatan</p>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#3b82f6', margin: 0 }}>{applications.length}</h2>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div style={{ background: 'white', borderRadius: '14px', padding: '16px 20px', marginBottom: '24px', border: '1px solid #eaeaea', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <FiSearch size={18} color="#888" />
        <input 
          type="text" 
          placeholder="Cari berdasarkan nama, email, atau nomor WhatsApp..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14px' }}
        />
      </div>

      {/* USERS TABLE */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #eaeaea', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #eaeaea' }}>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Pengguna / Nama</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Kontak</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Role & Status</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Aktivitas Diikuti</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Tanggal Terdaftar</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600, textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="6" style={{ padding: '28px', textAlign: 'center', color: '#666' }}>Memuat data akun...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '28px', textAlign: 'center', color: '#666' }}>Tidak ditemukan akun terdaftar.</td></tr>
            ) : (
              filteredUsers.map((u) => {
                const appCount = getUserAppCount(u.id);
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #eaeaea' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.name || 'User'} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                            {(u.name || u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: '#111' }}>{u.name || u.displayName || 'Relawan'}</div>
                          <div style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>ID: {u.id.substring(0, 10)}...</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {u.email && (
                        <div style={{ fontSize: '13px', color: '#444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiMail size={14} color="#666" /> {u.email}
                        </div>
                      )}
                      {u.phone && (
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiPhone size={14} color="#666" /> {u.phone}
                        </div>
                      )}
                      {!u.email && !u.phone && (
                        <span style={{ fontSize: '12px', color: '#aaa' }}>Tanpa Email/HP</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: u.role === 'admin' ? '#fef3c7' : '#eff6ff',
                        color: u.role === 'admin' ? '#d97706' : '#1d4ed8'
                      }}>
                        {u.role === 'admin' ? 'Admin' : 'Relawan'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: appCount > 0 ? '#10b981' : '#888' }}>
                        <FiActivity size={15} />
                        {appCount} Program
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '13px', color: '#666' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          color: '#ef4444',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                        title="Hapus Akun"
                      >
                        <FiTrash2 size={14} /> Hapus
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
