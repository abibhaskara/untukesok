'use client';
import { useState } from 'react';
import { FiInstagram, FiChevronLeft, FiChevronRight, FiExternalLink, FiHeart, FiMessageCircle, FiShare2, FiBookmark } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function InstagramCarousel({ images = [], instagramUrl = '', articleTitle = '' }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const imageList = Array.isArray(images) 
    ? images.filter(img => typeof img === 'string' && img.trim().length > 0)
    : [];

  const targetUrl = instagramUrl && instagramUrl.trim() 
    ? instagramUrl.trim() 
    : 'https://www.instagram.com/untukesok';

  // If no images and no instagram URL, do not render anything
  if (imageList.length === 0 && !instagramUrl) {
    return null;
  }

  const handlePrev = (e) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev === 0 ? imageList.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev === imageList.length - 1 ? 0 : prev + 1));
  };


  if (imageList.length === 0 && instagramUrl) {
    return (
      <div style={{
        marginTop: '48px',
        padding: '24px',
        background: 'var(--card-bg, #ffffff)',
        borderRadius: '16px',
        border: '1px solid var(--card-border, #e2e8f0)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '22px'
          }}>
            <FiInstagram />
          </div>
          <div>
            <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-bold, #0f172a)' }}>
              Dokumentasi Instagram
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
              Lihat foto & liputan selengkapnya di akun resmi Instagram
            </p>
          </div>
        </div>
        <a
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '100px',
            background: 'linear-gradient(45deg, #f09433, #dc2743, #bc1888)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(220, 39, 67, 0.25)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <FiInstagram /> Buka Postingan <FiExternalLink />
        </a>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '56px',
      maxWidth: '640px',
      marginInline: 'auto',
      background: 'var(--card-bg, #ffffff)',
      borderRadius: '20px',
      border: '1px solid var(--card-border, #e2e8f0)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      overflow: 'hidden',
      transition: 'box-shadow 0.3s'
    }}>
      {/* HEADER CARD */}
      <div style={{
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--card-border, #f1f5f9)',
        background: 'var(--card-bg, #ffffff)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Gradient Ring Avatar */}
          <div style={{
            padding: '2px',
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
            display: 'inline-block'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: '#ffffff',
              border: '2px solid transparent',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 800,
              color: '#0f172a'
            }}>
              UE
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bold, #0f172a)' }}>
                untukesok
              </span>
              <span style={{ fontSize: '12px', color: '#3b82f6' }}>●</span>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Ikuti</span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
              {articleTitle ? articleTitle.substring(0, 36) + (articleTitle.length > 36 ? '...' : '') : 'Dokumentasi Kegiatan'}
            </p>
          </div>
        </div>

        <a
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '100px',
            background: 'rgba(220, 39, 67, 0.08)',
            color: '#dc2743',
            fontSize: '12px',
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(220, 39, 67, 0.15)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(220, 39, 67, 0.08)'}
        >
          <FiInstagram style={{ fontSize: '14px' }} />
          <span>Lihat di IG</span>
          <FiExternalLink style={{ fontSize: '11px' }} />
        </a>
      </div>

      {/* CAROUSEL IMAGE CONTAINER */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        maxHeight: '560px',
        background: '#09090b',
        overflow: 'hidden',
        userSelect: 'none'
      }}>
        <AnimatePresence initial={false} mode="wait">
          <motion.img
            key={currentIndex}
            src={imageList[currentIndex]}
            alt={`Carousel slide ${currentIndex + 1}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </AnimatePresence>

        {/* Counter Slide Indicator (top right) */}
        {imageList.length > 1 && (
          <div style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '100px',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            zIndex: 10
          }}>
            {currentIndex + 1}/{imageList.length}
          </div>
        )}

        {/* Navigation Arrows */}
        {imageList.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              aria-label="Previous Slide"
              style={{
                position: 'absolute',
                top: '50%',
                left: '12px',
                transform: 'translateY(-50%)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.55)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                zIndex: 10,
                transition: 'background 0.2s, transform 0.2s'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.85)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.55)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
            >
              <FiChevronLeft />
            </button>

            <button
              onClick={handleNext}
              aria-label="Next Slide"
              style={{
                position: 'absolute',
                top: '50%',
                right: '12px',
                transform: 'translateY(-50%)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.55)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                zIndex: 10,
                transition: 'background 0.2s, transform 0.2s'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.85)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.55)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
            >
              <FiChevronRight />
            </button>
          </>
        )}
      </div>

      {/* FOOTER ACTIONS & DOTS */}
      <div style={{ padding: '14px 18px', background: 'var(--card-bg, #ffffff)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          {/* Action Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: 'var(--text-bold, #1e293b)',
                fontSize: '22px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <FiHeart />
            </a>
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-bold, #1e293b)', fontSize: '20px', display: 'flex', alignItems: 'center' }}
            >
              <FiMessageCircle />
            </a>
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-bold, #1e293b)', fontSize: '20px', display: 'flex', alignItems: 'center' }}
            >
              <FiShare2 />
            </a>
          </div>

          {/* Dots Indicator */}
          {imageList.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {imageList.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    width: currentIndex === idx ? '18px' : '6px',
                    height: '6px',
                    borderRadius: '100px',
                    background: currentIndex === idx ? '#3b82f6' : 'var(--card-border, #cbd5e1)',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease'
                  }}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          )}

          {/* Bookmark */}
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: 'var(--text-bold, #1e293b)',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center'
            }}
            onClick={() => alert("Postingan disimpan!")}
          >
            <FiBookmark />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text, #334155)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text-bold, #0f172a)' }}>untukesok</strong> Geser foto untuk melihat dokumentasi kegiatan ini.{' '}
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}
          >
            Buka di Instagram →
          </a>
        </p>
      </div>
    </div>
  );
}
