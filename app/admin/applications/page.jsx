'use client';
import { useState, useEffect } from 'react';
import { FiAward, FiX, FiUser, FiPhone, FiMail, FiUserX } from 'react-icons/fi';
import { db } from '../../../src/lib/firebase';
import { collection, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
export default function AdminApplications() {
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [certificateUrl, setCertificateUrl] = useState('');

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'applications'));
      let data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const filterProgramId = urlParams.get('programId');
      
      if (filterProgramId) {
        data = data.filter(app => app.programId === filterProgramId);
      }
      
      // Fetch latest user profile data for all applications so names are always up to date
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const userMap = {};
        usersSnap.docs.forEach(uDoc => {
          userMap[uDoc.id] = uDoc.data();
        });

        data.forEach(app => {
          const latestUser = userMap[app.userId];
          if (latestUser) {
            if (latestUser.name) app.userName = latestUser.name;
            else if (latestUser.displayName) app.userName = latestUser.displayName;
            
            if (latestUser.phone) app.userPhone = latestUser.phone;
            if (latestUser.email) app.userEmail = latestUser.email;
          }
          if (!app.userName) {
            app.userName = `User (${app.userId ? app.userId.substring(0, 5) : 'Anonym'})`;
          }
        });
      } catch (userFetchErr) {
        console.warn("Failed to fetch latest users for applications:", userFetchErr);
      }
      
      // Sort by appliedAt desc
      data.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
      setApplications(data);
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleOpenModal = async (app) => {
    let currentApp = { ...app };
    
    // Auto-generate credentialId if it's missing (for older data)
    if (!currentApp.credentialId) {
      const newCredentialId = `CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      try {
        await updateDoc(doc(db, 'applications', currentApp.id), { credentialId: newCredentialId });
        currentApp.credentialId = newCredentialId;
      } catch (error) {
        console.error("Failed to generate credentialId", error);
      }
    }

    setEditingApp(currentApp);
    setCertificateUrl(currentApp.certificateUrl || '');
    setIsModalOpen(true);
  };

  const handleSaveCertificate = async (e) => {
    e.preventDefault();
    if (!editingApp) return;

    try {
      const updateData = { certificateUrl: certificateUrl };
      if (certificateUrl.trim() !== '') {
        updateData.status = 'Selesai';
      } else if (editingApp.status === 'Selesai') {
        updateData.status = 'Terdaftar';
      }

      await updateDoc(doc(db, 'applications', editingApp.id), updateData);

      setIsModalOpen(false);
      fetchApplications(); // Refresh data
    } catch (error) {
      console.error("Error saving certificate:", error);
      alert("Gagal mengirim sertifikat!");
    }
  };

  const handleKickApplication = async (app) => {
    if (!window.confirm(`Yakin ingin MENGELUARKAN relawan ${app.userName || 'ini'} dari program ${app.programTitle}?`)) return;

    try {
      // 1. Update application status
      await updateDoc(doc(db, 'applications', app.id), {
        status: 'Dikeluarkan',
        kickedAt: new Date().toISOString()
      });

      // 2. Decrement volunteersJoined in program if it was 'Terdaftar'
      if (app.status === 'Terdaftar') {
        await updateDoc(doc(db, 'programs', app.programId), {
          volunteersJoined: increment(-1)
        });
      }

      alert("Relawan berhasil dikeluarkan.");
      fetchApplications(); // Refresh data
    } catch (error) {
      console.error("Gagal mengeluarkan relawan:", error);
      alert("Terjadi kesalahan.");
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '32px', marginBottom: '8px' }}>Kelola Relawan</h1>
          <p style={{ color: '#666', margin: 0 }}>Daftar seluruh pendaftaran relawan dan manajemen sertifikat.</p>
        </div>
        {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('programId') && (
          <button 
            onClick={() => window.location.href = '/admin/applications'} 
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
          >
            Lihat Semua Program
          </button>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #eaeaea' }}>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Relawan</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Program</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Tanggal Daftar</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Bukti Follow</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Aksi / Sertifikat</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center' }}>Memuat data...</td></tr>
            ) : applications.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center' }}>Belum ada relawan yang mendaftar.</td></tr>
            ) : (
              applications.map(app => (
                <tr key={app.id} style={{ borderBottom: '1px solid #eaeaea' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#111', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiUser /> {app.userName || 'Relawan'}
                    </div>
                    {app.userPhone && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiPhone /> {app.userPhone}
                      </div>
                    )}
                    {app.userEmail && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiMail /> {app.userEmail}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 600 }}>{app.programTitle}</div>
                    <div style={{ fontSize: '12px', color: (app.status === 'Dibatalkan' || app.status === 'Dikeluarkan') ? '#ef4444' : app.status === 'Selesai' ? '#10b981' : '#888', marginTop: '4px' }}>
                      Status: {app.status}
                    </div>
                    {app.status === 'Dibatalkan' && app.cancelReason && (
                      <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px', background: '#fef2f2', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                        Alasan: {app.cancelReason}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: '14px' }}>
                    {new Date(app.appliedAt).toLocaleDateString('id-ID')}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {app.igProofUrl ? (
                      <a 
                        href={app.igProofUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        onClick={(e) => {
                          if (app.igProofUrl.startsWith('data:')) {
                            e.preventDefault();
                            const w = window.open();
                            if (w) w.document.write(`<title>Bukti Follow</title><body style="margin:0;display:flex;justify-content:center;background:#111;"><img src="${app.igProofUrl}" style="max-width:100%;height:auto;" /></body>`);
                          }
                        }}
                        style={{ fontSize: '12px', color: '#0284c7', background: '#e0f2fe', padding: '6px 12px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, display: 'inline-block' }}
                      >
                        Lihat Bukti
                      </a>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#888' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {app.status !== 'Dibatalkan' && app.status !== 'Dikeluarkan' && (
                        <button 
                          onClick={() => handleKickApplication(app)}
                          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Keluarkan Relawan"
                        >
                          <FiUserX size={16} />
                        </button>
                      )}
                      
                      {app.certificateUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ padding: '4px 12px', background: '#dcfce7', color: '#166534', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>Terkirim</span>
                          <button onClick={() => handleOpenModal(app)} style={{ background: 'none', border: 'none', color: '#1890ff', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>
                            Edit
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleOpenModal(app)}
                          style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <FiAward /> Kelola Sertifikat
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-playfair)' }}>Kelola Sertifikat</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}><FiX /></button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '24px' }}>
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', border: '1px dashed #ccc', textAlign: 'center' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 12px 0', color: '#666' }}>QR Kredensial</h3>
                <div style={{ background: 'white', padding: '8px', borderRadius: '8px', border: '1px solid #eaeaea', display: 'inline-block' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${typeof window !== 'undefined' ? encodeURIComponent(`${window.location.origin}/verify/${editingApp?.credentialId}`) : ''}`}
                    alt="QR Code"
                    style={{ width: '120px', height: '120px' }}
                  />
                </div>
                <p style={{ fontSize: '11px', color: '#888', marginTop: '12px', fontFamily: 'monospace' }}>{editingApp?.credentialId}</p>
                <a 
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${typeof window !== 'undefined' ? encodeURIComponent(`${window.location.origin}/verify/${editingApp?.credentialId}`) : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', marginTop: '8px', padding: '6px 12px', background: 'var(--primary)', color: 'white', fontSize: '12px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}
                >
                  Download QR
                </a>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px', borderRadius: '8px', fontSize: '12px', lineHeight: 1.5 }}>
                  <strong>Langkah Pembuatan Sertifikat:</strong><br/>
                  1. Download QR Code di samping.<br/>
                  2. Tempelkan (paste) QR Code tersebut ke desain poster sertifikat Anda.<br/>
                  3. Export menjadi gambar/PDF dan upload ke Google Drive.<br/>
                  4. Masukkan link Google Drive tersebut ke kolom di bawah ini.
                </div>

                <form onSubmit={handleSaveCertificate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>URL Sertifikat (Google Drive / PDF Link)</label>
                    <input 
                      required 
                      type="url"
                      name="certificateUrl" 
                      value={certificateUrl} 
                      onChange={(e) => setCertificateUrl(e.target.value)} 
                      placeholder="https://..." 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none' }} 
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                    <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
                    <button type="submit" style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Kirim Sertifikat</button>
                  </div>
                </form>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
