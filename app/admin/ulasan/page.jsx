'use client';

import { useState, useMemo } from 'react';
import { 
  FiStar, FiDownload, FiCheck, 
  FiMessageSquare, 
  FiShield, FiCalendar
} from 'react-icons/fi';
import { useAdminData } from '../../../src/context/AdminDataContext';
import AdminPagination from '../../../src/components/AdminPagination';
import AdminSearchFilterBar from '../../../src/components/AdminSearchFilterBar';

function getInitials(name = 'Relawan') {
  return String(name)
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'UE';
}

export default function AdminReviewsPage() {
  const { applications, programs, isLoading } = useAdminData();

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'rating_desc', 'rating_asc'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Extract all applications that have feedback
  const allReviews = useMemo(() => {
    return (applications || []).filter(app => {
      return Boolean(app.feedbackSubmitted || app.rating || app.kesan || app.pesan);
    });
  }, [applications]);

  // Filtered Reviews List
  const filteredReviews = useMemo(() => {
    let list = [...allReviews];

    // 1. Program filter
    if (selectedProgram !== 'all') {
      list = list.filter(r => r.programId === selectedProgram);
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => {
        const name = (r.userName || '').toLowerCase();
        const email = (r.userEmail || '').toLowerCase();
        const prog = (r.programTitle || '').toLowerCase();
        const kesan = (r.kesan || '').toLowerCase();
        const pesan = (r.pesan || '').toLowerCase();
        return name.includes(q) || email.includes(q) || prog.includes(q) || kesan.includes(q) || pesan.includes(q);
      });
    }

    // 4. Sorting
    list.sort((a, b) => {
      const dateA = new Date(a.feedbackSubmittedAt || a.appliedAt || 0).getTime();
      const dateB = new Date(b.feedbackSubmittedAt || b.appliedAt || 0).getTime();
      const rateA = Number(a.rating) || 0;
      const rateB = Number(b.rating) || 0;

      if (sortBy === 'newest') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;
      if (sortBy === 'rating_desc') return rateB - rateA || dateB - dateA;
      if (sortBy === 'rating_asc') return rateA - rateB || dateB - dateA;
      return 0;
    });

    return list;
  }, [allReviews, selectedProgram, searchQuery, sortBy]);

  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReviews.slice(start, start + pageSize);
  }, [filteredReviews, currentPage, pageSize]);

  // Export to CSV helper
  const handleExportCSV = () => {
    if (filteredReviews.length === 0) {
      alert('Tidak ada data ulasan untuk diekspor.');
      return;
    }

    const headers = [
      'ID',
      'Tanggal Ulasan',
      'Nama Relawan',
      'Email',
      'Kontak / WA',
      'Program Kegiatan',
      'Rating Bintang',
      'Pembelajaran & Kesan',
      'Pesan & Saran',
      'Izin Testimoni Publik'
    ];

    const rows = filteredReviews.map(r => [
      `"${r.id}"`,
      `"${r.feedbackSubmittedAt ? new Date(r.feedbackSubmittedAt).toLocaleDateString('id-ID') : '-'}"`,
      `"${(r.userName || '').replace(/"/g, '""')}"`,
      `"${r.userEmail || '-'}"`,
      `"${r.userPhone || '-'}"`,
      `"${(r.programTitle || '').replace(/"/g, '""')}"`,
      r.rating || 5,
      `"${(r.kesan || '').replace(/"/g, '""')}"`,
      `"${(r.pesan || '').replace(/"/g, '""')}"`,
      r.allowPublicTestimonial ? 'Ya (Publik)' : 'Tidak (Internal)'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Ulasan_Relawan_UntukEsok_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. STANDARDIZED PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="ue-eyebrow" style={{ marginBottom: '4px' }}>DIVISI RELAWAN & EVALUASI</div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Ulasan & Refleksi Relawan
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleExportCSV}
            className="ue-icon-btn"
            title="Ekspor CSV"
            aria-label="Ekspor CSV"
          >
            <FiDownload size={16} />
          </button>
        </div>
      </div>

      {/* SEARCH & FILTER CONTROLS */}
      <AdminSearchFilterBar
        searchValue={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Cari nama relawan, kata kunci kesan, atau pesan..."
        ariaLabel="Urutkan Kegiatan"
        title="Urutkan Kegiatan"
        sections={[
          {
            label: 'Filter Program',
            value: selectedProgram,
            onChange: (val) => {
              setSelectedProgram(val);
              setCurrentPage(1);
            },
            options: [
              { value: 'all', label: `Semua Program (${allReviews.length})` },
              ...programs.map(p => ({
                value: p.id,
                label: `${p.title} (${allReviews.filter(r => r.programId === p.id).length})`
              }))
            ]
          },
          {
            label: 'Urutkan',
            value: sortBy,
            onChange: (val) => {
              setSortBy(val);
              setCurrentPage(1);
            },
            options: [
              { value: 'newest', label: 'Terbaru' },
              { value: 'oldest', label: 'Terlama' },
              { value: 'rating_desc', label: 'Rating Tertinggi (5★)' },
              { value: 'rating_asc', label: 'Rating Terendah (1★)' }
            ]
          }
        ]}
      />

      {/* 5. REVIEWS FEED LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {isLoading ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#64748B' }}>
            Memuat data ulasan relawan...
          </div>
        ) : filteredReviews.length === 0 ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#F1F5F9', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
              <FiMessageSquare size={22} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
              Tidak ada ulasan ditemukan
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
              Coba sesuaikan kata kunci pencarian atau filter rating di atas.
            </p>
          </div>
        ) : (
          paginatedReviews.map((review) => {
            const dateStr = review.feedbackSubmittedAt
              ? new Date(review.feedbackSubmittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
              : review.appliedAt
                ? new Date(review.appliedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Tanggal tidak tercatat';

            const ratingVal = Number(review.rating) || 5;

            return (
              <div
                key={review.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '22px 24px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  transition: 'border-color 0.15s ease'
                }}
              >
                {/* Header: User & Rating */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: '#EFF6FF',
                        color: '#233B69',
                        fontSize: '13px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {getInitials(review.userName)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A' }}>
                          {review.userName}
                        </span>
                        {review.allowPublicTestimonial ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#ECFDF5', color: '#059669', fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px' }}>
                            <FiCheck size={11} /> Izin Publikasi
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#F1F5F9', color: '#64748B', fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px' }}>
                            <FiShield size={10} /> Privat
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        {[review.userEmail, review.userPhone].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>

                  {/* Rating Stars & Date */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#FFFBEB',
                        border: '1px solid #FCD34D',
                        borderRadius: '999px',
                        padding: '4px 10px'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#B45309', fontVariantNumeric: 'tabular-nums' }}>
                        ★ {ratingVal.toFixed(1)}
                      </span>
                      <div style={{ display: 'flex', gap: '1px', color: '#F59E0B' }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <FiStar
                            key={s}
                            size={12}
                            style={{
                              fill: s <= ratingVal ? '#F59E0B' : 'transparent',
                              color: s <= ratingVal ? '#F59E0B' : '#D1D5DB'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <FiCalendar size={11} /> {dateStr}
                    </span>
                  </div>
                </div>

                {/* Program Tag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#233B69', background: '#EEF2F8', padding: '3px 9px', borderRadius: '6px' }}>
                    {review.programTitle || 'Program Untuk Esok'}
                  </span>
                </div>

                {/* Review Body (Kesan & Pesan) */}
                <div style={{ display: 'grid', gridTemplateColumns: review.pesan ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr', gap: '14px', background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                  {/* Kesan / Pembelajaran */}
                  <div>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                      Pembelajaran & Refleksi:
                    </span>
                    <p style={{ margin: 0, fontSize: '13.5px', color: '#1E293B', lineHeight: 1.6, fontStyle: 'italic' }}>
                      “{review.kesan || 'Relawan tidak menyertakan rincian refleksi tertulis.'}”
                    </p>
                  </div>

                  {/* Pesan untuk Tim (Jika ada) */}
                  {review.pesan && (
                    <div style={{ borderLeft: '2px solid #E2E8F0', paddingLeft: '14px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                        Pesan & Saran untuk Tim:
                      </span>
                      <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.55 }}>
                        {review.pesan}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* PAGINATION */}
        <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
          <AdminPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredReviews.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 50, 100]}
          />
        </div>
      </div>
    </div>
  );
}

