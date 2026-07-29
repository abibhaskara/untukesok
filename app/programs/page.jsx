'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { FiSearch, FiArrowLeft, FiMapPin, FiClock, FiUsers, FiSliders, FiChevronDown, FiAlertCircle, FiX, FiCheck } from 'react-icons/fi';
import { getCachedPrograms } from '../../src/lib/dataService';
import { calculateDaysLeftGMT8 } from '../../src/lib/dateUtils';
import Image from 'next/image';

export const programCategories = [
  'Semua',
  'Pendidikan',
  'Lingkungan',
  'Kesehatan',
  'Sains & Teknologi',
  'Seni & Budaya',
];

const getValidImageUrl = (url) => {
  if (!url) return 'https://picsum.photos/seed/fallback/800/600';
  if (url.startsWith('/') || url.startsWith('http') || url.startsWith('data:')) return url;
  return 'https://picsum.photos/seed/fallback/800/600';
};

const containerVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { y: 0, opacity: 1 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 120 } }
};

export default function Programs() {
  const router = useRouter();

  // State filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [sortOption, setSortOption] = useState('Terbaru'); // 'Terbaru', 'BatasWaktu', 'KuotaHampirPenuh'
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [programsData, setProgramsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data from Firebase
  useMemo(() => {
    const fetchPrograms = async () => {
      try {
        const data = await getCachedPrograms();
        setProgramsData(data);
      } catch (error) {
        console.error("Error fetching programs:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrograms();
  }, []);

  // Filter & sort calculation
  const filteredPrograms = useMemo(() => {
    return programsData.filter(program => {
      const matchesSearch = program.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            program.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            program.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'Semua' || program.category === selectedCategory;
      const matchesUrgent = !onlyUrgent || program.urgent === true;

      return matchesSearch && matchesCategory && matchesUrgent;
    }).sort((a, b) => {
      if (sortOption === 'BatasWaktu') {
        return calculateDaysLeftGMT8(a) - calculateDaysLeftGMT8(b);
      }
      if (sortOption === 'KuotaHampirPenuh') {
        const ratioA = a.volunteersJoined / a.volunteersTarget;
        const ratioB = b.volunteersJoined / b.volunteersTarget;
        return ratioB - ratioA;
      }
      return 0; // Terbaru (default index order)
    });
  }, [searchQuery, selectedCategory, sortOption, onlyUrgent, programsData]);

  return (
    <div className="home-content">
      {/* ── TOP FIXED ANCHORED HEADER ── */}
      <div 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          zIndex: 1000,
          background: 'var(--bg)',
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px', 
          padding: '0 24px',
          borderBottom: '1px solid var(--card-border)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
        }}
      >

        <h1 style={{ 
          fontSize: '20px', 
          fontWeight: 700, 
          fontFamily: 'var(--font-poppins)', 
          color: 'var(--text)',
          margin: 0 
        }}>
          Program
        </h1>
      </div>

      <div className="news-page-container" style={{ paddingTop: '80px', paddingBottom: '100px' }}>
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          
          {/* ── SEARCH BAR ── */}
          <motion.div variants={itemVariants} style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '999px',
              padding: '12px 20px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
              gap: '12px'
            }}>
              <FiSearch size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <input 
                type="text" 
                placeholder="Cari aktivitas, lokasi, atau topik relawan..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  fontSize: '15px',
                  fontFamily: 'var(--font-poppins)',
                  color: 'var(--text)'
                }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: '2px' }}
                >
                  <FiX size={18} />
                </button>
              )}
            </div>
          </motion.div>

          {/* ── CATEGORY FILTER PILLS ── */}
          <motion.div variants={itemVariants} style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              gap: '10px',
              overflowX: 'auto',
              paddingBottom: '8px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}>
              {programCategories.map(category => {
                const isSelected = selectedCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    style={{
                      whiteSpace: 'nowrap',
                      padding: '8px 18px',
                      borderRadius: '999px',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--card-border)',
                      background: isSelected ? 'var(--primary)' : 'var(--card-bg)',
                      color: isSelected ? '#ffffff' : 'var(--text)',
                      fontSize: '13px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontFamily: 'var(--font-poppins)',
                      boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ── TOOLBAR: SORT & URGENT FILTER ── */}
          <motion.div variants={itemVariants} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '28px',
            position: 'relative',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            {/* Sort Dropdown */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsSortOpen(!isSortOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-poppins)'
                }}
              >
                <FiSliders size={15} style={{ color: 'var(--primary)' }} />
                <span>
                  Urutkan: {sortOption === 'Terbaru' ? 'Paling Terbaru' : sortOption === 'BatasWaktu' ? 'Batas Waktu Terdekat' : 'Mendekati Kuota'}
                </span>
                <FiChevronDown size={16} />
              </button>

              {/* Sort Menu Modal */}
              <AnimatePresence>
                {isSortOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    style={{
                      position: 'absolute',
                      top: '110%',
                      left: 0,
                      background: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '16px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      zIndex: 100,
                      minWidth: '220px',
                      overflow: 'hidden',
                      padding: '6px'
                    }}
                  >
                    {[
                      { key: 'Terbaru', label: 'Paling Terbaru' },
                      { key: 'BatasWaktu', label: 'Batas Waktu Terdekat' },
                      { key: 'KuotaHampirPenuh', label: 'Paling Mendekati Kuota' }
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => { setSortOption(opt.key); setIsSortOpen(false); }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: 'none',
                          background: sortOption === opt.key ? 'var(--bg)' : 'transparent',
                          color: sortOption === opt.key ? 'var(--primary)' : 'var(--text)',
                          fontWeight: sortOption === opt.key ? 700 : 500,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        {opt.label}
                        {sortOption === opt.key && <FiCheck size={16} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Urgent Toggle Removed */}
          </motion.div>

          {/* ── PROGRAM CARDS LIST (PEDULY STYLE) ── */}
          {isLoading ? (
            <motion.div variants={itemVariants} style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ fontSize: '16px' }}>Memuat program...</p>
            </motion.div>
          ) : filteredPrograms.length === 0 ? (
            <motion.div variants={itemVariants} style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.7 }}>
              <p style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Tidak ada aktivitas ditemukan</p>
              <p style={{ fontSize: '14px' }}>Coba ubah kata kunci pencarian atau filter kategori Anda.</p>
            </motion.div>
          ) : (
            <div className="programs-grid">
              {filteredPrograms.map(program => {
                const percent = Math.min(Math.round((program.volunteersJoined / program.volunteersTarget) * 100), 100);

                return (
                  <motion.div 
                    key={program.id}
                    variants={itemVariants}
                    onClick={() => router.push(`/programs/${program.id}`)}
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '4 / 3',
                      borderRadius: '24px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
                    }}
                  >
                    {/* Background Image */}
                    <Image 
                      src={getValidImageUrl(program.imageUrl)} 
                      alt={program.title} 
                      fill
                      style={{ objectFit: 'cover', zIndex: 0 }}
                    />

                    {/* Gradient Overlay */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0, left: 0, width: '100%', height: '70%',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
                      zIndex: 1
                    }} />

                    {/* Top Badges (Days Left) */}
                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      background: 'rgba(255,255,255,0.95)',
                      color: '#111',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '6px 12px',
                      borderRadius: '999px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      zIndex: 2,
                      boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                    }}>
                      <FiClock size={12} /> {calculateDaysLeftGMT8(program)} Hari Lagi
                    </div>

                    <div style={{
                      position: 'absolute',
                      bottom: 0, left: 0, width: '100%',
                      padding: '16px',
                      zIndex: 2,
                      color: 'white',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      {/* Category */}
                      <div style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.7)',
                        marginBottom: '4px'
                      }}>
                        {program.category || "Umum"}
                      </div>
                      
                      {/* Title */}
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-poppins)',
                        lineHeight: 1.3,
                        margin: '0 0 6px 0',
                        color: '#ffffff'
                      }}>
                        {program.title}
                      </h3>

                      {/* Location */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.9, marginBottom: '12px' }}>
                        <FiMapPin size={13} />
                        <span>{program.location}</span>
                      </div>

                      {/* Progress Bar & Quota */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiUsers size={14} /> Relawan
                          </span>
                          <span>
                            {program.volunteersJoined} / {program.volunteersTarget} ({percent}%)
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.3)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${percent}%`,
                            background: '#ffffff',
                            borderRadius: '999px',
                            transition: 'width 0.4s ease'
                          }} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

        </motion.div>
      </div>
    </div>
  );
}
