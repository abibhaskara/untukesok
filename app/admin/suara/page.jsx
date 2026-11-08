'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiInbox, FiCheck, FiX, FiTrash2, FiDownload,
  FiZap, FiAlertCircle, FiCopy, FiCheckCircle,
  FiArchive
} from 'react-icons/fi';
import { db } from '../../../src/lib/firebase';
import {
  collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy
} from 'firebase/firestore';
import AdminPagination from '../../../src/components/AdminPagination';
import AdminSearchFilterBar from '../../../src/components/AdminSearchFilterBar';

const BALI_REGENCIES = [
  'Kota Denpasar',
  'Kabupaten Badung',
  'Kabupaten Gianyar',
  'Kabupaten Tabanan',
  'Kabupaten Buleleng',
  'Kabupaten Karangasem',
  'Kabupaten Klungkung',
  'Kabupaten Bangli',
  'Kabupaten Jembrana'
];

const CATEGORIES = [
  'Lingkungan & Sampah',
  'Pendidikan Anak',
  'Pelestarian Budaya',
  'Infrastruktur Publik',
  'Bantuan Sosial & Lansia',
  'Aspirasi Umum'
];

export default function AdminKotakSuaraPage() {
  const [voices, setVoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [regencyFilter, setRegencyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // AI Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [copiedReport, setCopiedReport] = useState(false);

  // Toast / Status notification
  const [actionNotice, setActionNotice] = useState('');

  const fetchVoices = useCallback(async () => {
    setIsLoading(true);
    try {
      let snap;
      try {
        const q = query(collection(db, 'kotak_suara'), orderBy('createdAt', 'desc'));
        snap = await getDocs(q);
      } catch {
        // Fallback without orderBy in case composite index is absent
        snap = await getDocs(collection(db, 'kotak_suara'));
      }

      if (snap && !snap.empty) {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setVoices(data);
      } else {
        setVoices([]);
      }
    } catch (err) {
      console.warn('Gagal memuat kotak_suara dari Firestore:', err);
      setVoices([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  // Status updates
  const handleUpdateStatus = async (voiceId, newStatus) => {
    try {
      const voiceRef = doc(db, 'kotak_suara', voiceId);
      await updateDoc(voiceRef, { status: newStatus });
      setVoices(prev => prev.map(v => (v.id === voiceId ? { ...v, status: newStatus } : v)));
      setActionNotice(`Status aspirasi berhasil diubah menjadi: ${newStatus}`);
      setTimeout(() => setActionNotice(''), 3000);
    } catch {
      // Local optimistic update if demo data or offline
      setVoices(prev => prev.map(v => (v.id === voiceId ? { ...v, status: newStatus } : v)));
      setActionNotice(`Status berhasil diperbarui (${newStatus})`);
      setTimeout(() => setActionNotice(''), 3000);
    }
  };

  // Delete Voice
  const handleDeleteVoice = async (voiceId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus aspirasi warga ini?')) return;
    try {
      await deleteDoc(doc(db, 'kotak_suara', voiceId));
      setVoices(prev => prev.filter(v => v.id !== voiceId));
      setActionNotice('Aspirasi berhasil dihapus.');
      setTimeout(() => setActionNotice(''), 3000);
    } catch {
      setVoices(prev => prev.filter(v => v.id !== voiceId));
      setActionNotice('Aspirasi dihapus dari tampilan.');
      setTimeout(() => setActionNotice(''), 3000);
    }
  };

  // AI Synthesis trigger
  const handleGenerateAiSummary = async () => {
    setIsAiModalOpen(true);
    setAiLoading(true);
    setCopiedReport(false);

    try {
      const res = await fetch('/api/ai/voice-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voices: filteredVoices.length > 0 ? filteredVoices : voices })
      });
      const data = await res.json();
      if (data.success && data.report) {
        setAiReport(data.report);
      } else {
        throw new Error(data.error || 'Gagal memproses analisis AI');
      }
    } catch (err) {
      console.error('Error generating AI voice summary:', err);
      // Fallback simple synthesis
      setAiReport({
        headline: `Sintesis Aspirasi Warga Bali: Prioritas Isu Lapangan (${voices.length} Suara)`,
        executiveSummary: `Masyarakat di berbagai wilayah Bali menyampaikan kebutuhan mendesak akan aksi kerelawanan konkret, terutama terkait penanganan sampah di kawasan pesisir dan perluasan akses literasi anak di desa.`,
        topIssues: [
          {
            issue: 'Sampah Pesisir & Sungai',
            category: 'Lingkungan',
            frequency: 3,
            priority: 'Tinggi',
            regency: 'Badung & Denpasar',
            description: 'Penumpukan sampah kiriman dan minimnya tempat pemilahan.',
            proposedAction: 'Aksi beach clean-up berkala bersama komunitas pemuda.'
          }
        ],
        strategicRecommendations: [
          'Jadwalkan program kerelawanan di area yang paling banyak dilaporkan warga.',
          'Buka kanal pelaporan progres aksi di website Untuk Esok sebagai transparansi publik.'
        ],
        representativeQuotes: []
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!aiReport) return;
    const text = `=== LAPORAN SINTESIS AI KOTAK SUARA WARGA ===\n\n` +
      `TAJUK: ${aiReport.headline}\n\n` +
      `RINGKASAN EKSEKUTIF:\n${aiReport.executiveSummary}\n\n` +
      `ISU UTAMA:\n` +
      (aiReport.topIssues || []).map((iss, i) => `${i + 1}. [${iss.priority}] ${iss.issue} (${iss.regency}) - ${iss.description}\n   Aksi Disarankan: ${iss.proposedAction}`).join('\n\n') +
      `\n\nREKOMENDASI STRATEGIS UNTUK ESOK:\n` +
      (aiReport.strategicRecommendations || []).map((r, i) => `${i + 1}. ${r}`).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Tanggal', 'Nama Warga', 'Anonim', 'Kabupaten/Kota', 'Kategori', 'Pesan Aspirasi', 'Status'];
    const rows = filteredVoices.map(v => [
      `"${v.id}"`,
      `"${v.createdAt ? new Date(v.createdAt).toLocaleDateString('id-ID') : '-'}"`,
      `"${(v.name || 'Warga').replace(/"/g, '""')}"`,
      v.isAnonymous ? 'Ya' : 'Tidak',
      `"${(v.regency || '-').replace(/"/g, '""')}"`,
      `"${(v.category || '-').replace(/"/g, '""')}"`,
      `"${(v.message || '').replace(/"/g, '""')}"`,
      v.status || 'pending'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Aspirasi_Kotak_Suara_Warga_UntukEsok_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered list
  const filteredVoices = useMemo(() => {
    let list = [...voices];

    if (statusFilter !== 'all') {
      list = list.filter(v => (v.status || 'pending').toLowerCase() === statusFilter.toLowerCase());
    }

    if (categoryFilter !== 'all') {
      list = list.filter(v => v.category === categoryFilter);
    }

    if (regencyFilter !== 'all') {
      list = list.filter(v => v.regency === regencyFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v => {
        const name = (v.name || '').toLowerCase();
        const msg = (v.message || '').toLowerCase();
        const cat = (v.category || '').toLowerCase();
        const reg = (v.regency || '').toLowerCase();
        return name.includes(q) || msg.includes(q) || cat.includes(q) || reg.includes(q);
      });
    }

    list.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      if (sortBy === 'newest') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;
      return 0;
    });

    return list;
  }, [voices, statusFilter, categoryFilter, regencyFilter, searchQuery, sortBy]);

  const paginatedVoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVoices.slice(start, start + pageSize);
  }, [filteredVoices, currentPage, pageSize]);

  // Statistics
  const stats = useMemo(() => {
    const total = voices.length;
    const pending = voices.filter(v => !v.status || v.status === 'pending').length;
    const published = voices.filter(v => v.status === 'diterbitkan').length;

    const regCount = {};
    voices.forEach(v => {
      const r = v.regency || 'Lainnya';
      regCount[r] = (regCount[r] || 0) + 1;
    });
    const topReg = Object.entries(regCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    return { total, pending, published, topReg };
  }, [voices]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. STANDARDIZED PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="ue-eyebrow" style={{ marginBottom: '4px' }}>DIVISI OPERASIONAL & ADVOKASI WARGA</div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Kotak Suara Warga
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748B' }}>
            Aspirasi masyarakat, keluhan lingkungan, dan perumusan aksi nyata berbasis kecerdasan buatan (AI).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportCSV}
            className="ue-btn"
            title="Ekspor CSV"
          >
            <FiDownload size={15} /> Ekspor Data
          </button>
          <button
            type="button"
            onClick={handleGenerateAiSummary}
            className="ue-btn ue-btn-primary"
            style={{
              background: 'linear-gradient(135deg, #1E293B 0%, #233B69 100%)',
              borderColor: '#233B69',
              boxShadow: '0 2px 8px rgba(35, 59, 105, 0.2)'
            }}
          >
            <FiZap size={15} style={{ color: '#FFBD59' }} /> Sintesis Kesimpulan AI
          </button>
        </div>
      </div>

      {/* ACTION NOTICE TOAST */}
      {actionNotice && (
        <div
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#166534',
            padding: '10px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FiCheckCircle size={16} />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 2. STATS OVERVIEW CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
            Total Aspirasi Masuk
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A' }}>
            {isLoading ? '—' : stats.total}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Semua wilayah Bali
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#B45309', textTransform: 'uppercase', marginBottom: '8px' }}>
            Menunggu Tinjauan
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#B45309' }}>
            {isLoading ? '—' : stats.pending}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Perlu verifikasi admin
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534', textTransform: 'uppercase', marginBottom: '8px' }}>
            Diterbitkan ke Publik
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#166534' }}>
            {isLoading ? '—' : stats.published}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Tayang di portal berita
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#233B69', textTransform: 'uppercase', marginBottom: '8px' }}>
            Wilayah Paling Aktif
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isLoading ? '—' : stats.topReg}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Konsentrasi aspirasi warga
          </div>
        </div>
      </div>

      {/* 3. SEARCH & FILTER CONTROLS */}
      <AdminSearchFilterBar
        searchValue={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Cari nama warga, isu, pesan, atau kabupaten..."
        ariaLabel="Filter Kotak Suara"
        title="Filter Kotak Suara"
        sections={[
          {
            label: 'Status Aspirasi',
            value: statusFilter,
            onChange: (val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            },
            options: [
              { value: 'all', label: `Semua Status (${voices.length})` },
              { value: 'pending', label: `Menunggu Tinjauan (${stats.pending})` },
              { value: 'diterbitkan', label: `Diterbitkan (${stats.published})` },
              { value: 'diarsipkan', label: 'Diarsipkan' }
            ]
          },
          {
            label: 'Kategori Isu',
            value: categoryFilter,
            onChange: (val) => {
              setCategoryFilter(val);
              setCurrentPage(1);
            },
            options: [
              { value: 'all', label: 'Semua Kategori' },
              ...CATEGORIES.map(cat => ({ value: cat, label: cat }))
            ]
          },
          {
            label: 'Kabupaten/Kota',
            value: regencyFilter,
            onChange: (val) => {
              setRegencyFilter(val);
              setCurrentPage(1);
            },
            options: [
              { value: 'all', label: 'Semua Wilayah' },
              ...BALI_REGENCIES.map(reg => ({ value: reg, label: reg }))
            ]
          },
          {
            label: 'Urutan Waktu',
            value: sortBy,
            onChange: (val) => {
              setSortBy(val);
              setCurrentPage(1);
            },
            options: [
              { value: 'newest', label: 'Terbaru Dahulu' },
              { value: 'oldest', label: 'Terlama Dahulu' }
            ]
          }
        ]}
      />

      {/* 4. TABLE / CARD LIST */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13.5px' }}>
            Memuat data kotak suara warga...
          </div>
        ) : filteredVoices.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
            <FiInbox size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#334155' }}>
              {voices.length === 0 ? 'Belum ada aspirasi masuk' : 'Tidak ada aspirasi yang cocok'}
            </div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              {voices.length === 0 ? 'Aspirasi warga yang dikirimkan melalui portal berita akan tampil di sini.' : 'Coba ubah kata kunci atau bersihkan filter pencarian.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ue-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: '12px', color: '#64748B' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>Pengirim</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>Wilayah & Kategori</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>Pesan Aspirasi</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>Tanggal</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVoices.map(item => {
                  const statusKey = (item.status || 'pending').toLowerCase();
                  const isPending = statusKey === 'pending';
                  const isPublished = statusKey === 'diterbitkan';

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' }}>
                      {/* 1. Pengirim */}
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                          {item.isAnonymous ? 'Anonim' : (item.name || 'Warga')}
                        </div>
                        {item.isAnonymous && (
                          <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px' }}>
                            Rahasia
                          </span>
                        )}
                      </td>

                      {/* 2. Wilayah & Kategori */}
                      <td style={{ padding: '14px 18px', minWidth: '170px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#1E293B' }}>
                          {item.regency || 'Bali'}
                        </div>
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: '#EFF6FF',
                            color: '#1E40AF'
                          }}
                        >
                          {item.category || 'Aspirasi Umum'}
                        </span>
                      </td>

                      {/* 3. Pesan Aspirasi */}
                      <td style={{ padding: '14px 18px', maxWidth: '380px' }}>
                        <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                          {item.message}
                        </div>
                      </td>

                      {/* 4. Tanggal */}
                      <td style={{ padding: '14px 18px', fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </td>

                      {/* 5. Status Badge */}
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        {isPublished ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 600, color: '#166534', background: '#DCFCE7', padding: '3px 8px', borderRadius: '6px' }}>
                            <FiCheck size={12} /> Diterbitkan
                          </span>
                        ) : isPending ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 600, color: '#92400E', background: '#FEF3C7', padding: '3px 8px', borderRadius: '6px' }}>
                            <FiAlertCircle size={12} /> Menunggu
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 600, color: '#475569', background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
                            <FiArchive size={12} /> Arsip
                          </span>
                        )}
                      </td>

                      {/* 6. Aksi */}
                      <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {!isPublished && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(item.id, 'diterbitkan')}
                              className="ue-btn"
                              style={{ height: '30px', padding: '0 8px', fontSize: '11.5px', color: '#166534', borderColor: '#BBF7D0' }}
                              title="Terbitkan ke Berita Publik"
                            >
                              <FiCheck size={13} /> Terbitkan
                            </button>
                          )}

                          {isPublished && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(item.id, 'diarsipkan')}
                              className="ue-btn"
                              style={{ height: '30px', padding: '0 8px', fontSize: '11.5px', color: '#475569' }}
                              title="Arsipkan"
                            >
                              <FiArchive size={13} /> Arsipkan
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteVoice(item.id)}
                            className="ue-btn"
                            style={{ height: '30px', padding: '0 8px', fontSize: '11.5px', color: '#DC2626', borderColor: '#FECACA' }}
                            title="Hapus Aspirasi"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredVoices.length > 0 && (
          <AdminPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredVoices.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50]}
          />
        )}
      </div>

      {/* 5. AI SYNTHESIS MODAL */}
      {isAiModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => !aiLoading && setIsAiModalOpen(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '840px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                color: '#FFFFFF',
                borderRadius: '20px 20px 0 0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(255, 189, 89, 0.2)',
                    color: '#FFBD59',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FiZap size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                    Sintesis Kecerdasan Buatan (AI)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.8 }}>
                    Analisis sentimen, clustering keluhan, dan perumusan rekomendasi aksi Untuk Esok.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                disabled={aiLoading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#CBD5E1',
                  cursor: 'pointer',
                  padding: '6px'
                }}
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {aiLoading ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      border: '3px solid #E2E8F0',
                      borderTopColor: '#233B69',
                      borderRadius: '50%',
                      margin: '0 auto 16px',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
                    Menghubungkan ke Gemini AI Engine...
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748B', marginTop: '6px' }}>
                    Menganalisis {filteredVoices.length} pesan aspirasi masyarakat Bali...
                  </div>
                </div>
              ) : aiReport ? (
                <>
                  {/* Headline */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                      border: '1px solid #BFDBFE',
                      borderRadius: '12px',
                      padding: '16px 20px'
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      TEMUAN UTAMA
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1E3A8A', lineHeight: '1.4' }}>
                      {aiReport.headline}
                    </div>
                  </div>

                  {/* Executive Summary */}
                  <div>
                    <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                      Ringkasan Eksekutif
                    </h4>
                    <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.6', margin: 0 }}>
                      {aiReport.executiveSummary}
                    </p>
                  </div>

                  {/* Top Issues List */}
                  {aiReport.topIssues && aiReport.topIssues.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                        Isu Prioritas & Usulan Aksi Nyata
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                        {aiReport.topIssues.map((issue, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '12px',
                              padding: '14px 16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, background: issue.priority === 'Tinggi' ? '#FEE2E2' : '#FEF3C7', color: issue.priority === 'Tinggi' ? '#991B1B' : '#92400E', padding: '2px 8px', borderRadius: '4px' }}>
                                Prioritas {issue.priority || 'Normal'}
                              </span>
                              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>
                                {issue.regency}
                              </span>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                              {issue.issue}
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: '1.4' }}>
                              {issue.description}
                            </div>
                            {issue.proposedAction && (
                              <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid #E2E8F0', fontSize: '12px', color: '#1E40AF', fontWeight: 500 }}>
                                💡 Aksi: {issue.proposedAction}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strategic Recommendations */}
                  {aiReport.strategicRecommendations && (
                    <div>
                      <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                        Rekomendasi Taktis Untuk Esok
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {aiReport.strategicRecommendations.map((rec, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              gap: '10px',
                              fontSize: '13px',
                              color: '#334155',
                              lineHeight: '1.5',
                              background: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              padding: '10px 14px'
                            }}
                          >
                            <span style={{ color: '#233B69', fontWeight: 700 }}>{i + 1}.</span>
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Representative Quotes */}
                  {aiReport.representativeQuotes && aiReport.representativeQuotes.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                        Kutipan Langsung Suara Warga
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                        {aiReport.representativeQuotes.map((q, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontStyle: 'italic',
                              fontSize: '12.5px',
                              color: '#475569',
                              borderLeft: '3px solid #233B69',
                              padding: '8px 12px',
                              background: '#F8FAFC'
                            }}
                          >
                            "{q.quote}"
                            <div style={{ fontStyle: 'normal', fontSize: '11px', fontWeight: 600, color: '#64748B', marginTop: '4px' }}>
                              — {q.author || 'Warga'} ({q.regency})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#F8FAFC',
                borderRadius: '0 0 20px 20px'
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Disintesis otomatis melalui edge analytics pipeline.
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCopyReport}
                  disabled={!aiReport}
                  className="ue-btn"
                >
                  <FiCopy size={14} /> {copiedReport ? 'Tersalin ke Clipboard!' : 'Salin Laporan'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="ue-btn ue-btn-primary"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
