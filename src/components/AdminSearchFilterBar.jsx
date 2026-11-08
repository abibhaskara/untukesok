'use client';

import { useState, useRef, useEffect } from 'react';
import { FiSearch, FiX, FiCheck } from 'react-icons/fi';

/**
 * Reusable Admin Search & Filter Bar
 * - Separated pill search input on the left + circular 46x46 filter button on the right
 * - Single floating dropdown container divided into multiple sections when multiple filters exist
 */
export default function AdminSearchFilterBar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Cari data...',
  hideSearch = false,
  ariaLabel = 'Urutkan Kegiatan',
  title = 'Urutkan Kegiatan',
  sections = [],
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: hideSearch ? 'auto' : '100%',
        ...style
      }}
    >
      {!hideSearch && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--card-border, #e2e8f0)',
            borderRadius: '999px',
            padding: '0 20px',
            height: '46px',
            boxShadow: 'none',
            gap: '12px'
          }}
        >
          <FiSearch size={18} style={{ color: 'var(--primary, #233B69)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              width: '100%',
              fontSize: '13.5px',
              fontFamily: 'var(--font-poppins), inherit',
              color: 'var(--text, #0f172a)'
            }}
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text, #64748b)',
                padding: '2px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              aria-label="Hapus pencarian"
            >
              <FiX size={16} />
            </button>
          )}
        </div>
      )}

      {/* Separated Filter / Sort Circular Button */}
      <div ref={containerRef} style={{ position: 'relative' }}>
        {(() => {
          const activeFilterCount = sections.filter((s, _idx) => {
            if (!s.options || s.options.length === 0) return false;
            const defaultVal = s.defaultValue !== undefined ? s.defaultValue : s.options[0]?.value;
            return s.value !== undefined && s.value !== defaultVal;
          }).length;

          return (
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-label={ariaLabel}
              title={title}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: isOpen ? 'var(--primary, #233B69)' : 'var(--card-bg, #ffffff)',
                border: activeFilterCount > 0 && !isOpen ? '1.5px solid var(--primary, #233B69)' : '1px solid var(--card-border, #e2e8f0)',
                color: isOpen ? '#ffffff' : 'var(--text, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'none',
                transition: '0.2s',
                flexShrink: 0,
                position: 'relative'
              }}
            >
              <svg
                stroke="currentColor"
                fill="none"
                strokeWidth="2"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
                height="18"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
                style={{ color: isOpen ? '#ffffff' : 'var(--primary, #233B69)' }}
              >
                <line x1="4" y1="21" x2="4" y2="14"></line>
                <line x1="4" y1="10" x2="4" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="3"></line>
                <line x1="20" y1="21" x2="20" y2="16"></line>
                <line x1="20" y1="12" x2="20" y2="3"></line>
                <line x1="1" y1="14" x2="7" y2="14"></line>
                <line x1="9" y1="8" x2="15" y2="8"></line>
                <line x1="17" y1="16" x2="23" y2="16"></line>
              </svg>
              {activeFilterCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#233B69',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #ffffff'
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          );
        })()}

        {/* Single Dropdown Container with Multiple Filter Sections */}
        {isOpen && sections.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.05)',
              zIndex: 120,
              minWidth: '250px',
              maxWidth: '320px',
              maxHeight: '78vh',
              overflowY: 'auto',
              padding: '8px'
            }}
          >
            {sections.map((sec, secIdx) => (
              <div
                key={sec.label || secIdx}
                style={{
                  borderTop: secIdx > 0 ? '1px solid #f1f5f9' : 'none',
                  paddingTop: secIdx > 0 ? '8px' : '0',
                  marginTop: secIdx > 0 ? '6px' : '0'
                }}
              >
                {sec.label && (
                  <div
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      color: '#64748b',
                      padding: '4px 12px 6px 12px'
                    }}
                  >
                    {sec.label}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    maxHeight: (sec.options?.length || 0) > 6 ? '185px' : 'none',
                    overflowY: (sec.options?.length || 0) > 6 ? 'auto' : 'visible'
                  }}
                >
                  {(sec.options || []).map((opt) => {
                    const isSelected = sec.value === opt.value;
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => {
                          sec.onChange?.(opt.value);
                          if (sections.length === 1 || sec.closeOnSelect) {
                            setIsOpen(false);
                          }
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '9px 12px',
                          borderRadius: '10px',
                          border: 'none',
                          background: isSelected ? '#f1f5f9' : '#ffffff',
                          color: isSelected ? 'var(--primary, #233B69)' : '#1e293b',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          fontFamily: 'var(--font-poppins), inherit',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {opt.label}
                        </span>
                        {isSelected && <FiCheck size={15} style={{ flexShrink: 0, color: 'var(--primary, #233B69)' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

