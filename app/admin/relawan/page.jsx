'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FiAward, FiX, FiPhone, FiUserX,
  FiDownload, FiStar,
  FiRefreshCw, FiZap, FiSlash,
  FiCalendar, FiCheck,
  FiMoreVertical, FiEye, FiExternalLink, FiFileText
} from 'react-icons/fi';
import { db } from '../../../src/lib/firebase';
import { collection, getDocs, doc, updateDoc, increment, addDoc } from 'firebase/firestore';
import { exportVolunteersToExcel } from '../../../src/lib/exportExcel';
import { generateCertificatePreviewUrl, downloadCertificatePng, formatCertNumber, getMaxCertOrder } from '../../../src/lib/certificateGenerator';
import { getAppAmount } from '../../../src/lib/paymentUtils';
import AdminPagination from '../../../src/components/AdminPagination';
import AdminSearchFilterBar from '../../../src/components/AdminSearchFilterBar';

export default function AdminApplications() {
  const [applications, setApplications] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortOrder, setSortOrder] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [activeMenuAppId, setActiveMenuAppId] = useState(null);

  // Modal State: Certificate Manager
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [certificateUrl, setCertificateUrl] = useState('');
  const [editStatus, setEditStatus] = useState('Selesai');
  const [editAmount, setEditAmount] = useState(0);
  const [editPaymentStatus, setEditPaymentStatus] = useState('PAID');
  const [editPaymentMethod, setEditPaymentMethod] = useState('Manual Admin');
  const [certPreviewUrl, setCertPreviewUrl] = useState('');
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);

  // Modal State: Proof Image Preview
  const [previewImage, setPreviewImage] = useState(null);

  // Modal State: Feedback Details Preview
  const [previewFeedback, setPreviewFeedback] = useState(null);

  // Modal State: Manual Registration
  const [isManualRegModalOpen, setIsManualRegModalOpen] = useState(false);
  const [isSubmittingManualReg, setIsSubmittingManualReg] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRegProgram, setSelectedRegProgram] = useState(null);
  const [manualRegForm, setManualRegForm] = useState({
    status: 'Terdaftar',
    paymentStatus: 'PAID',
    paymentMethod: 'Manual Admin',
    amount: 0,
    noCertificate: false,
    notes: ''
  });

  // Close active 3-dots dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.app-action-menu-container')) {
        setActiveMenuAppId(null);
      }
    };
    if (activeMenuAppId) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [activeMenuAppId]);

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'applications'));
      let data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      try {
        const progSnap = await getDocs(collection(db, 'programs'));
        const progList = progSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPrograms(progList);
      } catch (progErr) {
        console.warn('Failed to fetch programs list:', progErr);
      }

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const filterProgramId = urlParams.get('programId');
        if (filterProgramId) setSelectedProgramId(filterProgramId);
        const filterQuery = urlParams.get('q');
        if (filterQuery) setSearchKeyword(filterQuery);
      }

      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const userMap = {};
        const uList = usersSnap.docs.map(uDoc => ({ id: uDoc.id, ...uDoc.data() }));
        setUsersList(uList);

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
        console.warn('Failed to fetch latest users for applications:', userFetchErr);
      }

      data.sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
      setApplications(data);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications().then(() => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const regUid = params.get('registerUserId') || params.get('userId');
        if (regUid) {
          setTimeout(() => {
            handleOpenManualReg(regUid);
          }, 300);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenModal = async (app) => {
    let currentApp = { ...app };
    let hasChanges = false;

    if (!currentApp.noCertificate) {
      if (!currentApp.credentialId) {
        const newCredentialId = `CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        try {
          await updateDoc(doc(db, 'applications', currentApp.id), { credentialId: newCredentialId });
          currentApp.credentialId = newCredentialId;
          hasChanges = true;
        } catch (error) {
          console.error('Failed to generate credentialId', error);
        }
      }

      if (!currentApp.certificateNumber) {
        const nextOrder = getMaxCertOrder(applications, false) + 1;
        const newCertificateNumber = formatCertNumber(nextOrder, currentApp.programDate);
        try {
          await updateDoc(doc(db, 'applications', currentApp.id), { certificateNumber: newCertificateNumber });
          currentApp.certificateNumber = newCertificateNumber;
          hasChanges = true;
        } catch (error) {
          console.error('Failed to generate certificateNumber', error);
        }
      }
    }

    if (hasChanges) {
      setApplications(prev => prev.map(a => a.id === currentApp.id ? currentApp : a));
    }

    const relatedProg = programs.find(p => p.id === currentApp.programId);
    const enrichedApp = {
      ...currentApp,
      signer1Name: relatedProg?.signer1Name || 'Abi Bhaskara',
      signer1Role: relatedProg?.signer1Role || 'Project Leader Untuk Esok',
      signer1SignatureUrl: relatedProg?.signer1SignatureUrl || null,
      signer2Name: relatedProg?.signer2Name || 'Wayan Sudarma',
      signer2Role: relatedProg?.signer2Role || 'Manager Yayasan / Pihak Mitra',
      signer2SignatureUrl: relatedProg?.signer2SignatureUrl || null,
      certificateTemplateUrl: relatedProg?.certificateTemplateUrl || '/certificate-template-official.jpg',
      programTitle: currentApp.programTitle || relatedProg?.title || 'Untuk Esok',
      programDate: currentApp.programDate || relatedProg?.date,
    };

    setEditingApp(enrichedApp);
    setCertificateUrl(currentApp.certificateUrl || (currentApp.credentialId ? `/verify/${currentApp.credentialId}` : ''));
    setEditStatus(currentApp.status || (currentApp.certificateUrl ? 'Selesai' : 'Terdaftar'));
    const defaultAmount = getAppAmount(currentApp);
    setEditAmount(defaultAmount);
    setEditPaymentStatus(currentApp.paymentStatus || (defaultAmount > 0 || currentApp.isPaid ? 'PAID' : 'FREE'));
    setEditPaymentMethod(currentApp.paymentMethod || (defaultAmount > 0 ? 'Manual Admin' : 'Gratis'));
    setIsModalOpen(true);

    if (!currentApp.noCertificate && enrichedApp.credentialId) {
      setIsGeneratingCert(true);
      generateCertificatePreviewUrl(enrichedApp)
        .then(url => setCertPreviewUrl(url || ''))
        .catch(err => {
          console.error('Preview err:', err);
          setCertPreviewUrl('');
        })
        .finally(() => setIsGeneratingCert(false));
    } else {
      setCertPreviewUrl('');
    }
  };

  const handleQuickPublishCertificate = async (appToPublish = null) => {
    const target = appToPublish || editingApp;
    if (!target) return;

    try {
      let finalCredId = target.credentialId;
      let finalCertNumber = target.certificateNumber;

      if (!finalCredId) {
        finalCredId = `CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      }
      if (!finalCertNumber) {
        const nextOrder = getMaxCertOrder(applications, false) + 1;
        finalCertNumber = formatCertNumber(nextOrder, target.programDate);
      }

      const finalCertUrl = `/verify/${finalCredId}`;
      await updateDoc(doc(db, 'applications', target.id), {
        status: 'Selesai',
        certificateUrl: finalCertUrl,
        credentialId: finalCredId,
        certificateNumber: finalCertNumber,
        noCertificate: false
      });

      alert(`Sertifikat berhasil diterbitkan untuk "${target.userName || 'Relawan'}"!`);
      if (isModalOpen) setIsModalOpen(false);
      fetchApplications();
    } catch (err) {
      console.error('Gagal menerbitkan sertifikat:', err);
      alert('Gagal menerbitkan sertifikat: ' + err.message);
    }
  };

  const handleDownloadCertificate = () => {
    if (!editingApp) return;
    downloadCertificatePng(editingApp);
  };

  const handleToggleNoCertificate = async (app) => {
    const isCurrentlyNoCert = Boolean(app.noCertificate);
    if (isCurrentlyNoCert) {
      if (!window.confirm(`Aktifkan kembali penerbitan sertifikat untuk relawan "${app.userName || 'ini'}"?`)) return;
      try {
        await updateDoc(doc(db, 'applications', app.id), { noCertificate: false });
        if (isModalOpen) setIsModalOpen(false);
        fetchApplications();
      } catch (error) {
        console.error('Gagal mengaktifkan sertifikat:', error);
        alert('Terjadi kesalahan saat mengaktifkan sertifikat.');
      }
    } else {
      if (!window.confirm(`Tandai relawan "${app.userName || 'ini'}" sebagai TIDAK MENDAPATKAN SERTIFIKAT (Batch 1-3)?\n\nStatus akan disetel ke 'Selesai'.`)) return;
      try {
        await updateDoc(doc(db, 'applications', app.id), {
          noCertificate: true,
          status: 'Selesai',
          certificateUrl: '',
          certificateNumber: '',
          credentialId: ''
        });
        if (isModalOpen) setIsModalOpen(false);
        fetchApplications();
      } catch (error) {
        console.error('Gagal menandai tanpa sertifikat:', error);
        alert('Terjadi kesalahan saat menyimpan data.');
      }
    }
  };

  const handleSaveCertificate = async (e) => {
    e.preventDefault();
    if (!editingApp) return;

    try {
      const finalAmount = Number(editAmount || 0);
      const isPaidFlag = finalAmount > 0 || editPaymentStatus === 'PAID';
      const updateData = {
        certificateUrl: certificateUrl,
        noCertificate: false,
        amount: finalAmount,
        paymentStatus: editPaymentStatus,
        paymentMethod: editPaymentMethod,
        isPaid: isPaidFlag
      };
      if (certificateUrl.trim() !== '') {
        updateData.status = 'Selesai';
      } else {
        updateData.status = editStatus || 'Terdaftar';
      }

      await updateDoc(doc(db, 'applications', editingApp.id), updateData);
      setIsModalOpen(false);
      fetchApplications();
    } catch (error) {
      console.error('Error saving certificate:', error);
      alert('Gagal menyimpan data sertifikat!');
    }
  };

  const handleKickApplication = async (app) => {
    if (!window.confirm(`Yakin ingin MENGELUARKAN relawan "${app.userName || 'ini'}" dari program "${app.programTitle}"?`)) return;

    try {
      await updateDoc(doc(db, 'applications', app.id), {
        status: 'Dikeluarkan',
        kickedAt: new Date().toISOString()
      });

      if (app.status === 'Terdaftar' && app.programId) {
        await updateDoc(doc(db, 'programs', app.programId), {
          volunteersJoined: increment(-1)
        });
      }

      alert('Relawan berhasil dikeluarkan.');
      fetchApplications();
    } catch (error) {
      console.error('Gagal mengeluarkan relawan:', error);
      alert('Terjadi kesalahan.');
    }
  };

  const handleBulkGenerateCertificates = async () => {
    const targetApps = filteredApplications.filter(a => a.status !== 'Dibatalkan' && a.status !== 'Dikeluarkan' && !a.noCertificate && !a.certificateNumber);
    if (targetApps.length === 0) {
      alert('Semua relawan pada filter ini sudah memiliki nomor sertifikat atau ditandai tanpa sertifikat.');
      return;
    }

    if (!window.confirm(`Terbitkan & berikan nomor sertifikat resmi otomatis ke ${targetApps.length} relawan sekaligus?`)) {
      return;
    }

    setIsBulkProcessing(true);
    try {
      let maxOrder = getMaxCertOrder(applications, false);
      targetApps.sort((a, b) => new Date(a.appliedAt || 0) - new Date(b.appliedAt || 0));

      for (let app of targetApps) {
        maxOrder += 1;
        const newNumber = formatCertNumber(maxOrder, app.programDate);
        const newCredentialId = app.credentialId || `CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

        await updateDoc(doc(db, 'applications', app.id), {
          certificateNumber: newNumber,
          credentialId: newCredentialId,
          certificateUrl: `/verify/${newCredentialId}`,
          status: 'Selesai',
          noCertificate: false
        });
      }

      alert(`Sukses! ${targetApps.length} sertifikat resmi berhasil diterbitkan.`);
      fetchApplications();
    } catch (err) {
      console.error('Bulk certificate generation error:', err);
      alert('Gagal menerbitkan sertifikat massal: ' + err.message);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Manual Registration Handlers
  const handleOpenManualReg = (presetUserId = null) => {
    let initialUser = null;
    if (presetUserId && usersList.length > 0) {
      initialUser = usersList.find(u => u.id === presetUserId) || null;
    }
    setSelectedUser(initialUser);

    let initialProg = null;
    if (selectedProgramId && selectedProgramId !== 'all') {
      initialProg = programs.find(p => p.id === selectedProgramId) || null;
    } else if (programs.length > 0) {
      initialProg = programs[0];
    }
    setSelectedRegProgram(initialProg);

    const isPaid = initialProg ? Boolean(initialProg.isPaid && Number(initialProg.price) > 0) : false;
    setManualRegForm({
      status: 'Terdaftar',
      paymentStatus: isPaid ? 'PAID' : 'FREE',
      paymentMethod: isPaid ? 'Manual Admin' : 'Gratis',
      amount: isPaid ? Number(initialProg.price) : 0,
      noCertificate: false,
      notes: ''
    });
    setUserSearchTerm('');
    setIsManualRegModalOpen(true);
  };

  const handleSelectProgramInManualReg = (progId) => {
    const prog = programs.find(p => p.id === progId);
    setSelectedRegProgram(prog);
    if (prog) {
      const isPaid = Boolean(prog.isPaid && Number(prog.price) > 0);
      setManualRegForm(prev => ({
        ...prev,
        amount: isPaid ? Number(prog.price) : 0,
        paymentStatus: isPaid ? 'PAID' : 'FREE',
        paymentMethod: isPaid ? 'Manual Admin' : 'Gratis'
      }));
    }
  };

  const handleSubmitManualReg = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      alert('Silakan pilih akun relawan terlebih dahulu.');
      return;
    }
    if (!selectedRegProgram) {
      alert('Silakan pilih program kegiatan.');
      return;
    }

    const alreadyJoined = applications.some(a =>
      a.userId === selectedUser.id &&
      a.programId === selectedRegProgram.id &&
      a.status !== 'Dibatalkan' &&
      a.status !== 'Dikeluarkan'
    );

    if (alreadyJoined) {
      if (!window.confirm(`Perhatian: Relawan "${selectedUser.name || selectedUser.displayName}" sudah terdaftar aktif di program ini. Tetap daftarkan?`)) {
        return;
      }
    }

    setIsSubmittingManualReg(true);
    try {
      const appliedTimestamp = new Date().toISOString();
      const generatedOrderId = `REG-MANUAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      let finalCredentialId = '';
      let finalCertNumber = '';
      let finalCertUrl = '';

      if (!manualRegForm.noCertificate) {
        finalCredentialId = `CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        if (manualRegForm.status === 'Selesai') {
          const nextOrder = getMaxCertOrder(applications, false) + 1;
          finalCertNumber = formatCertNumber(nextOrder, selectedRegProgram.date);
          finalCertUrl = `/verify/${finalCredentialId}`;
        }
      }

      const finalAmount = Number(manualRegForm.amount || 0);

      await addDoc(collection(db, 'applications'), {
        userId: selectedUser.id,
        userName: selectedUser.name || selectedUser.displayName || 'Relawan',
        userEmail: selectedUser.email || '',
        userPhone: selectedUser.phone || '',
        programId: selectedRegProgram.id,
        programTitle: selectedRegProgram.title || 'Program Relawan',
        programDate: selectedRegProgram.date || '',
        appliedAt: appliedTimestamp,
        status: manualRegForm.status,
        paymentStatus: manualRegForm.paymentStatus,
        paymentMethod: manualRegForm.paymentMethod,
        amount: finalAmount,
        isPaid: finalAmount > 0 || manualRegForm.paymentStatus === 'PAID',
        noCertificate: Boolean(manualRegForm.noCertificate),
        credentialId: finalCredentialId,
        certificateNumber: finalCertNumber,
        certificateUrl: finalCertUrl,
        registeredByAdmin: true,
        orderId: generatedOrderId,
        adminNotes: manualRegForm.notes || 'Didaftarkan manual via Dashboard Admin'
      });

      if (manualRegForm.status === 'Terdaftar') {
        await updateDoc(doc(db, 'programs', selectedRegProgram.id), {
          volunteersJoined: increment(1)
        });
      }

      alert(`Sukses! Relawan "${selectedUser.name || selectedUser.displayName}" berhasil didaftarkan ke ${selectedRegProgram.title}.`);
      setIsManualRegModalOpen(false);
      fetchApplications();
    } catch (err) {
      console.error('Manual registration error:', err);
      alert('Gagal mendaftarkan relawan: ' + err.message);
    } finally {
      setIsSubmittingManualReg(false);
    }
  };

  // Filtered Applications Calculation
  const filteredApplications = useMemo(() => {
    let list = [...applications];

    if (selectedProgramId && selectedProgramId !== 'all') {
      list = list.filter(app => app.programId === selectedProgramId);
    }

    if (searchKeyword.trim() !== '') {
      const q = searchKeyword.toLowerCase();
      list = list.filter(app =>
        (app.userName || '').toLowerCase().includes(q) ||
        (app.userPhone || '').toLowerCase().includes(q) ||
        (app.userEmail || '').toLowerCase().includes(q) ||
        (app.programTitle || '').toLowerCase().includes(q) ||
        (app.orderId || '').toLowerCase().includes(q) ||
        (app.certificateNumber || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortOrder === 'date_desc') return new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0);
      if (sortOrder === 'date_asc') return new Date(a.appliedAt || 0) - new Date(b.appliedAt || 0);
      if (sortOrder === 'name_asc') return (a.userName || '').localeCompare(b.userName || '');
      if (sortOrder === 'name_desc') return (b.userName || '').localeCompare(a.userName || '');
      if (sortOrder === 'rating_desc') return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      return 0;
    });

    return list;
  }, [applications, selectedProgramId, searchKeyword, sortOrder]);

  const paginatedApplications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredApplications.slice(start, start + pageSize);
  }, [filteredApplications, currentPage, pageSize]);

  const handleExportExcel = () => {
    let progTitle = 'Semua_Program';
    if (selectedProgramId && selectedProgramId !== 'all') {
      const prog = programs.find(p => p.id === selectedProgramId);
      if (prog) progTitle = prog.title || selectedProgramId;
    }
    exportVolunteersToExcel(filteredApplications, progTitle);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* HEADER & ACTION CONTROLS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="ue-eyebrow" style={{ marginBottom: '4px' }}>DIVISI RELAWAN & OPERASIONAL</div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Relawan
          </h1>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            disabled={isBulkProcessing}
            onClick={handleBulkGenerateCertificates}
            className="ue-icon-btn"
            title="Terbitkan sertifikat otomatis untuk semua relawan selesai yang belum punya nomor"
          >
            <FiFileText size={16} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="ue-icon-btn"
            title={`Unduh rekapitulasi data relawan dalam format Excel (${filteredApplications.length})`}
          >
            <FiDownload size={16} />
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH PANEL */}
      <AdminSearchFilterBar
        searchValue={searchKeyword}
        onSearchChange={(val) => {
          setSearchKeyword(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Cari nama, HP, email, atau no sertifikat…"
        ariaLabel="Urutkan Kegiatan"
        title="Urutkan Kegiatan"
        sections={[
          {
            label: 'Filter Program',
            value: selectedProgramId,
            onChange: (val) => {
              setSelectedProgramId(val);
              setCurrentPage(1);
            },
            options: [
              { value: 'all', label: `Semua Program (${applications.length})` },
              ...programs.map(p => ({
                value: p.id,
                label: `${p.title} (${applications.filter(a => a.programId === p.id).length})`
              }))
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
              { value: 'date_desc', label: 'Terbaru' },
              { value: 'date_asc', label: 'Terlama' },
              { value: 'name_asc', label: 'Nama A-Z' },
              { value: 'name_desc', label: 'Nama Z-A' },
              { value: 'rating_desc', label: 'Rating Tertinggi' }
            ]
          }
        ]}
      />

      {/* DATA TABLE */}
      <div className="ue-table-wrap" style={{ minHeight: '380px', overflow: 'hidden' }}>
        <div className="admin-table-responsive">
          <table className="ue-table">
            <thead>
              <tr>
                <th style={{ width: '34%' }}>Relawan</th>
                <th style={{ width: '28%' }}>Program Kegiatan</th>
                <th style={{ width: '18%' }}>Berkas Bukti</th>
                <th style={{ width: '14%' }}>Sertifikat</th>
                <th style={{ width: '6%', textAlign: 'center' }} aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                    <FiRefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    Memuat data pendaftar relawan…
                  </td>
                </tr>
              ) : filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                    Tidak ada data relawan yang sesuai dengan filter atau kata kunci.
                  </td>
                </tr>
              ) : (
                paginatedApplications.map((app, rowIndex) => {
                  const openMenuUpwards = paginatedApplications.length > 2 && rowIndex >= paginatedApplications.length - 2;
                  const initials = (app.userName || 'Relawan')
                    .split(' ')
                    .map(w => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const waPhone = (app.userPhone || '').replace(/[^0-9]/g, '');
                  const waLink = waPhone ? `https://wa.me/${waPhone.startsWith('0') ? '62' + waPhone.slice(1) : waPhone}` : null;

                  return (
                    <tr key={app.id}>
                      {/* Kolom 1: Relawan */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="ue-avatar">{initials}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                              {app.userName || 'Relawan'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748B' }}>
                              {app.userPhone ? (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#166534', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                  title="Chat WhatsApp"
                                >
                                  <FiPhone size={11} /> {app.userPhone}
                                </a>
                              ) : (
                                <span>-</span>
                              )}
                              {app.userEmail && (
                                <span style={{ color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  • {app.userEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kolom 2: Program */}
                      <td>
                        <div style={{ fontWeight: 500, color: '#0F172A', lineHeight: 1.3 }}>
                          {app.programTitle || 'Program Relawan'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FiCalendar size={11} />
                          {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </div>
                      </td>

                      {/* Kolom 3: Berkas Bukti */}
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {app.paymentProofUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage({ url: app.paymentProofUrl, title: `Bukti Pembayaran — ${app.userName}` })}
                              className="ue-btn"
                              style={{ height: '26px', padding: '0 8px', fontSize: '11px', color: '#1E40AF', borderColor: '#BFDBFE', background: '#EFF6FF' }}
                              title="Lihat Bukti Transfer"
                            >
                              <FiEye size={11} /> TF
                            </button>
                          ) : null}

                          {app.storyProofUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage({ url: app.storyProofUrl, title: `Bukti Story — ${app.userName}` })}
                              className="ue-btn"
                              style={{ height: '26px', padding: '0 8px', fontSize: '11px', color: '#6B21A8', borderColor: '#E9D5FF', background: '#FAF5FF' }}
                              title="Lihat Bukti Upload Story"
                            >
                              <FiEye size={11} /> Story
                            </button>
                          ) : null}

                          {app.igProofUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage({ url: app.igProofUrl, title: `Bukti Follow IG — ${app.userName}` })}
                              className="ue-btn"
                              style={{ height: '26px', padding: '0 8px', fontSize: '11px', color: '#166534', borderColor: '#BBF7D0', background: '#F0FDF4' }}
                              title="Lihat Bukti Follow Instagram"
                            >
                              <FiEye size={11} /> Follow
                            </button>
                          ) : null}

                          {!app.paymentProofUrl && !app.storyProofUrl && !app.igProofUrl && (
                            <span style={{ color: '#94A3B8', fontSize: '12px' }}>-</span>
                          )}
                        </div>
                      </td>

                      {/* Kolom 5: Sertifikat */}
                      <td>
                        {app.noCertificate ? (
                          <span className="ue-pill ue-pill-neutral" style={{ fontSize: '11.5px' }}>
                            Tanpa Sertifikat
                          </span>
                        ) : app.certificateUrl ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span className="ue-pill ue-pill-pos" style={{ fontSize: '11px', fontWeight: 600 }}>
                              <FiCheck size={11} /> Terbit
                            </span>
                            <span style={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'monospace' }}>
                              {app.certificateNumber || app.credentialId}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickPublishCertificate(app)}
                            className="ue-btn"
                            style={{ height: '28px', padding: '0 8px', fontSize: '11.5px', color: '#233B69', borderColor: '#CBD5E1' }}
                            title="Terbitkan sertifikat sekarang"
                          >
                            <FiZap size={12} style={{ color: '#FFBD59' }} />
                            <span>Terbitkan</span>
                          </button>
                        )}
                      </td>

                      {/* Kolom 6: Aksi (Titik 3) */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="app-action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuAppId(activeMenuAppId === app.id ? null : app.id);
                            }}
                            className="ue-icon-btn"
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              borderColor: activeMenuAppId === app.id ? '#233B69' : 'var(--card-border, #E2E8F0)',
                              background: activeMenuAppId === app.id ? '#233B69' : 'var(--card-bg, #FFFFFF)',
                              color: activeMenuAppId === app.id ? '#FFFFFF' : 'var(--primary, #233B69)'
                            }}
                            title="Menu Tindakan"
                            aria-expanded={activeMenuAppId === app.id}
                          >
                            <FiMoreVertical size={16} />
                          </button>

                          {activeMenuAppId === app.id && (
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
                                minWidth: '180px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                textAlign: 'left'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuAppId(null);
                                  handleOpenModal(app);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#0F172A',
                                  fontSize: '12.5px',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  width: '100%'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F1F5F9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <FiAward size={14} style={{ color: '#233B69' }} />
                                <span>Pratinjau Sertifikat</span>
                              </button>

                              {app.feedbackSubmitted && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuAppId(null);
                                    setPreviewFeedback(app);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#B45309',
                                    fontSize: '12.5px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#FFF7EA'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <FiStar size={14} style={{ color: '#FFBD59' }} />
                                  <span>Lihat Ulasan ({app.rating || 5}/5)</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuAppId(null);
                                  handleToggleNoCertificate(app);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#475569',
                                  fontSize: '12.5px',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  width: '100%'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F1F5F9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <FiSlash size={14} />
                                <span>{app.noCertificate ? 'Aktifkan Sertifikat' : 'Tandai Tanpa Sertifikat'}</span>
                              </button>

                              <div style={{ height: '1px', background: '#F1F5F9', margin: '2px 0' }} />

                              {app.status !== 'Dikeluarkan' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuAppId(null);
                                    handleKickApplication(app);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#991B1B',
                                    fontSize: '12.5px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <FiUserX size={14} />
                                  <span>Keluarkan Relawan</span>
                                </button>
                              )}
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

        {/* PAGINATION: Show 10, 50, 100 & Slide Nav */}
        <AdminPagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredApplications.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 50, 100]}
        />
      </div>

      {/* MODAL: PRATINJAU SERTIFIKAT DIGITAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '820px', border: '1px solid #E2E8F0', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div className="ue-eyebrow" style={{ marginBottom: '2px' }}>Sertifikat Digital Relawan</div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0F172A' }}>
                  {editingApp?.userName}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                  {editingApp?.programTitle}
                </p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="ue-icon-btn" style={{ width: '32px', height: '32px' }}>
                <FiX size={16} />
              </button>
            </div>

            {editingApp?.noCertificate ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1.5px dashed #CBD5E1' }}>
                <FiSlash size={32} style={{ color: '#64748B', margin: '0 auto 10px auto', display: 'block' }} />
                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0F172A' }}>Status: Tanpa Sertifikat</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B' }}>
                  Relawan ini ditandai tidak menerima e-sertifikat (kegiatan Batch 1-3).
                </p>
                <button
                  type="button"
                  onClick={() => handleToggleNoCertificate(editingApp)}
                  className="ue-btn ue-btn-primary"
                >
                  <FiCheck size={14} />
                  <span>Aktifkan Kembali Sertifikat</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Visual Canvas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', background: '#0F172A', minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isGeneratingCert ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                        <FiRefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 8px auto', display: 'block' }} />
                        <span style={{ fontSize: '12.5px' }}>Menghasilkan pratinjau sertifikat HD…</span>
                      </div>
                    ) : certPreviewUrl ? (
                      <img src={certPreviewUrl} alt="Certificate Preview" style={{ width: '100%', height: 'auto', display: 'block' }} />
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: '13px' }}>Pratinjau sertifikat belum tersedia</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleDownloadCertificate}
                      className="ue-btn ue-btn-primary"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <FiDownload size={14} />
                      <span>Unduh PNG HD</span>
                    </button>

                    {editingApp?.credentialId && (
                      <a
                        href={`/verify/${editingApp?.credentialId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ue-btn"
                        style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}
                      >
                        <FiExternalLink size={14} />
                        <span>Halaman Verifikasi</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Form Data Metadata */}
                <form onSubmit={handleSaveCertificate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Nomor Sertifikat Resmi
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editingApp?.certificateNumber || 'Akan di-generate otomatis saat terbit'}
                      style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#F1F5F9', color: '#0F172A', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      ID Kredensial Unik
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editingApp?.credentialId || '-'}
                      style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#F1F5F9', color: '#0F172A', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Status Relawan
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#0F172A', fontSize: '13px', boxSizing: 'border-box' }}
                    >
                      <option value="Selesai">Selesai (Memenuhi Syarat Sertifikat)</option>
                      <option value="Terdaftar">Terdaftar (Sedang Berjalan)</option>
                      <option value="Dikeluarkan">Dikeluarkan</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => handleQuickPublishCertificate(editingApp)}
                      className="ue-btn ue-btn-accent"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <FiZap size={14} />
                      <span>Terbitkan & Aktifkan</span>
                    </button>

                    <button
                      type="submit"
                      className="ue-btn ue-btn-primary"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <span>Simpan Perubahan</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: PRATINJAU GAMBAR BUKTI */}
      {previewImage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', maxWidth: '580px', width: '100%', padding: '20px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>{previewImage.title}</h4>
              <button type="button" onClick={() => setPreviewImage(null)} className="ue-icon-btn" style={{ width: '32px', height: '32px' }}>
                <FiX size={15} />
              </button>
            </div>
            <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #E2E8F0', maxHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
              <img src={previewImage.url} alt="Bukti" style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <a
                href={previewImage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ue-btn"
                style={{ textDecoration: 'none' }}
              >
                <FiExternalLink size={13} />
                <span>Buka ukuran penuh</span>
              </a>
              <button type="button" onClick={() => setPreviewImage(null)} className="ue-btn ue-btn-primary">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRATINJAU ULASAN & FEEDBACK */}
      {previewFeedback && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '24px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0F172A' }}>Ulasan Relawan</h4>
                <div style={{ fontSize: '12px', color: '#64748B' }}>{previewFeedback.userName} • {previewFeedback.programTitle}</div>
              </div>
              <button type="button" onClick={() => setPreviewFeedback(null)} className="ue-icon-btn" style={{ width: '32px', height: '32px' }}>
                <FiX size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '14px', color: '#FFBD59' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <FiStar
                  key={star}
                  size={18}
                  fill={star <= (previewFeedback.rating || 5) ? '#FFBD59' : 'none'}
                  stroke="#FFBD59"
                />
              ))}
              <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                {previewFeedback.rating || 5} / 5
              </span>
            </div>

            <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '14px', border: '1px solid #E2E8F0', fontSize: '13.5px', color: '#334155', lineHeight: 1.55 }}>
              "{previewFeedback.feedbackNotes || previewFeedback.feedbackText || 'Pengalaman yang sangat menyenangkan dan berdampak!'}"
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button type="button" onClick={() => setPreviewFeedback(null)} className="ue-btn ue-btn-primary">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DAFTARKAN RELAWAN MANUAL */}
      {isManualRegModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', maxWidth: '520px', width: '100%', padding: '24px', border: '1px solid #E2E8F0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#0F172A' }}>
                  Daftarkan Relawan Manual
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  Pilih akun relawan dan program kegiatan yang akan diikuti.
                </p>
              </div>
              <button type="button" onClick={() => setIsManualRegModalOpen(false)} className="ue-icon-btn" style={{ width: '32px', height: '32px' }}>
                <FiX size={15} />
              </button>
            </div>

            <form onSubmit={handleSubmitManualReg} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Cari & Pilih User */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Pilih Akun Relawan
                </label>
                {selectedUser ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#F8FAFC' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#0F172A' }}>{selectedUser.name || selectedUser.displayName}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748B' }}>{selectedUser.email} • {selectedUser.phone || '-'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="ue-btn"
                      style={{ height: '28px', padding: '0 8px', fontSize: '11.5px' }}
                    >
                      Ganti
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      placeholder="Ketik nama atau email relawan…"
                      style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                    />
                    {userSearchTerm && (
                      <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', marginTop: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                        {usersList
                          .filter(u =>
                            (u.name || u.displayName || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                            (u.email || '').toLowerCase().includes(userSearchTerm.toLowerCase())
                          )
                          .slice(0, 5)
                          .map(u => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => setSelectedUser(u)}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', fontSize: '12.5px' }}
                            >
                              <strong>{u.name || u.displayName}</strong> ({u.email})
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pilih Program Kegiatan */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Pilih Program Kegiatan
                </label>
                <select
                  value={selectedRegProgram?.id || ''}
                  onChange={(e) => handleSelectProgramInManualReg(e.target.value)}
                  style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#0F172A', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value="" disabled>-- Pilih Program --</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.isPaid ? `Rp ${Number(p.price || 0).toLocaleString('id-ID')}` : 'Gratis'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Pendaftaran & Pembayaran */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Status Kegiatan
                  </label>
                  <select
                    value={manualRegForm.status}
                    onChange={(e) => setManualRegForm(prev => ({ ...prev, status: e.target.value }))}
                    style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="Terdaftar">Terdaftar (Aktif)</option>
                    <option value="Selesai">Selesai (Siap Sertifikat)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Status Pembayaran
                  </label>
                  <select
                    value={manualRegForm.paymentStatus}
                    onChange={(e) => setManualRegForm(prev => ({ ...prev, paymentStatus: e.target.value }))}
                    style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="PAID">Lunas (PAID)</option>
                    <option value="FREE">Gratis</option>
                    <option value="PENDING">Menunggu (Pending)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsManualRegModalOpen(false)}
                  className="ue-btn"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManualReg}
                  className="ue-btn ue-btn-primary"
                >
                  {isSubmittingManualReg ? 'Menyimpan…' : 'Daftarkan Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
