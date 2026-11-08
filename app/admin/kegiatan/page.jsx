'use client';
import { useState, useEffect, useMemo } from 'react';
import { 
  FiPlus, FiEdit2, FiTrash2, FiX, FiUsers, FiInfo, 
  FiMapPin, FiLink, FiDollarSign, FiEye, FiEyeOff, FiFileText, FiCheckCircle, FiDownload,
  FiAward, FiTruck, FiCheck, FiChevronRight, FiMoreVertical
} from 'react-icons/fi';
import { db } from '../../../src/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { clearCache } from '../../../src/lib/dataService';
import { calculateProgramDeadlineAndDaysLeft, calculateDaysLeftGMT8 } from '../../../src/lib/dateUtils';
import { exportVolunteersToExcel } from '../../../src/lib/exportExcel';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPagination from '../../../src/components/AdminPagination';
import AdminSearchFilterBar from '../../../src/components/AdminSearchFilterBar';

const CORE_FACILITIES = [
  'E-Sertifikat',
  'Dokumentasi Kegiatan'
];

const TRANSPORT_FACILITIES = [
  'Transportasi (Hiace)',
  'Transportasi (Mobil)',
  'Transportasi (Bus TMD)',
  'Kendaraan Pribadi'
];

const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

export default function AdminPrograms() {
  const router = useRouter();
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'published', 'draft'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('date_desc'); // 'date_desc', 'date_asc', 'joined_desc', 'joined_asc', 'title_asc'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeMenuProgId, setActiveMenuProgId] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.program-action-menu-container')) {
        setActiveMenuProgId(null);
      }
    };
    if (activeMenuProgId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenuProgId]);
  
  // State form
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    category: 'Pendidikan',
    status: 'published', // 'published' | 'draft'
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    imageUrl: '',
    volunteersTarget: 0,
    volunteersJoined: 0,
    daysLeft: 0,
    urgent: false,
    description: '',
    whatsappGroupLink: '',
    twibbonLink: '',
    documentationDriveUrl: '',
    facilities: ['E-Sertifikat', 'Dokumentasi Kegiatan', 'Transportasi (Hiace)'],
    transportation: ['Hiace'],
    isPaid: false,
    price: 0,
    beneficiariesCount: '',
    certificateTemplateUrl: '',
    signer1Name: 'Abi Bhaskara',
    signer1Role: 'Project Leader Untuk Esok',
    signer1SignatureUrl: '',
    signer2Name: '',
    signer2Role: '',
    signer2SignatureUrl: ''
  });

  const fetchPrograms = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'programs'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPrograms(data);
    } catch (error) {
      console.error("Error fetching programs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleOpenModal = (prog = null, defaultStatus = 'published') => {
    if (prog) {
      setEditingId(prog.id);
      
      let initialFacilities = Array.isArray(prog.facilities) ? [...prog.facilities] : ['E-Sertifikat', 'Dokumentasi Kegiatan'];
      if (Array.isArray(prog.transportation)) {
        prog.transportation.forEach(t => {
          const matchLabel = t.toLowerCase().startsWith('transport') ? t : `Transportasi (${t})`;
          if (!initialFacilities.some(f => f.toLowerCase().includes(t.toLowerCase()))) {
            initialFacilities.push(matchLabel);
          }
        });
      }

      setFormData({
        ...prog,
        slug: prog.slug || slugify(prog.title || ''),
        status: (prog.status === 'draft' || prog.status === 'Draft' || prog.isDraft) ? 'draft' : 'published',
        documentationDriveUrl: prog.documentationDriveUrl || '',
        facilities: initialFacilities,
        transportation: Array.isArray(prog.transportation) ? prog.transportation : ['Hiace'],
        isPaid: Boolean(prog.isPaid),
        price: Number(prog.price) || 0,
        beneficiariesCount: prog.beneficiariesCount !== undefined && prog.beneficiariesCount !== null ? prog.beneficiariesCount : (prog.beneficiaries !== undefined && prog.beneficiaries !== null ? prog.beneficiaries : ''),
        certificateTemplateUrl: prog.certificateTemplateUrl || '',
        signer1Name: prog.signer1Name || 'Abi Bhaskara',
        signer1Role: prog.signer1Role || 'Project Leader Untuk Esok',
        signer1SignatureUrl: prog.signer1SignatureUrl || '',
        signer2Name: prog.signer2Name || '',
        signer2Role: prog.signer2Role || '',
        signer2SignatureUrl: prog.signer2SignatureUrl || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        slug: '',
        category: 'Pendidikan',
        status: defaultStatus,
        date: '',
        startTime: '',
        endTime: '',
        location: '',
        imageUrl: '',
        volunteersTarget: 0,
        volunteersJoined: 0,
        daysLeft: 0,
        deadline: '',
        urgent: false,
        description: '',
        whatsappGroupLink: '',
        twibbonLink: '',
        documentationDriveUrl: '',
        tasks: '',
        criteria: '',
        facilities: ['E-Sertifikat', 'Dokumentasi Kegiatan', 'Transportasi (Hiace)'],
        transportation: ['Hiace'],
        isPaid: false,
        price: 0,
        beneficiariesCount: '',
        certificateTemplateUrl: '',
        signer1Name: 'Abi Bhaskara',
        signer1Role: 'Project Leader Untuk Esok',
        signer1SignatureUrl: '',
        signer2Name: '',
        signer2Role: '',
        signer2SignatureUrl: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleToggleFacility = (facility) => {
    setFormData(prev => {
      const current = prev.facilities || [];
      const exists = current.includes(facility);
      return {
        ...prev,
        facilities: exists ? current.filter(f => f !== facility) : [...current, facility]
      };
    });
  };

  const handleToggleDraft = async (prog) => {
    const isCurrentlyDraft = prog.status === 'draft' || prog.status === 'Draft' || Boolean(prog.isDraft);
    const newStatus = isCurrentlyDraft ? 'published' : 'draft';
    const confirmMsg = isCurrentlyDraft 
      ? `Tampilkan program "${prog.title}" ke publik di website?` 
      : `Sembunyikan program "${prog.title}" menjadi DRAFT (tidak akan muncul di website)?`;
    
    if (!confirm(confirmMsg)) return;

    try {
      await updateDoc(doc(db, 'programs', prog.id), {
        status: newStatus,
        isDraft: newStatus === 'draft'
      });
      clearCache('programs');
      fetchPrograms();
    } catch (err) {
      console.error("Error toggling draft status:", err);
      alert("Gagal mengubah status program.");
    }
  };

  const handleSubmit = async (e, forcedStatus = null) => {
    if (e?.preventDefault) e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const finalStatus = forcedStatus || formData.status || 'published';
      const finalSlug = slugify(formData.slug || formData.title);
      const payload = {
        ...formData,
        slug: finalSlug,
        facilities: formData.facilities || [],
        transportation: formData.transportation || [],
        status: finalStatus,
        isDraft: finalStatus === 'draft',
        isPaid: Boolean(formData.isPaid),
        price: formData.isPaid ? Number(formData.price) || 0 : 0,
        beneficiariesCount: (formData.beneficiariesCount !== '' && formData.beneficiariesCount !== null && formData.beneficiariesCount !== undefined) ? Number(formData.beneficiariesCount) : 0,
        certificateTemplateUrl: formData.certificateTemplateUrl || '',
        signer1Name: formData.signer1Name || 'Abi Bhaskara',
        signer1Role: formData.signer1Role || 'Project Leader Untuk Esok',
        signer1SignatureUrl: formData.signer1SignatureUrl || '',
        signer2Name: formData.signer2Name || '',
        signer2Role: formData.signer2Role || '',
        signer2SignatureUrl: formData.signer2SignatureUrl || ''
      };

      if (editingId) {
        await updateDoc(doc(db, 'programs', editingId), payload);
      } else {
        await addDoc(collection(db, 'programs'), payload);
      }
      clearCache('programs');
      setIsModalOpen(false);
      fetchPrograms(); // Refresh
    } catch (error) {
      console.error("Error saving program:", error);
      alert("Gagal menyimpan data!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Yakin ingin menghapus program ini?")) {
      try {
        await deleteDoc(doc(db, 'programs', id));
        clearCache('programs');
        fetchPrograms();
      } catch (error) {
        console.error("Error deleting program:", error);
      }
    }
  };

  const handleExportProgramVolunteers = async (prog) => {
    try {
      const appSnap = await getDocs(collection(db, 'applications'));
      let progApps = appSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => a.programId === prog.id);

      if (progApps.length === 0) {
        alert(`Belum ada data relawan yang terdaftar untuk program "${prog.title}".`);
        return;
      }

      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const userMap = {};
        usersSnap.docs.forEach(uDoc => {
          userMap[uDoc.id] = uDoc.data();
        });
        progApps.forEach(app => {
          const u = userMap[app.userId];
          if (u) {
            if (u.name) app.userName = u.name;
            else if (u.displayName) app.userName = u.displayName;
            if (u.phone) app.userPhone = u.phone;
            if (u.email) app.userEmail = u.email;
          }
        });
      } catch (uErr) {
        console.warn("Could not enrich user profiles:", uErr);
      }

      progApps.sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
      exportVolunteersToExcel(progApps, prog.title);
    } catch (err) {
      console.error("Gagal mengekspor data relawan:", err);
      alert("Terjadi kesalahan saat memproses data relawan.");
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? '' : Number(value)) : value);

    if (name === 'isPaid') {
      val = value === 'true';
    }
    
    if (name === 'title') {
      const prevTitleSlug = slugify(formData.title);
      const isAutoSlug = !formData.slug || formData.slug === prevTitleSlug;
      setFormData(prev => ({
        ...prev,
        title: val,
        ...(isAutoSlug ? { slug: slugify(val) } : {})
      }));
    } else if (name === 'slug') {
      setFormData(prev => ({ ...prev, slug: slugify(val) }));
    } else if (name === 'date') {
      const { deadline, daysLeft } = calculateProgramDeadlineAndDaysLeft(value);
      setFormData(prev => ({ 
        ...prev, 
        date: value, 
        deadline: deadline, 
        daysLeft: daysLeft 
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: val }));
    }
  };

  const filteredPrograms = useMemo(() => {
    let list = [...programs];

    if (statusFilter === 'published') {
      list = list.filter(p => p.status !== 'draft' && p.status !== 'Draft' && !p.isDraft);
    } else if (statusFilter === 'draft') {
      list = list.filter(p => p.status === 'draft' || p.status === 'Draft' || p.isDraft);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        (p.title || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }

    // Universal Sorting
    list.sort((a, b) => {
      if (sortOrder === 'date_desc') {
        return new Date(b.date || 0) - new Date(a.date || 0);
      }
      if (sortOrder === 'date_asc') {
        return new Date(a.date || 0) - new Date(b.date || 0);
      }
      if (sortOrder === 'joined_desc') {
        return (Number(b.volunteersJoined) || 0) - (Number(a.volunteersJoined) || 0);
      }
      if (sortOrder === 'joined_asc') {
        return (Number(a.volunteersJoined) || 0) - (Number(b.volunteersJoined) || 0);
      }
      if (sortOrder === 'title_asc') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });

    return list;
  }, [programs, statusFilter, searchQuery, sortOrder]);

  const paginatedPrograms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPrograms.slice(start, start + pageSize);
  }, [filteredPrograms, currentPage, pageSize]);

  const publishedCount = programs.filter(p => p.status !== 'draft' && p.status !== 'Draft' && !p.isDraft).length;
  const draftCount = programs.filter(p => p.status === 'draft' || p.status === 'Draft' || p.isDraft).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="ue-eyebrow" style={{ marginBottom: '4px' }}>DIVISI PROGRAM & OPERASIONAL</div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Program & Kegiatan
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            type="button"
            onClick={() => handleOpenModal(null, 'published')} 
            className="ue-icon-btn"
            title="Tambah Program"
            aria-label="Tambah Program"
          >
            <FiPlus size={18} />
          </button>
        </div>
      </div>

      {/* SEARCH, FILTER & SORTING TOOLBAR */}
      <AdminSearchFilterBar
        searchValue={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Cari judul program, lokasi, atau deskripsi..."
        ariaLabel="Urutkan Kegiatan"
        title="Urutkan Kegiatan"
        style={{ marginBottom: '20px' }}
        sections={[
          {
            label: 'Status Program',
            value: statusFilter,
            onChange: (val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            },
            options: [
              { value: 'all', label: `Semua (${programs.length})` },
              { value: 'published', label: `Publik (${publishedCount})` },
              { value: 'draft', label: `Draft (${draftCount})` }
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
              { value: 'date_desc', label: 'Tanggal Pelaksanaan Terbaru' },
              { value: 'date_asc', label: 'Tanggal Pelaksanaan Terlama' },
              { value: 'joined_desc', label: 'Relawan Terbanyak' },
              { value: 'joined_asc', label: 'Relawan Tersedikit' },
              { value: 'title_asc', label: 'Judul (A-Z)' }
            ]
          }
        ]}
      />

      <div className="admin-table-card">
        <div className="admin-mobile-swipe-hint">
          <FiChevronRight size={14} /> Geser tabel ke kanan untuk melihat kapasitas & aksi
        </div>
        <div className="admin-table-responsive" style={{ minHeight: '340px' }}>
          <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #eaeaea' }}>
                <th style={{ padding: '16px 20px', color: '#666', fontWeight: 600 }}>Judul Program</th>
                <th style={{ padding: '16px 20px', color: '#666', fontWeight: 600 }}>Kategori & Tipe</th>
                <th style={{ padding: '16px 20px', color: '#666', fontWeight: 600 }}>Kapasitas</th>
                <th style={{ padding: '16px 20px', color: '#666', fontWeight: 600, textAlign: 'center' }} aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>Memuat data...</td></tr>
              ) : filteredPrograms.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    {statusFilter === 'draft' ? 'Tidak ada program dalam status Draft.' : statusFilter === 'published' ? 'Tidak ada program aktif publik.' : 'Belum ada program.'}
                  </td>
                </tr>
              ) : (
                paginatedPrograms.map((prog, rowIndex) => {
                  const isDraft = prog.status === 'draft' || prog.status === 'Draft' || Boolean(prog.isDraft);
                  const openMenuUpwards = paginatedPrograms.length > 2 && rowIndex >= paginatedPrograms.length - 2;
                  return (
                    <tr key={prog.id} style={{ borderBottom: '1px solid #eaeaea', background: isDraft ? '#fffdfa' : 'white' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isDraft && (
                            <span style={{ fontSize: '10.5px', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              DRAFT
                            </span>
                          )}
                          <span style={{ fontWeight: 600, fontSize: '13.5px', color: '#0F172A' }}>{prog.title}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>{prog.location}</div>
                        <div style={{ fontSize: '11.5px', color: '#0284c7', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                          <FiLink size={11} /> /programs/{prog.slug || prog.id}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ padding: '3px 9px', background: '#e6f7ff', color: '#0284c7', borderRadius: '100px', fontSize: '11.5px', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {prog.category}
                          </span>
                          {prog.isPaid && prog.price > 0 ? (
                            <span style={{ padding: '3px 9px', background: '#fef3c7', color: '#b45309', borderRadius: '100px', fontSize: '11.5px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                              Rp {Number(prog.price).toLocaleString('id-ID')}
                            </span>
                          ) : (
                            <span style={{ padding: '3px 9px', background: '#ecfdf5', color: '#059669', borderRadius: '100px', fontSize: '11.5px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                              Gratis
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{prog.volunteersJoined} / {prog.volunteersTarget} Relawan</div>
                        {Number(prog.beneficiariesCount || prog.beneficiaries) > 0 ? (
                          <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600, marginTop: '2px' }}>
                            {Number(prog.beneficiariesCount || prog.beneficiaries).toLocaleString('id-ID')} Terbantu
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                            Terbantu: -
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div className="program-action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuProgId(activeMenuProgId === prog.id ? null : prog.id);
                            }}
                            className="ue-icon-btn"
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              borderColor: activeMenuProgId === prog.id ? '#233B69' : 'var(--card-border, #E2E8F0)',
                              background: activeMenuProgId === prog.id ? '#233B69' : 'var(--card-bg, #FFFFFF)',
                              color: activeMenuProgId === prog.id ? '#FFFFFF' : 'var(--primary, #233B69)'
                            }}
                            title="Menu Aksi"
                            aria-expanded={activeMenuProgId === prog.id}
                          >
                            <FiMoreVertical size={16} />
                          </button>

                          {activeMenuProgId === prog.id && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                ...(openMenuUpwards
                                  ? { bottom: 'calc(100% + 4px)', top: 'auto' }
                                  : { top: 'calc(100% + 4px)', bottom: 'auto' }),
                                zIndex: 70,
                                background: '#FFFFFF',
                                borderRadius: '10px',
                                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
                                border: '1px solid #E2E8F0',
                                padding: '6px',
                                minWidth: '185px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                textAlign: 'left'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuProgId(null);
                                  handleToggleDraft(prog);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: isDraft ? '#d97706' : '#475569',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  width: '100%',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = isDraft ? '#fffbeb' : '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                {isDraft ? <FiEye size={14} /> : <FiEyeOff size={14} />}
                                <span>{isDraft ? 'Tampilkan (Publik)' : 'Sembunyikan (Draft)'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuProgId(null);
                                  router.push(`/admin/relawan?programId=${prog.id}`);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#059669',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  width: '100%',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#ecfdf5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <FiUsers size={14} />
                                <span>Lihat Pendaftar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuProgId(null);
                                  handleExportProgramVolunteers(prog);
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
                                <FiDownload size={14} />
                                <span>Export Excel</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuProgId(null);
                                  handleOpenModal(prog);
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
                                <span>Edit Program</span>
                              </button>

                              <div style={{ height: '1px', background: '#F1F5F9', margin: '2px 0' }} />

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuProgId(null);
                                  handleDelete(prog.id);
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
                                <span>Hapus Program</span>
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
          totalItems={filteredPrograms.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 50, 100]}
        />
      </div>

      {/* Modal Form Advance */}
      <AnimatePresence>
        {isModalOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="admin-modal-container"
            >
              <div className="admin-modal-header">
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0F172A' }}>
                  {editingId ? 'Edit Program Relawan' : 'Buat Program Baru'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#e0e0e0'} onMouseOut={e => e.currentTarget.style.background = '#f5f5f5'}>
                  <FiX />
                </button>
              </div>
              
              <form onSubmit={(e) => handleSubmit(e)} className="admin-modal-body">

                {/* SECTION 1: Informasi Dasar */}
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#1e293b' }}><FiInfo color="var(--primary)" /> Informasi Dasar</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Judul Program <span style={{ color: 'red' }}>*</span></label>
                      <input required name="title" value={formData.title} onChange={handleInputChange} placeholder="Ketik judul program yang menarik..." style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', transition: 'border 0.2s', background: 'white' }} onFocus={e => e.target.style.borderColor = 'var(--primary)'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
                    </div>

                    {/* Custom URL Slug Link */}
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiLink size={14} color="var(--primary)" /> Custom Link (URL Slug)
                        </span>
                        <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>
                          Preview: /programs/{formData.slug || slugify(formData.title) || 'nama-kegiatan'}
                        </span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: '12px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                        <span style={{ padding: '0 14px', fontSize: '13px', color: '#64748b', background: '#f8fafc', borderRight: '1px solid #cbd5e1', height: '46px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          /programs/
                        </span>
                        <input 
                          name="slug" 
                          value={formData.slug || ''} 
                          onChange={handleInputChange} 
                          placeholder={slugify(formData.title) || "contoh-nama-kegiatan"} 
                          style={{ flex: 1, padding: '12px 14px', border: 'none', outline: 'none', fontSize: '14.5px', background: 'transparent' }} 
                        />
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                        Tautan link kustom untuk kegiatan ini. Otomatis dibuat dari judul atau bisa Anda edit sesuai keinginan.
                      </p>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Kategori Program <span style={{ color: 'red' }}>*</span></label>
                        <select required name="category" value={formData.category} onChange={handleInputChange} style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: 'white', cursor: 'pointer' }}>
                          <option value="Pendidikan">Pendidikan</option>
                          <option value="Lingkungan">Lingkungan</option>
                          <option value="Kesehatan">Kesehatan</option>
                          <option value="Kreativitas">Kreativitas</option>
                          <option value="Sains & Teknologi">Sains & Teknologi</option>
                          <option value="Seni & Budaya">Seni & Budaya</option>
                          <option value="Sosial">Sosial</option>
                          <option value="Bencana Alam">Bencana Alam</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Deskripsi Lengkap <span style={{ color: 'red' }}>*</span></label>
                      <textarea required name="description" value={formData.description} onChange={handleInputChange} rows={5} placeholder="Jelaskan secara detail tentang program, kegiatan, dan dampaknya..." style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', resize: 'vertical', background: 'white', lineHeight: '1.6' }} onFocus={e => e.target.style.borderColor = 'var(--primary)'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
                    </div>

                    <div className="admin-grid-2col">
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Tugas Relawan <span style={{ color: 'red' }}>*</span></label>
                        <textarea required name="tasks" value={formData.tasks} onChange={handleInputChange} rows={4} placeholder="- Tugas 1&#10;- Tugas 2" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', resize: 'vertical', background: 'white', lineHeight: '1.6', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Kriteria Relawan <span style={{ color: 'red' }}>*</span></label>
                        <textarea required name="criteria" value={formData.criteria} onChange={handleInputChange} rows={4} placeholder="- Kriteria 1&#10;- Kriteria 2" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', resize: 'vertical', background: 'white', lineHeight: '1.6', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Waktu & Lokasi */}
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#1e293b' }}><FiMapPin color="var(--primary)" /> Pelaksanaan</h3>
                  <div className="admin-grid-2col">
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Waktu Pelaksanaan <span style={{ color: 'red' }}>*</span></label>
                      <input type="date" required name="date" value={formData.date} onChange={handleInputChange} style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', background: 'white', boxSizing: 'border-box' }} />
                      {formData.date && (
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b' }}>
                          Otomatis ditutup H-1 ({formData.deadline})<br/>
                          <span style={{ color: '#166534', fontWeight: 600 }}>Sisa waktu terhitung (GMT+8): {calculateDaysLeftGMT8(formData)} Hari</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Jam <span style={{ color: 'red' }}>*</span></label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="time" required name="startTime" value={formData.startTime} onChange={handleInputChange} style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', background: 'white', boxSizing: 'border-box' }} />
                        <span style={{ color: '#64748b', fontWeight: 600 }}>-</span>
                        <input type="time" required name="endTime" value={formData.endTime} onChange={handleInputChange} style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', background: 'white', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Titik Lokasi <span style={{ color: 'red' }}>*</span></label>
                      <input required name="location" value={formData.location} onChange={handleInputChange} placeholder="Misal: Desa Cibodas, Jawa Barat" style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', background: 'white', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>

                {/* SECTION: Fasilitas Kegiatan (Termasuk Transportasi) */}
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#1e293b' }}>
                        <FiAward color="var(--primary)" /> Fasilitas Kegiatan
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                        Pilih fasilitas dan transportasi yang disediakan untuk relawan.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Fasilitas Pokok */}
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Fasilitas Pokok
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {CORE_FACILITIES.map((opt) => {
                          const isSelected = (formData.facilities || []).includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleToggleFacility(opt)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 18px',
                                borderRadius: '10px',
                                fontSize: '13.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                border: isSelected ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                                background: isSelected ? 'rgba(32, 90, 40, 0.08)' : 'white',
                                color: isSelected ? 'var(--primary)' : '#475569'
                              }}
                            >
                              <span style={{ 
                                width: '18px', 
                                height: '18px', 
                                borderRadius: '4px', 
                                border: isSelected ? 'none' : '1.5px solid #cbd5e1', 
                                background: isSelected ? 'var(--primary)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '12px'
                              }}>
                                {isSelected && <FiCheck strokeWidth={3} />}
                              </span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Fasilitas Transportasi */}
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiTruck size={15} color="var(--primary)" /> Fasilitas Transportasi
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {TRANSPORT_FACILITIES.map((opt) => {
                          const isSelected = (formData.facilities || []).includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleToggleFacility(opt)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 18px',
                                borderRadius: '10px',
                                fontSize: '13.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                border: isSelected ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                                background: isSelected ? 'rgba(32, 90, 40, 0.08)' : 'white',
                                color: isSelected ? 'var(--primary)' : '#475569'
                              }}
                            >
                              <span style={{ 
                                width: '18px', 
                                height: '18px', 
                                borderRadius: '4px', 
                                border: isSelected ? 'none' : '1.5px solid #cbd5e1', 
                                background: isSelected ? 'var(--primary)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '12px'
                              }}>
                                {isSelected && <FiCheck strokeWidth={3} />}
                              </span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Tautan Media & Pendaftaran */}
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#1e293b' }}><FiLink color="var(--primary)" /> Tautan Penting</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>URL Poster / Gambar (Cover) <span style={{ color: 'red' }}>*</span></label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input required name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} placeholder="https://..." style={{ flex: 1, padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', background: 'white', boxSizing: 'border-box' }} />
                        {formData.imageUrl && (
                          <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                            <img src={formData.imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display='none'} />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="admin-grid-2col">
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Link WhatsApp Group (GC)</label>
                        <input name="whatsappGroupLink" value={formData.whatsappGroupLink || ''} onChange={handleInputChange} placeholder="https://chat.whatsapp.com/..." style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', background: 'white', boxSizing: 'border-box' }} />
                        <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>Akan otomatis terlihat oleh pendaftar</p>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Link Twibbon Campaign</label>
                        <input name="twibbonLink" value={formData.twibbonLink || ''} onChange={handleInputChange} placeholder="https://twibbonize.com/..." style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', background: 'white', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Link Google Drive Dokumentasi Program</label>
                      <input name="documentationDriveUrl" value={formData.documentationDriveUrl || ''} onChange={handleInputChange} placeholder="https://drive.google.com/drive/folders/..." style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', background: 'white', boxSizing: 'border-box' }} />
                      <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>Tautan folder Google Drive foto & dokumentasi kegiatan. Terbuka otomatis untuk relawan setelah mengisi kesan & pesan.</p>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: Kuota Relawan & Dampak Sosial */}
                <div style={{ background: '#fefce8', padding: '20px', borderRadius: '16px', border: '1px solid #fef08a' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#854d0e' }}><FiUsers /> Kapasitas Relawan & Penerima Manfaat</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#854d0e' }}>Target Relawan Dibutuhkan <span style={{ color: 'red' }}>*</span></label>
                      <input type="number" required name="volunteersTarget" value={formData.volunteersTarget} onChange={handleInputChange} min="1" style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #fde047', outline: 'none', fontSize: '14px', background: 'white', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#854d0e' }}>Jumlah Bergabung Saat Ini</label>
                      <input type="number" name="volunteersJoined" value={formData.volunteersJoined} onChange={handleInputChange} min="0" style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #fde047', outline: 'none', fontSize: '14px', background: 'white', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#854d0e' }}>Jumlah Orang yang Terbantu</label>
                      <input 
                        type="number" 
                        name="beneficiariesCount" 
                        placeholder="Contoh: 150 (Opsional)" 
                        value={formData.beneficiariesCount || ''} 
                        onChange={handleInputChange} 
                        min="0" 
                        style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #fde047', outline: 'none', fontSize: '14px', background: 'white', boxSizing: 'border-box' }} 
                      />
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#a16207' }}>Boleh tidak diisi di awal (opsional)</p>
                    </div>
                  </div>
                </div>

                {/* SKEMA PEMBAYARAN */}
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#1e293b' }}>
                    <FiDollarSign color="#166534" /> Skema Biaya & Pembayaran
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#166534' }}>Tipe Akses Program</label>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', background: !formData.isPaid ? '#f0fdf4' : 'white', border: `1.5px solid ${!formData.isPaid ? '#166534' : '#cbd5e1'}`, cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                          <input 
                            type="radio" 
                            name="isPaid" 
                            value="false" 
                            checked={!formData.isPaid} 
                            onChange={handleInputChange} 
                          />
                          Gratis (Free)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', background: formData.isPaid ? '#fef3c7' : 'white', border: `1.5px solid ${formData.isPaid ? '#f59e0b' : '#cbd5e1'}`, cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                          <input 
                            type="radio" 
                            name="isPaid" 
                            value="true" 
                            checked={formData.isPaid} 
                            onChange={handleInputChange} 
                          />
                          Berbayar (Midtrans / Manual Transfer)
                        </label>
                      </div>
                    </div>

                    {formData.isPaid && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        style={{ marginTop: '8px' }}
                      >
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#166534' }}>
                          Harga / Biaya Tiket Pendaftaran (Rp) <span style={{ color: 'red' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#64748b' }}>Rp</span>
                          <input 
                            type="number" 
                            required={formData.isPaid} 
                            name="price" 
                            value={formData.price} 
                            onChange={handleInputChange} 
                            min="1000" 
                            step="1000" 
                            placeholder="Contoh: 50000" 
                            style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: 'white', fontWeight: 600 }} 
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* SECTION 5: Penandatangan Sertifikat Otomatis Project */}
                <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <FiAward color="#166534" size={20} />
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#166534' }}>
                      Konfigurasi Sertifikat & Penandatangan Project
                    </h3>
                  </div>
                  <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#15803d' }}>
                    Sistem akan mengotomatiskan nama Project Manager dan Pihak Mitra pada template sertifikat untuk seluruh relawan di project ini.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Penandatangan 1: Project Leader */}
                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #dcfce7' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: '12px' }}>
                        1. Penandatangan Kiri (Project Leader Untuk Esok)
                      </div>
                      <div className="admin-grid-2col">
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '12.5px', color: '#334155' }}>Nama Lengkap PM <span style={{ color: 'red' }}>*</span></label>
                          <input
                            name="signer1Name"
                            value={formData.signer1Name || ''}
                            onChange={handleInputChange}
                            placeholder="Misal: Abi Bhaskara"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '12.5px', color: '#334155' }}>Jabatan PM</label>
                          <input
                            name="signer1Role"
                            value={formData.signer1Role || ''}
                            onChange={handleInputChange}
                            placeholder="Project Leader Untuk Esok"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '12.5px', color: '#334155' }}>URL Gambar Tanda Tangan PM (PNG Transparan, Opsional)</label>
                          <input
                            name="signer1SignatureUrl"
                            value={formData.signer1SignatureUrl || ''}
                            onChange={handleInputChange}
                            placeholder="https://.../signature_pm.png"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Penandatangan 2: Pihak Mitra / Kolaborator */}
                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #dcfce7' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: '12px' }}>
                        2. Penandatangan Kanan (Pihak Mitra Kerja Sama / Yayasan)
                      </div>
                      <div className="admin-grid-2col">
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '12.5px', color: '#334155' }}>Nama Lengkap Mitra</label>
                          <input
                            name="signer2Name"
                            value={formData.signer2Name || ''}
                            onChange={handleInputChange}
                            placeholder="Misal: Wayan Sudarma / Dr. Nama Mitra"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '12.5px', color: '#334155' }}>Jabatan & Instansi Mitra</label>
                          <input
                            name="signer2Role"
                            value={formData.signer2Role || ''}
                            onChange={handleInputChange}
                            placeholder="Manager Yayasan Lentera Anak Bali"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '12.5px', color: '#334155' }}>URL Gambar Tanda Tangan Mitra (PNG Transparan, Opsional)</label>
                          <input
                            name="signer2SignatureUrl"
                            value={formData.signer2SignatureUrl || ''}
                            onChange={handleInputChange}
                            placeholder="https://.../signature_mitra.png"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', position: 'sticky', bottom: '-32px', background: 'white', padding: '20px 0', borderTop: '1px solid #eaeaea', zIndex: 10, flexWrap: 'wrap' }}>
                  <button type="button" disabled={isSubmitting} onClick={() => setIsModalOpen(false)} style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s', opacity: isSubmitting ? 0.6 : 1 }}>
                    Batal
                  </button>
                  
                  <button 
                    type="button" 
                    disabled={isSubmitting}
                    onClick={(e) => handleSubmit(e, 'draft')}
                    style={{ 
                      padding: '12px 22px', 
                      borderRadius: '12px', 
                      border: '1.5px solid #f59e0b', 
                      background: '#fffbeb', 
                      color: '#b45309', 
                      cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                      fontWeight: 700, 
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: isSubmitting ? 0.7 : 1
                    }}
                  >
                    <FiFileText /> {isSubmitting ? 'Menyimpan...' : 'Simpan sebagai Draft'}
                  </button>

                  <button 
                    type="button" 
                    disabled={isSubmitting}
                    onClick={(e) => handleSubmit(e, 'published')}
                    style={{ 
                      padding: '12px 24px', 
                      borderRadius: '12px', 
                      border: 'none', 
                      background: 'var(--primary)', 
                      color: 'white', 
                      cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                      fontWeight: 700, 
                      fontSize: '14px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      boxShadow: 'none',
                      opacity: isSubmitting ? 0.7 : 1
                    }}
                  >
                    <FiCheckCircle /> {isSubmitting ? 'Menyimpan...' : (editingId ? 'Simpan & Publikasikan' : 'Terbitkan Sekarang')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
