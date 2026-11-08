'use client';

import { useMemo } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function AdminPagination({
  currentPage = 1,
  pageSize = 10,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 50, 100]
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers to display with smart ellipsis
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [];
    if (safePage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (safePage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '14px 18px',
        background: '#FFFFFF',
        borderTop: '1px solid #E2E8F0',
        borderRadius: '0 0 16px 16px',
        fontSize: '13px',
        color: '#475569'
      }}
    >
      {/* KIRI: Show 10, 50, 100 from X data */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 500, color: '#64748B' }}>Show</span>
        <select
          value={pageSize}
          onChange={(e) => {
            const newSize = Number(e.target.value);
            if (onPageSizeChange) onPageSizeChange(newSize);
            if (onPageChange) onPageChange(1);
          }}
          aria-label="Pilih jumlah baris per halaman"
          style={{
            padding: '4px 10px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            background: '#F8FAFC',
            color: '#0F172A',
            fontSize: '12.5px',
            fontWeight: 700,
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span style={{ color: '#64748B' }}>
          from <strong style={{ color: '#0F172A' }}>{totalItems}</strong> data
        </span>
        {totalItems > 0 && (
          <span style={{ color: '#94A3B8', fontSize: '12px' }}>
            ({startItem}–{endItem})
          </span>
        )}
      </div>

      {/* KANAN: Navigasi Slide Kiri - Kanan / Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Tombol Sebelumnya / Slide Kiri */}
        <button
          type="button"
          onClick={() => onPageChange && onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          title="Halaman sebelumnya"
          aria-label="Halaman sebelumnya"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            border: '1px solid var(--card-border, #E2E8F0)',
            background: safePage <= 1 ? '#F8FAFC' : '#FFFFFF',
            color: safePage <= 1 ? '#CBD5E1' : '#233B69',
            cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <FiChevronLeft size={16} />
        </button>

        {/* Nomor Halaman */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '0 4px',
                    color: '#94A3B8',
                    fontSize: '12px',
                    userSelect: 'none'
                  }}
                >
                  …
                </span>
              );
            }

            const isActive = p === safePage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange && onPageChange(p)}
                style={{
                  minWidth: '34px',
                  height: '34px',
                  padding: '0 8px',
                  borderRadius: '999px',
                  border: isActive ? '1px solid #233B69' : '1px solid var(--card-border, #E2E8F0)',
                  background: isActive ? '#233B69' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#233B69',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Tombol Selanjutnya / Slide Kanan */}
        <button
          type="button"
          onClick={() => onPageChange && onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          title="Halaman selanjutnya"
          aria-label="Halaman selanjutnya"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            border: '1px solid var(--card-border, #E2E8F0)',
            background: safePage >= totalPages ? '#F8FAFC' : '#FFFFFF',
            color: safePage >= totalPages ? '#CBD5E1' : '#233B69',
            cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <FiChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

