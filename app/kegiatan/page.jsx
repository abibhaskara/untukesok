'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { FiSearch, FiMapPin, FiClock, FiUsers, FiSliders, FiX, FiCheck, FiZap } from 'react-icons/fi';
import { getCachedPrograms } from '../../src/lib/dataService';
import { calculateDaysLeftGMT8 } from '../../src/lib/dateUtils';
import { useAuth } from '../../src/context/AuthContext';
import { db } from '../../src/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { calculateKarmaMatch } from '../../src/lib/karmaMatchEngine';
import Image from 'next/image';
import ProgramInFeedAd from '../../src/components/ProgramInFeedAd';

const programCategories = [
  'Semua',
  'Pendidikan',
  'Lingkungan',
  'Kesehatan',
  'Kreativitas',
  'Sains & Teknologi',
  'Seni & Budaya',
];

const FALLBACK_IMG = 'https://picsum.photos/seed/fallback/800/600';
const getValidImageUrl = (url) => url?.match(/^(\/|http|data:)/) ? url : FALLBACK_IMG;

const formatShortLocation = (loc) => loc?.split(',').slice(0, 2).map(p => p.trim()).join(', ') || '';

export default function Programs() {
  const router = useRouter();
  const { user } = useAuth();

  // State filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [sortOption, setSortOption] = useState('KarmaMatch'); // 'KarmaMatch' (default), 'Terbaru', 'BatasWaktu', 'KuotaHampirPenuh'
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [programsData, setProgramsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(6);
  const [userProfile, setUserProfile] = useState({});
  const [userHistoryCategories, setUserHistoryCategories] = useState([]);

  // Fetch user profile & past activity categories for personalized Karma Match
  useEffect(() => {
    if (!user?.uid) {
      setUserProfile({});
      setUserHistoryCategories([]);
      return;
    }
    const loadUserData = async () => {
      try {
        const uDoc = await getDoc(doc(db, 'users', user.uid));
        if (uDoc.exists()) {
          setUserProfile(uDoc.data());
        }
        // Fetch past joined applications
        const appsSnap = await getDocs(
          query(collection(db, 'applications'), where('userId', '==', user.uid))
        );
        const cats = [];
        appsSnap.docs.forEach(d => {
          const cat = d.data().category || d.data().programCategory;
          if (cat && !cats.includes(cat)) cats.push(cat);
        });
        setUserHistoryCategories(cats);
      } catch (err) {
        console.warn('Gagal memuat profil relawan untuk Karma Match:', err);
      }
    };
    loadUserData();
  }, [user]);

  // Fetch data from Firebase
  useEffect(() => {
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

  // Reset visible count on filter change
  useEffect(() => {
    setVisibleCount(6);
  }, [searchQuery, selectedCategory, sortOption]);

  // Karma Match calculation per program
  const programsWithKarma = useMemo(() => {
    return programsData.map(p => {
      const match = calculateKarmaMatch(p, {
        userProfile,
        searchQuery,
        userHistoryCategories
      });
      return {
        ...p,
        karmaScore: match.score,
        karmaRawScore: match.rawScore,
        karmaReasons: match.reasons,
        isTopMatch: match.isTopMatch
      };
    });
  }, [programsData, userProfile, searchQuery, userHistoryCategories]);

  // Filter & sort calculation
  const filteredPrograms = useMemo(() => {
    return programsWithKarma.filter(program => {
      const matchesSearch = (program.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (program.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (program.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (program.karmaScore >= 75 && searchQuery.trim().length > 0);
      
      const matchesCategory = selectedCategory === 'Semua' || program.category === selectedCategory;

      return matchesSearch && matchesCategory;
    }).sort((a, b) => {
      const daysA = calculateDaysLeftGMT8(a);
      const daysB = calculateDaysLeftGMT8(b);
      const isExpiredA = daysA < 0;
      const isExpiredB = daysB < 0;

      // Event dengan tanggal yang sudah lewat dari hari ini tidak diprioritaskan
      if (isExpiredA !== isExpiredB) {
        return isExpiredA ? 1 : -1;
      }

      // Prioritas 1: Karma Match Engine (AI Recommendation)
      if (sortOption === 'KarmaMatch') {
        if (b.karmaScore !== a.karmaScore) {
          return b.karmaScore - a.karmaScore;
        }
        return daysA - daysB;
      }

      // Jika sama-sama aktif atau sama-sama sudah lewat:
      if (sortOption === 'BatasWaktu') {
        return daysA - daysB;
      }
      if (sortOption === 'KuotaHampirPenuh') {
        const ratioA = (Number(a.volunteersJoined) || 0) / (Number(a.volunteersTarget) || 1);
        const ratioB = (Number(b.volunteersJoined) || 0) / (Number(b.volunteersTarget) || 1);
        if (ratioA !== ratioB) {
          return ratioB - ratioA;
        }
        return daysA - daysB;
      }

      // Default: 'Terbaru' -> urutkan berdasarkan tanggal kegiatan terbaru, lalu judul
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateB - dateA;
      }
      return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [searchQuery, selectedCategory, sortOption, programsWithKarma]);

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
          boxShadow: 'none'
        }}
      >

        <h1 style={{ 
          fontSize: '20px', 
          fontWeight: 700, 
          fontFamily: 'var(--font-poppins)', 
          color: 'var(--text)',
          margin: 0 
        }}>
          Kegiatan
        </h1>
      </div>

      <div className="news-page-container" style={{ paddingTop: '80px', paddingBottom: '100px' }}>
        <div>
          
          {/* ── SEARCH BAR & SORT BUTTON ── */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '999px',
              padding: '12px 20px',
              boxShadow: 'none',
              gap: '12px'
            }}>
              <FiSearch size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <input 
                type="text" 
                placeholder="Cari kegiatan, lokasi, atau topik..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  fontSize: '14.5px',
                  fontFamily: 'var(--font-poppins)',
                  color: 'var(--text)'
                }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: '2px' }}
                  aria-label="Hapus pencarian"
                >
                  <FiX size={18} />
                </button>
              )}
            </div>

            {/* Sort Icon Button (SVG Icon Only) */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsSortOpen(!isSortOpen)}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: isSortOpen ? 'var(--primary)' : 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  color: isSortOpen ? '#ffffff' : 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: 'none',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}
                aria-label="Urutkan Kegiatan"
                title="Urutkan Kegiatan"
              >
                <FiSliders size={18} style={{ color: isSortOpen ? '#ffffff' : 'var(--primary)' }} />
              </button>

              {/* Sort Menu Modal / Dropdown */}
              <AnimatePresence>
                {isSortOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    style={{
                      position: 'absolute',
                      top: '120%',
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      boxShadow: 'none',
                      zIndex: 100,
                      minWidth: '220px',
                      overflow: 'hidden',
                      padding: '6px'
                    }}
                  >
                    {[
                      { key: 'KarmaMatch', label: 'Karma Match (Rekomendasi AI)' },
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
                          background: sortOption === opt.key ? '#f1f5f9' : '#ffffff',
                          color: sortOption === opt.key ? 'var(--primary)' : '#1e293b',
                          fontWeight: sortOption === opt.key ? 700 : 500,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontFamily: 'var(--font-poppins)',
                          transition: 'background 0.2s ease'
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
          </div>

          {/* ── CATEGORY FILTER PILLS ── */}
          <div style={{ marginBottom: '24px' }}>
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
                      boxShadow: 'none'
                    }}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── PROGRAM CARDS LIST (PEDULY STYLE) ── */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ fontSize: '16px' }}>Memuat kegiatan...</p>
            </div>
          ) : filteredPrograms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.7 }}>
              <p style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Tidak ada aktivitas ditemukan</p>
              <p style={{ fontSize: '14px' }}>Coba ubah kata kunci pencarian atau filter kategori Anda.</p>
            </div>
          ) : (
            <>
              <div className="programs-grid">
                {filteredPrograms.slice(0, visibleCount).map((program, index) => {
                  const percent = Math.min(Math.round((program.volunteersJoined / program.volunteersTarget) * 100), 100);
                  const daysLeft = calculateDaysLeftGMT8(program);
                  const isFull = program.volunteersJoined >= program.volunteersTarget;

                  return (
                    <Fragment key={program.id}>
                      <motion.div 
                        onClick={() => router.push(`/kegiatan/${program.slug || program.id}`)}
                        style={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '4 / 3',
                          borderRadius: '24px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          boxShadow: 'none',
                          border: '1px solid var(--card-border)',
                          opacity: daysLeft < 0 ? 0.8 : 1
                        }}
                      >
                        {/* Background Image */}
                        <Image 
                          src={getValidImageUrl(program.imageUrl)} 
                          alt={program.title} 
                          fill
                          style={{ objectFit: 'cover', zIndex: 0, filter: daysLeft < 0 ? 'grayscale(100%)' : 'none' }}
                        />

                        {/* Gradient Overlay (White Fading) */}
                        <div style={{
                          position: 'absolute',
                          bottom: 0, left: 0, width: '100%', height: '58%',
                          background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.96) 55%, rgba(255,255,255,0.5) 85%, rgba(255,255,255,0) 100%)',
                          zIndex: 1
                        }} />

                        {/* Top Badges */}
                        <div style={{
                          position: 'absolute',
                          top: '16px',
                          left: '16px',
                          right: '16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          zIndex: 2,
                          pointerEvents: 'none'
                        }}>
                          {/* Karma Match Badge */}
                          {program.karmaScore !== undefined && daysLeft >= 0 && (
                            <div
                              title={program.karmaReasons?.join(' • ') || 'Kecocokan minat relawan'}
                              style={{
                                background: program.isTopMatch ? '#0F172A' : 'rgba(255,255,255,0.95)',
                                color: program.isTopMatch ? '#FFFFFF' : '#0F172A',
                                border: program.isTopMatch ? '1px solid rgba(255,255,255,0.2)' : '1px solid #E2E8F0',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '5px 10px',
                                borderRadius: '999px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                              }}
                            >
                              <FiZap size={11} style={{ color: '#F59E0B' }} />
                              <span>{program.karmaScore}% Cocok</span>
                            </div>
                          )}

                          {/* Days Left Badge (Right Aligned) */}
                          <div style={{
                            marginLeft: 'auto',
                            background: 'rgba(255,255,255,0.95)',
                            color: daysLeft < 0 ? '#334155' : '#0f172a',
                            border: '1px solid #e2e8f0',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: '999px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: 'none'
                          }}>
                            {daysLeft < 0 ? (
                              <span>Selesai</span>
                            ) : (
                              <><FiClock size={12} color="var(--primary)" /> {daysLeft} Hari Lagi</>
                            )}
                          </div>

                          {/* Kuota Penuh Badge */}
                          {isFull && daysLeft >= 0 && (
                            <div style={{
                              background: '#ef4444',
                              color: '#ffffff',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '5px 10px',
                              borderRadius: '999px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: 'none'
                            }}>
                              Kuota Penuh
                            </div>
                          )}
                        </div>

                        <div style={{
                          position: 'absolute',
                          bottom: 0, left: 0, width: '100%',
                          padding: '16px',
                          zIndex: 2,
                          color: daysLeft < 0 ? '#334155' : '#0f172a',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          {/* Category */}
                          <div style={{
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px',
                            fontWeight: 700,
                            color: daysLeft < 0 ? '#475569' : '#0f172a',
                            marginBottom: '4px'
                          }}>
                            {program.category || "Umum"}
                          </div>
                          
                          {/* Title */}
                          <h3 style={{
                            fontSize: '15px',
                            fontWeight: 800,
                            fontFamily: 'var(--font-poppins)',
                            lineHeight: 1.3,
                            margin: '0 0 6px 0',
                            color: daysLeft < 0 ? '#334155' : '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'block',
                            width: '100%'
                          }}>
                            {program.title}
                          </h3>

                          {/* Location */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: daysLeft < 0 ? '#475569' : '#0f172a', fontWeight: 600, marginBottom: '12px', minWidth: 0 }}>
                            <FiMapPin size={12} color={daysLeft < 0 ? '#475569' : '#0f172a'} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {formatShortLocation(program.location) || "Lokasi menyusul"}
                            </span>
                          </div>

                          {/* Progress Bar & Quota (Yellow Theme for Active, Dark Charcoal Gray for Selesai) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: daysLeft < 0 ? '#334155' : '#d97706'
                            }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FiUsers size={12} color={daysLeft < 0 ? '#334155' : '#d97706'} /> Relawan
                              </span>
                              <span style={{ color: daysLeft < 0 ? '#334155' : '#d97706' }}>
                                {program.volunteersJoined} / {program.volunteersTarget} ({percent}%)
                              </span>
                            </div>
                            <div style={{
                              width: '100%',
                              height: '6px',
                              background: daysLeft < 0 ? '#e2e8f0' : '#fef3c7',
                              borderRadius: '999px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${percent}%`,
                                background: daysLeft < 0 ? '#475569' : '#FFBD59',
                                borderRadius: '999px',
                                transition: 'width 0.4s ease'
                              }} />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                      {(index + 1) % 3 === 0 && (
                        <ProgramInFeedAd key={`ad-${program.id || index}`} />
                      )}
                    </Fragment>
                  );
                })}
              </div>

              {/* ── LOAD MORE BUTTON ── */}
              {filteredPrograms.length > visibleCount && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ textAlign: 'center', marginTop: '36px' }}
                >
                  <button
                    onClick={() => setVisibleCount(prev => prev + 6)}
                    style={{
                      padding: '12px 32px',
                      borderRadius: '999px',
                      background: 'var(--card-bg)',
                      border: '1.5px solid var(--card-border)',
                      color: 'var(--text)',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: 'none',
                      fontFamily: 'var(--font-poppins)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Muat Lebih Banyak ({filteredPrograms.length - visibleCount} Kegiatan Tersisa)
                  </button>
                </motion.div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
