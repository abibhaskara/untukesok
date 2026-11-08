'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, addDoc, increment, query, where } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase';
import { clearCache } from '../../../src/lib/dataService';
import { FiMail, FiPhone, FiActivity, FiTrash2, FiEdit2, FiX, FiChevronRight, FiUserPlus, FiAlertCircle, FiCheck, FiMoreVertical } from 'react-icons/fi';
import AdminPagination from '../../../src/components/AdminPagination';
import AdminSearchFilterBar from '../../../src/components/AdminSearchFilterBar';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit User State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'volunteer',
    institution: '',
    city: '',
    bio: ''
  });

  // Enroll User into Program Modal State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isSubmittingEnroll, setIsSubmittingEnroll] = useState(false);
  const [enrollingUser, setEnrollingUser] = useState(null);
  const [selectedEnrollProgId, setSelectedEnrollProgId] = useState('');
  const [enrollForm, setEnrollForm] = useState({
    status: 'Terdaftar',
    paymentStatus: 'PAID',
    paymentMethod: 'Manual Admin',
    amount: 0,
    notes: ''
  });

  // Action Menu State (Titik 3)
  const [activeMenuUserId, setActiveMenuUserId] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.user-action-menu-container')) {
        setActiveMenuUserId(null);
      }
    };
    if (activeMenuUserId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenuUserId]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const appsSnap = await getDocs(collection(db, 'applications'));
        const appsData = appsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        try {
          const progSnap = await getDocs(collection(db, 'programs'));
          const progData = progSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setPrograms(progData);
        } catch (progErr) {
          console.warn("Failed to fetch programs:", progErr);
        }

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

  // Open Edit Modal
  const handleOpenEditModal = (userObj) => {
    setEditingUser(userObj);
    setEditForm({
      name: userObj.name || userObj.displayName || '',
      nickname: userObj.nickname || '',
      gender: userObj.gender || 'Laki-laki',
      birthYear: userObj.birthYear || userObj.birth_year || '',
      email: userObj.email || '',
      phone: userObj.phone || '',
      role: userObj.role === 'admin' ? 'admin' : 'volunteer',
      institution: userObj.institution || userObj.occupation || '',
      city: userObj.city || userObj.address || '',
      bio: userObj.bio || ''
    });
    setIsEditModalOpen(true);
  };

  // Save Edited User
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editingUser || isSavingUser) return;

    const cleanName = editForm.name.trim();
    const cleanNickname = (editForm.nickname || '').trim();
    const cleanBirthYear = editForm.birthYear ? parseInt(editForm.birthYear, 10) : null;
    if (!cleanName) {
      alert('Nama pengguna tidak boleh kosong.');
      return;
    }

    setIsSavingUser(true);
    try {
      const updateData = {
        name: cleanName,
        displayName: cleanName,
        nickname: cleanNickname,
        gender: editForm.gender || 'Laki-laki',
        birthYear: cleanBirthYear && !isNaN(cleanBirthYear) ? Number(cleanBirthYear) : null,
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        role: editForm.role,
        institution: editForm.institution.trim(),
        city: editForm.city.trim(),
        bio: editForm.bio.trim(),
        updatedAt: new Date().toISOString()
      };

      // 1. Update Firestore Users collection
      await updateDoc(doc(db, 'users', editingUser.id), updateData);

      // 2. Synchronize across all applications belonging to this user
      const appsQuery = query(collection(db, 'applications'), where('userId', '==', editingUser.id));
      const appsSnap = await getDocs(appsQuery);
      const appPromises = appsSnap.docs.map(appDoc => 
        updateDoc(doc(db, 'applications', appDoc.id), {
          userName: cleanName,
          userNickname: cleanNickname,
          userGender: editForm.gender || 'Laki-laki',
          userBirthYear: cleanBirthYear && !isNaN(cleanBirthYear) ? Number(cleanBirthYear) : null,
          userPhone: editForm.phone.trim(),
          userEmail: editForm.email.trim()
        })
      );
      await Promise.all(appPromises);

      // 3. Update local state
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updateData } : u));
      setApplications(prev => prev.map(app => 
        app.userId === editingUser.id 
          ? { ...app, userName: cleanName, userNickname: cleanNickname, userGender: editForm.gender || 'Laki-laki', userBirthYear: cleanBirthYear && !isNaN(cleanBirthYear) ? Number(cleanBirthYear) : null, userPhone: editForm.phone.trim(), userEmail: editForm.email.trim() } 
          : app
      ));

      setIsEditModalOpen(false);
      alert(`Informasi akun "${cleanName}" berhasil diperbarui dan disinkronkan ke seluruh data kegiatan!`);
    } catch (err) {
      console.error("Gagal memperbarui akun:", err);
      alert("Gagal memperbarui informasi akun: " + err.message);
    } finally {
      setIsSavingUser(false);
    }
  };

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

  // Program Enrollment Handlers
  const handleOpenEnrollModal = (userObj) => {
    setEnrollingUser(userObj);
    const defaultProg = programs.length > 0 ? programs[0] : null;
    setSelectedEnrollProgId(defaultProg ? defaultProg.id : '');
    const isPaid = defaultProg ? Boolean(defaultProg.isPaid && Number(defaultProg.price) > 0) : false;
    setEnrollForm({
      status: 'Terdaftar',
      paymentStatus: isPaid ? 'PAID' : 'FREE',
      paymentMethod: isPaid ? 'Manual Admin' : 'Gratis',
      amount: isPaid ? Number(defaultProg.price || 0) : 0,
      noCertificate: false,
      notes: ''
    });
    setIsEnrollModalOpen(true);
  };

  const handleSelectEnrollProgram = (progId) => {
    setSelectedEnrollProgId(progId);
    const prog = programs.find(p => p.id === progId);
    if (prog) {
      const isPaid = Boolean(prog.isPaid && Number(prog.price) > 0);
      setEnrollForm(prev => ({
        ...prev,
        paymentStatus: isPaid ? 'PAID' : 'FREE',
        paymentMethod: isPaid ? 'Manual Admin' : 'Gratis',
        amount: isPaid ? Number(prog.price || 0) : 0
      }));
    }
  };

  const existingEnrollApp = useMemo(() => {
    if (!enrollingUser || !selectedEnrollProgId) return null;
    return applications.find(
      a => a.userId === enrollingUser.id && 
           a.programId === selectedEnrollProgId && 
           a.status !== 'Dibatalkan' && 
           a.status !== 'Dikeluarkan'
    );
  }, [enrollingUser, selectedEnrollProgId, applications]);

  const handleSubmitEnroll = async (e) => {
    e.preventDefault();
    if (!enrollingUser) return;
    const targetProg = programs.find(p => p.id === selectedEnrollProgId);
    if (!targetProg) {
      alert("Silakan pilih program kegiatan terlebih dahulu.");
      return;
    }
    if (existingEnrollApp) {
      alert(`Pengguna "${enrollingUser.name || enrollingUser.displayName}" sudah terdaftar di kegiatan "${targetProg.title}" (Status: ${existingEnrollApp.status}).`);
      return;
    }

    setIsSubmittingEnroll(true);
    try {
      const nowIso = new Date().toISOString();
      const finalAmount = Number(enrollForm.amount || 0);
      const isPaidProgram = finalAmount > 0 || enrollForm.paymentStatus === 'PAID';
      const ticketPrice = targetProg?.price !== undefined ? Number(targetProg.price) : finalAmount;

      const newPayload = {
        userId: enrollingUser.id,
        userName: enrollingUser.name || enrollingUser.displayName || 'Relawan',
        userNickname: enrollingUser.nickname || '',
        userPhone: enrollingUser.phone || '',
        userEmail: enrollingUser.email || '',
        userGender: enrollingUser.gender || 'Laki-laki',
        programId: targetProg.id,
        programTitle: targetProg.title || '',
        programImageUrl: targetProg.imageUrl || '',
        programDate: targetProg.date || '',
        programLocation: targetProg.location || '',
        status: enrollForm.status || 'Terdaftar',
        isPaid: isPaidProgram,
        ticketPrice: ticketPrice,
        discountAmount: 0,
        promoCode: '',
        adminFee: 0,
        amount: finalAmount,
        paymentStatus: enrollForm.paymentStatus || (finalAmount > 0 ? 'PAID' : 'FREE'),
        paymentMethod: enrollForm.paymentMethod || (finalAmount > 0 ? 'Manual Admin' : 'Gratis'),
        orderId: `ADM-${Date.now().toString().slice(-8)}`,
        paidAt: nowIso,
        appliedAt: nowIso,
        registeredByAdmin: true,
        adminNotes: enrollForm.notes?.trim() || '',
        noCertificate: Boolean(enrollForm.noCertificate),
        credentialId: enrollForm.noCertificate ? '' : `CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
      };

      const newDocRef = await addDoc(collection(db, 'applications'), newPayload);

      if (['Terdaftar', 'Hadir', 'Selesai'].includes(newPayload.status)) {
        try {
          await updateDoc(doc(db, 'programs', targetProg.id), {
            volunteersJoined: increment(1)
          });
        } catch (progErr) {
          console.warn("Gagal update volunteersJoined:", progErr);
        }
      }

      clearCache('programs');

      setApplications(prev => [{ id: newDocRef.id, ...newPayload }, ...prev]);

      alert(`Berhasil mendaftarkan "${newPayload.userName}" ke program "${targetProg.title}"!`);
      setIsEnrollModalOpen(false);
      setEnrollingUser(null);
    } catch (error) {
      console.error("Gagal mendaftarkan pengguna:", error);
      alert("Gagal melakukan pendaftaran: " + error.message);
    } finally {
      setIsSubmittingEnroll(false);
    }
  };

  const [sortOrder, setSortOrder] = useState('registered_desc'); // registered_desc, registered_asc, activity_desc, activity_asc, name_asc
  const [roleFilter, setRoleFilter] = useState('all'); // all, admin, volunteer

  // Map of application count per user ID
  const appCountMap = useMemo(() => {
    const map = {};
    applications.forEach(app => {
      if (app.userId && app.status !== 'Dibatalkan' && app.status !== 'Dikeluarkan') {
        map[app.userId] = (map[app.userId] || 0) + 1;
      }
    });
    return map;
  }, [applications]);

  // Filter & sort users
  const filteredUsers = useMemo(() => {
    let list = users.filter(u => {
      const name = (u.name || u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesQuery = name.includes(q) || email.includes(q) || phone.includes(q);
      
      if (roleFilter === 'admin') return matchesQuery && u.role === 'admin';
      if (roleFilter === 'volunteer') return matchesQuery && u.role !== 'admin';
      return matchesQuery;
    });

    list.sort((a, b) => {
      if (sortOrder === 'registered_desc') {
        const dateA = new Date(a.createdAt || a.lastLoginAt || 0);
        const dateB = new Date(b.createdAt || b.lastLoginAt || 0);
        return dateB - dateA;
      }
      if (sortOrder === 'registered_asc') {
        const dateA = new Date(a.createdAt || a.lastLoginAt || 0);
        const dateB = new Date(b.createdAt || b.lastLoginAt || 0);
        return dateA - dateB;
      }
      if (sortOrder === 'activity_desc') {
        return (appCountMap[b.id] || 0) - (appCountMap[a.id] || 0);
      }
      if (sortOrder === 'activity_asc') {
        return (appCountMap[a.id] || 0) - (appCountMap[b.id] || 0);
      }
      if (sortOrder === 'name_asc') {
        const nameA = (a.name || a.displayName || '').toLowerCase();
        const nameB = (b.name || b.displayName || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

    return list;
  }, [users, appCountMap, searchQuery, roleFilter, sortOrder]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div className="ue-eyebrow" style={{ marginBottom: '4px' }}>DIVISI SUMBER DAYA MANUSIA</div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Pengguna & Relawan
          </h1>
        </div>
      </div>

      {/* SEARCH, FILTER & SORTING BAR */}
      <AdminSearchFilterBar
        searchValue={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Cari berdasarkan nama, email, atau nomor WhatsApp..."
        ariaLabel="Urutkan Kegiatan"
        title="Urutkan Kegiatan"
        style={{ marginBottom: '24px' }}
        sections={[
          {
            label: 'Peran Pengguna',
            value: roleFilter,
            onChange: (val) => {
              setRoleFilter(val);
              setCurrentPage(1);
            },
            options: [
              { value: 'all', label: 'Semua Peran' },
              { value: 'volunteer', label: 'Relawan' },
              { value: 'admin', label: 'Administrator' }
            ]
          },
          {
            label: 'Urutkan',
            value: sortOrder,
            onChange: (val) => {
              setSortOrder(val);
              setCurrentPage(1);
            },
            options: [
              { value: 'registered_desc', label: 'Terdaftar Terbaru' },
              { value: 'registered_asc', label: 'Terdaftar Terlama' },
              { value: 'activity_desc', label: 'Program Terbanyak' },
              { value: 'activity_asc', label: 'Program Tersedikit' },
              { value: 'name_asc', label: 'Nama (A-Z)' }
            ]
          }
        ]}
      />

      {/* USERS TABLE */}
      <div className="admin-table-card">
        <div className="admin-mobile-swipe-hint">
          <FiChevronRight size={14} /> Geser tabel ke kanan untuk melihat rincian kontak, role & aksi
        </div>
        <div className="admin-table-responsive" style={{ overflowX: 'auto', minHeight: '320px', paddingBottom: '20px' }}>
          <table style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #eaeaea' }}>
                <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Pengguna / Nama</th>
                <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Kontak</th>
                <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Role & Status</th>
                <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Aktivitas Diikuti</th>
                <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Tanggal Terdaftar</th>
                <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600, textAlign: 'center' }} aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="6" style={{ padding: '28px', textAlign: 'center', color: '#666' }}>Memuat data akun...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '28px', textAlign: 'center', color: '#666' }}>Tidak ditemukan akun terdaftar.</td></tr>
              ) : (
                paginatedUsers.map((u) => {
                  const appCount = appCountMap[u.id] || 0;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #eaeaea' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={u.name || 'User'} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div className="ue-avatar">
                              {(u.name || u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{u.name || u.displayName || 'Relawan'}</span>
                              {u.nickname && <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>({u.nickname})</span>}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span>ID: {u.id.substring(0, 8)}...</span>
                              {u.gender && (
                                <span style={{ background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', color: '#475569', fontWeight: 500 }}>
                                  {u.gender}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {u.email && (
                          <div style={{ fontSize: '13.5px', color: '#0F172A', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FiMail size={13} color="#64748B" /> {u.email}
                          </div>
                        )}
                        {u.phone && (
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FiPhone size={12} color="#64748B" /> {u.phone}
                          </div>
                        )}
                        {!u.email && !u.phone && (
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>Tanpa Email/HP</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                        <span className={u.role === 'admin' ? 'ue-pill ue-pill-warn' : 'ue-pill ue-pill-neutral'} style={{ fontSize: '11.5px', fontWeight: 500 }}>
                          {u.role === 'admin' ? 'Admin' : 'Relawan'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13.5px', color: appCount > 0 ? '#166534' : '#64748B' }}>
                          <FiActivity size={14} />
                          {appCount} Program
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: '12.5px', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div className="user-action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuUserId(activeMenuUserId === u.id ? null : u.id);
                            }}
                            className="ue-icon-btn"
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              borderColor: activeMenuUserId === u.id ? '#233B69' : 'var(--card-border, #E2E8F0)',
                              background: activeMenuUserId === u.id ? '#233B69' : 'var(--card-bg, #FFFFFF)',
                              color: activeMenuUserId === u.id ? '#FFFFFF' : 'var(--primary, #233B69)'
                            }}
                            title="Menu Aksi"
                            aria-expanded={activeMenuUserId === u.id}
                          >
                            <FiMoreVertical size={16} />
                          </button>

                          {activeMenuUserId === u.id && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                ...(paginatedUsers.length > 2 && paginatedUsers.findIndex(item => item.id === u.id) >= paginatedUsers.length - 2
                                  ? { bottom: 'calc(100% + 4px)', top: 'auto' }
                                  : { top: 'calc(100% + 4px)', bottom: 'auto' }),
                                zIndex: 60,
                                background: '#FFFFFF',
                                borderRadius: '10px',
                                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
                                border: '1px solid #E2E8F0',
                                padding: '6px',
                                minWidth: '150px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                textAlign: 'left'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuUserId(null);
                                  handleOpenEnrollModal(u);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#16a34a',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  width: '100%',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <FiUserPlus size={14} />
                                <span>Daftarkan</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuUserId(null);
                                  handleOpenEditModal(u);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#2563eb',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  width: '100%',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <FiEdit2 size={14} />
                                <span>Edit</span>
                              </button>

                              <div style={{ height: '1px', background: '#F1F5F9', margin: '2px 0' }} />

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuUserId(null);
                                  handleDeleteUser(u);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#dc2626',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  width: '100%',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <FiTrash2 size={14} />
                                <span>Hapus</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredUsers.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 50, 100]}
        />
      </div>

      {/* MODAL EDIT INFORMASI AKUN PENGGUNA */}
      {isEditModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="admin-modal-container" style={{ maxWidth: '540px' }}>
            <div className="admin-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Edit Informasi Akun</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Perubahan nama dan kontak akan otomatis tersinkronisasi ke seluruh pendaftaran relawan.</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '20px' }}>
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="admin-modal-body">
              <div className="admin-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nama lengkap relawan / admin"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Nama Panggilan
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Panggilan"
                    value={editForm.nickname || ''}
                    onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value.replace(/\s+/g, '') })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div className="admin-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Jenis Kelamin
                  </label>
                  <select
                    value={editForm.gender || 'Laki-laki'}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Tahun Kelahiran
                  </label>
                  <input
                    type="number"
                    min="1940"
                    max={new Date().getFullYear()}
                    placeholder="Contoh: 2002"
                    value={editForm.birthYear || ''}
                    onChange={(e) => setEditForm({ ...editForm, birthYear: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div className="admin-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Email Akun
                  </label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    placeholder="08123456789 atau 628..."
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Hak Akses / Peran Akun (Role) *
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                >
                  <option value="volunteer">Relawan (User Biasa)</option>
                  <option value="admin">Administrator (Akses Penuh CMS)</option>
                </select>
              </div>

              <div className="admin-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Asal Instansi / Kampus / Pekerjaan
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Universitas Indonesia"
                    value={editForm.institution}
                    onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Kota / Domisili
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Jakarta Selatan"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Bio / Catatan Relawan
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan profil relawan (opsional)"
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: isSavingUser ? 0.7 : 1 }}
                >
                  {isSavingUser ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DAFTARKAN PENGGUNA KE PROGRAM */}
      {isEnrollModalOpen && enrollingUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="admin-modal-container" style={{ maxWidth: '580px', width: '100%' }}>
            {/* Header */}
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: '#0284c7',
                  color: 'white',
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FiUserPlus size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Daftarkan ke Program Kegiatan
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Daftarkan akun <strong>{enrollingUser.name || enrollingUser.displayName || 'Relawan'}</strong> ke kegiatan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEnrollModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '20px' }}
              >
                <FiX />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitEnroll} className="admin-modal-body">
              {/* User Info Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px'
              }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '15px'
                }}>
                  {(enrollingUser.name || enrollingUser.displayName || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                    {enrollingUser.name || enrollingUser.displayName || 'Relawan'}
                    {enrollingUser.nickname && <span style={{ fontWeight: 500, color: '#64748b', marginLeft: '4px' }}>({enrollingUser.nickname})</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                    {enrollingUser.email || '-'} • {enrollingUser.phone || '-'}
                  </div>
                </div>
              </div>

              {/* Program Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Pilih Program Kegiatan *
                </label>
                <select
                  required
                  value={selectedEnrollProgId}
                  onChange={(e) => handleSelectEnrollProgram(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', fontWeight: 600, color: '#0f172a', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  <option value="" disabled>-- Pilih Program Kegiatan --</option>
                  {programs.map(p => {
                    const priceLabel = p.isPaid && Number(p.price) > 0 ? `Rp ${Number(p.price).toLocaleString('id-ID')}` : 'Gratis';
                    return (
                      <option key={p.id} value={p.id}>
                        {p.title} • {priceLabel} {p.date ? `• ${p.date}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Duplicate Warning */}
              {existingEnrollApp && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  background: '#fef2f2',
                  border: '1.5px solid #fca5a5',
                  borderRadius: '10px',
                  color: '#991b1b',
                  fontSize: '12.5px',
                  lineHeight: 1.5
                }}>
                  <FiAlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <strong>Pendaftaran Ganda:</strong> Pengguna ini sudah terdaftar di kegiatan ini dengan status <strong>"{existingEnrollApp.status}"</strong>.
                  </div>
                </div>
              )}

              {/* Status & Payment Settings */}
              <div className="admin-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Status Keikutsertaan *
                  </label>
                  <select
                    value={enrollForm.status}
                    onChange={(e) => setEnrollForm({ ...enrollForm, status: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                  >
                    <option value="Terdaftar">Terdaftar (Aktif)</option>
                    <option value="Hadir">Hadir (Selesai Mengikuti)</option>
                    <option value="Selesai">Selesai (Sudah Diberi Sertifikat)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Status Pembayaran *
                  </label>
                  <select
                    value={enrollForm.paymentStatus}
                    onChange={(e) => setEnrollForm({ ...enrollForm, paymentStatus: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                  >
                    <option value="PAID">PAID (Lunas)</option>
                    <option value="FREE">FREE (Gratis / Beasiswa)</option>
                    <option value="PENDING">PENDING (Belum Lunas)</option>
                  </select>
                </div>
              </div>

              <div className="admin-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Metode Pembayaran
                  </label>
                  <select
                    value={enrollForm.paymentMethod}
                    onChange={(e) => setEnrollForm({ ...enrollForm, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                  >
                    <option value="Manual Admin">Manual Admin</option>
                    <option value="Transfer BCA / Bank">Transfer BCA / Bank</option>
                    <option value="Tunai / On The Spot">Tunai / On The Spot</option>
                    <option value="Undangan / Beasiswa">Undangan / Beasiswa</option>
                    <option value="Gratis">Gratis</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Nominal Biaya (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={enrollForm.amount}
                    onChange={(e) => setEnrollForm({ ...enrollForm, amount: Number(e.target.value) })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Catatan Admin (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan pendaftaran (misal: Daftarkan via WhatsApp panitia)..."
                  value={enrollForm.notes}
                  onChange={(e) => setEnrollForm({ ...enrollForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ paddingTop: '4px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#334155', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(enrollForm.noCertificate)}
                    onChange={(e) => setEnrollForm({ ...enrollForm, noCertificate: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                  />
                  <span>Tanpa Sertifikat (Khusus Batch 1-3 atau peserta non-sertifikat)</span>
                </label>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!selectedEnrollProgId || Boolean(existingEnrollApp) || isSubmittingEnroll}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: (!selectedEnrollProgId || Boolean(existingEnrollApp) || isSubmittingEnroll) ? '#94a3b8' : '#0284c7',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: (!selectedEnrollProgId || Boolean(existingEnrollApp) || isSubmittingEnroll) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <FiCheck size={15} />
                  <span>{isSubmittingEnroll ? 'Menyimpan...' : 'Daftarkan Pengguna'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

