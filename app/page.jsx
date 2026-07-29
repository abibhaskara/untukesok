'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FiArrowRight, FiUsers, FiAward, FiBook,
  FiActivity, FiLayers, FiDollarSign,
  FiHeart, FiCheckCircle, FiX
} from 'react-icons/fi';
import { motion, AnimatePresence, useInView, useScroll, useTransform } from 'framer-motion';
import VisionMissionScroll from '../src/components/VisionMissionScroll';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getCachedNews, getCachedPrograms } from '../src/lib/dataService';
import { calculateDaysLeftGMT8 } from '../src/lib/dateUtils';

const getValidImageUrl = (url) => {
  if (!url) return 'https://picsum.photos/seed/fallback/800/600';
  if (url.startsWith('/') || url.startsWith('http') || url.startsWith('data:')) return url;
  return 'https://picsum.photos/seed/fallback/800/600';
};

const AnimatedCounter = ({ from = 0, to, duration = 2, suffix = "+" }) => {
  const [count, setCount] = useState(from);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView) {
      let startTimestamp = null;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
        setCount(Math.floor(progress * (to - from) + from));
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };
      window.requestAnimationFrame(step);
    }
  }, [isInView, from, to, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
};

// --- DATA DEFINITIONS ---
const founders = [
  { name: 'Abi', role: 'Tech & Innovation Lead', img: 'https://res.cloudinary.com/dnbgczi9b/image/upload/v1785207727/3_rzvj2o.webp' },
  { name: 'Aca', role: 'Education Director', img: 'https://res.cloudinary.com/dnbgczi9b/image/upload/v1785207728/4_a4gtyg.webp' },
  { name: 'Cheryl', role: 'Creative Director', img: 'https://res.cloudinary.com/dnbgczi9b/image/upload/v1785207728/5_ld6ssj.webp' },
  { name: 'Rheia', role: 'Community Outreach', img: 'https://res.cloudinary.com/dnbgczi9b/image/upload/v1785249954/6_fivtrc.webp' },
  { name: 'Adit', role: 'Finance Coordinator', img: 'https://res.cloudinary.com/dnbgczi9b/image/upload/v1785249954/7_ui1wlw.webp' },
  { name: 'Victor', role: 'Logistics Head', img: 'https://res.cloudinary.com/dnbgczi9b/image/upload/v1785249953/8_elh6sy.webp' },
  { name: 'Nalini', role: 'Logistics Head', img: 'https://res.cloudinary.com/dnbgczi9b/image/upload/v1785249953/9_dv6lbv.webp' }
];

// --- FADE IN ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 0, opacity: 1 },
  visible: { y: 0, opacity: 1, transition: { duration: 1.5, ease: "easeInOut" } }
};

export default function Home() {
  const router = useRouter();
  const [newsList, setNewsList] = useState([]);
  const [recentPrograms, setRecentPrograms] = useState([]);
  const [allPrograms, setAllPrograms] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [newsData, programsData] = await Promise.all([
          getCachedNews(),
          getCachedPrograms()
        ]);
        setNewsList(newsData.slice(0, 5));
        setAllPrograms(programsData);
        setRecentPrograms(programsData.slice(0, 1));
      } catch (error) {
        console.error("Error fetching data for homepage:", error);
      }
    };
    fetchData();
  }, []);

  const [donateForm, setDonateForm] = useState({ name: '', email: '', amount: '250000', customAmount: '' });
  const [isDonateSubmitted, setIsDonateSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSimulatedCheckout, setShowSimulatedCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('select'); // 'select', 'processing'
  const [selectedMethod, setSelectedMethod] = useState('gopay');
  const [heroFade, setHeroFade] = useState(0);
  const missionRef = useRef(null);

  const { scrollY } = useScroll();
  const heroBgY = useTransform(scrollY, [0, 1000], [0, 400]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeroFade(entry.intersectionRatio);
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
    );
    if (missionRef.current) observer.observe(missionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleAmountSelect = (value) => {
    setDonateForm(prev => ({ ...prev, amount: value, customAmount: '' }));
  };

  const finalDonateAmount = donateForm.customAmount || donateForm.amount;

  const formatRupiah = (num) => {
    if (!num) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const handleDonateSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: donateForm.name,
          email: donateForm.email,
          amount: finalDonateAmount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.warn('API error, falling back to simulated checkout:', data.error);
        setIsSubmitting(false);
        setCheckoutStep('select');
        setShowSimulatedCheckout(true);
        return;
      }

      if (window.snap) {
        window.snap.pay(data.token, {
          onSuccess: function (result) {
            setIsDonateSubmitted(true);
            setIsSubmitting(false);
          },
          onPending: function (result) {
            alert('Payment pending. Please complete your payment.');
            setIsSubmitting(false);
          },
          onError: function (result) {
            console.warn('Midtrans SDK error, falling back to simulation:', result);
            setIsSubmitting(false);
            setCheckoutStep('select');
            setShowSimulatedCheckout(true);
          },
          onClose: function () {
            setIsSubmitting(false);
          }
        });
      } else {
        setIsSubmitting(false);
        setCheckoutStep('select');
        setShowSimulatedCheckout(true);
      }
    } catch (err) {
      console.warn('Catch block error, falling back to simulation:', err);
      setIsSubmitting(false);
      setCheckoutStep('select');
      setShowSimulatedCheckout(true);
    }
  };

  return (
    <div className="home-content">

      {/* SECTION 1: ABOUT */}
      <section id="about">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          <section className="hero-section">
            <video
              autoPlay
              loop
              muted
              playsInline
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 0,
                pointerEvents: 'none'
              }}
            >
              <source src="/hero.mp4" type="video/mp4" />
            </video>

            {/* Scroll-triggered fade overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'var(--bg)',
              opacity: heroFade,
              transition: 'opacity 0.1s linear',
              zIndex: 3,
              pointerEvents: 'none'
            }} />

            {/* Bottom 20dvh fade overlay */}
            <motion.div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '25%',
              background: 'linear-gradient(to bottom, transparent 0%, var(--bg) 100%)',
              zIndex: 3,
              pointerEvents: 'none',
              y: useTransform(scrollY, [0, 30], ['80%', '0%'])
            }} />

            <motion.h1 className="serif-title hero-logo" variants={itemVariants}>
              Untuk Esok
            </motion.h1>
            <motion.p className="hero-subtitle" variants={itemVariants}>
              Pemberdayaan manusia dan kreativitas melalui pendidikan yang mudah diakses dan teknologi kolaboratif.
            </motion.p>
            <motion.div variants={itemVariants}>
              <button onClick={() => router.push('/programs')} className="btn-primary">
                Jelajahi Program Kami <FiArrowRight />
              </button>
            </motion.div>
          </section>
        </motion.div>

        <VisionMissionScroll />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="founders-section-container"
        >
          <section className="founders-section">
            <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ height: '1px', width: '40px', background: 'var(--primary)' }}></div>
              <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Tim</span>
              <div style={{ height: '1px', width: '40px', background: 'var(--primary)' }}></div>
            </motion.div>
            <motion.h2 className="serif-title text-h2" variants={itemVariants} style={{ fontSize: '38px', marginBottom: '16px', textAlign: 'center', lineHeight: '1.1' }}>
              Kenali Tim Kami
            </motion.h2>
            <motion.p variants={itemVariants} style={{ marginBottom: '24px', textAlign: 'center' }}>
              Untuk Esok dijalankan oleh siswa, untuk siswa. Kenali tim Untuk Esok:
            </motion.p>

            <div style={{ position: 'relative', width: '100%' }}>
              <div className="founders-wrapper">
                <motion.div
                  className="founders-inner"
                  animate={{ x: ["0%", "-50%"] }}
                  transition={{
                    ease: "linear",
                    duration: 22,
                    repeat: Infinity,
                  }}
                >
                  <div className="founders-track" aria-hidden="false">
                    {founders.map((founder, idx) => (
                      <div key={`a-${idx}`} className="founder-card" style={{ position: 'relative' }}>
                        <Image src={getValidImageUrl(founder.img)} alt={founder.name} width={400} height={400} className="founder-img" style={{ objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                  <div className="founders-track" aria-hidden="true">
                    {founders.map((founder, idx) => (
                      <div key={`b-${idx}`} className="founder-card" style={{ position: 'relative' }}>
                        <Image src={getValidImageUrl(founder.img)} alt={founder.name} width={400} height={400} className="founder-img" style={{ objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </section>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="main-content"
        >
          <section style={{ padding: '60px 0' }}>
            <div className="grid-layout">
              <motion.div className="card col-4" variants={itemVariants} style={{ textAlign: 'center', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                <h3 className="stats-number" style={{ fontSize: '48px', color: 'var(--primary)', marginBottom: '8px' }}>
                  <AnimatedCounter to={allPrograms.length || 3} suffix="+" />
                </h3>
                <p style={{ fontWeight: '600' }}>Program Kerja</p>
              </motion.div>
              <motion.div className="card col-4" variants={itemVariants} style={{ textAlign: 'center', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                <h3 className="stats-number" style={{ fontSize: '48px', color: 'var(--accent)', marginBottom: '8px' }}>
                  <AnimatedCounter to={100} suffix="+" />
                </h3>
                <p style={{ fontWeight: '600' }}>Relawan Terdaftar</p>
              </motion.div>
              <motion.div className="card col-4" variants={itemVariants} style={{ textAlign: 'center', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                <h3 className="stats-number" style={{ fontSize: '48px', color: 'var(--primary)', marginBottom: '8px' }}>
                  <AnimatedCounter to={100} suffix="+" />
                </h3>
                <p style={{ fontWeight: '600' }}>Siswa Berkontribusi</p>
              </motion.div>
            </div>
          </section>
        </motion.div>
      </section>

      {/* SECTION 2: NEWS SPLIT LAYOUT */}
      <section id="news">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="news-split-container"
        >
          {/* LEFT PANE - Featured Article (First Article) */}
          <div className="news-left-pane">
            {newsList.length > 0 && (
              <>
                <div>
                  <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ height: '1px', width: '40px', background: 'var(--primary)' }}></div>
                    <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Berita Utama</span>
                  </motion.div>

                  <motion.h1 variants={itemVariants} className="serif-title news-split-title" style={{ fontSize: 'clamp(32px, 4vw, 56px)', lineHeight: '1.2', maxWidth: '400px', cursor: 'pointer' }} onClick={() => router.push(`/news/${newsList[0].id}`)}>
                    {newsList[0].title}
                  </motion.h1>

                  <motion.button variants={itemVariants} className="news-explore-btn" onClick={() => router.push(`/news/${newsList[0].id}`)} style={{ marginTop: '24px' }}>
                    Baca Selengkapnya
                  </motion.button>
                </div>

                <motion.div variants={itemVariants} className="news-image-wrapper" style={{ cursor: 'pointer', position: 'relative', minHeight: '300px' }} onClick={() => router.push(`/news/${newsList[0].id}`)}>
                  <Image src={getValidImageUrl(newsList[0].imageUrl)} alt={newsList[0].title} fill style={{ borderRadius: 0, objectFit: 'cover', objectPosition: 'top' }} />
                </motion.div>
              </>
            )}
          </div>

          {/* RIGHT PANE - Other Articles */}
          <div className="news-right-pane">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {newsList.slice(1).map((article) => (
                <motion.div key={article.id} className="news-list-item" variants={itemVariants} onClick={() => router.push(`/news/${article.id}`)} style={{ cursor: 'pointer' }}>
                  <div style={{ position: 'relative', width: '120px', height: '100px', flexShrink: 0 }}>
                    <Image className="news-list-item-img" src={getValidImageUrl(article.imageUrl)} alt={article.title} fill style={{ borderRadius: 0, objectFit: 'cover' }} />
                  </div>
                  <div className="news-list-item-content">
                    <div className="news-list-item-meta">{article.date} - {article.category}</div>
                    <h3 className="news-list-item-title">{article.title}</h3>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '24px' }}>
              <span onClick={() => router.push('/news')} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}>
                Lihat Semua Berita
              </span>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* SECTION 3: PROGRAMS */}
      <section id="programs">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="main-content"
        >
          <div style={{ marginBottom: '48px' }}>
            {recentPrograms.map((program, index) => {
              const daysLeft = calculateDaysLeftGMT8(program);
              return (
              <motion.div
                key={program.id}
                className={`program-row ${index % 2 !== 0 ? 'reverse' : ''}`}
                variants={itemVariants}
                style={{ flexDirection: index % 2 !== 0 ? 'row-reverse' : 'row' }}
              >
                <div className="program-row-content" style={{ alignItems: 'flex-start', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ height: '1px', width: '30px', background: 'var(--primary)' }}></div>
                    <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.8 }}>
                      PROGRAM • {program.date}
                    </span>
                  </div>
                  <h2 className="serif-title text-h3" style={{ fontSize: '32px', marginBottom: '16px', lineHeight: '1.2' }}>
                    {program.title}
                  </h2>
                  <p style={{ fontSize: '15px', lineHeight: '1.7', opacity: 0.8, maxWidth: '90%' }}>
                    {program.description}
                  </p>
                  <div>
                    <button onClick={() => router.push('/programs/' + program.id)} className="program-explore-btn">
                      {daysLeft < 0 ? 'Selesai' : 'Detail & Daftar'}
                    </button>
                  </div>
                </div>

                <div className="program-row-image program-row-image--fullbleed" style={{ position: 'relative', minHeight: '300px', flex: 1 }}>
                  <Image src={getValidImageUrl(program.imageUrl)} alt={program.title} fill style={{ objectFit: 'cover', borderRadius: '24px', filter: daysLeft < 0 ? 'grayscale(100%)' : 'none' }} />
                </div>
              </motion.div>
            )})}
          </div>
        </motion.div>
      </section>

      {/* SECTION 4: DONATE */}
      <section id="donate" style={{ borderTop: '1px solid var(--card-border)' }}>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          className="main-content"
        >
          <section style={{ marginBottom: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ height: '1px', width: '40px', background: 'var(--primary)' }}></div>
              <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Dukung Kami</span>
              <div style={{ height: '1px', width: '40px', background: 'var(--primary)' }}></div>
            </motion.div>
            <h1 className="serif-title text-h1" style={{ fontSize: '48px', marginBottom: '16px', lineHeight: '1.1' }}>Terbuka untuk Donasi</h1>
            <p style={{ opacity: 0.8 }}>Bantu kami memperluas dampak ke lebih banyak komunitas siswa di daerah sub-urban dan terpencil.</p>
          </section>

          <AnimatePresence mode="wait">
            {!isDonateSubmitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid-layout"
              >
                <div className="card col-6 donate-form-container" style={{ textAlign: 'left' }}>
                  <h2 className="serif-title text-h4" style={{ fontSize: '24px', marginBottom: '16px' }}>Mengapa Berdonasi?</h2>
                  <p style={{ marginBottom: '20px' }}>
                    Dukungan finansial Anda memungkinkan kami menyediakan paket belajar, perangkat keras teknologi, dan menjalankan logistik untuk menjangkau siswa di daerah terpencil dan sub-urban.
                  </p>

                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <li style={{ display: 'flex', gap: '12px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>
                      <span><strong>100% Transparansi:</strong> Akses pembaruan waktu-nyata dan laporan pengeluaran langsung dari halaman Program kami.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '12px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>
                      <span><strong>Berdayakan Inisiatif Mahasiswa:</strong> Semua proyek dirancang dan dijalankan oleh kelompok sukarelawan mahasiswa aktif.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '12px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>
                      <span><strong>Perangkat Keras & Infrastruktur:</strong> Donasi mendanai laboratorium komputer rekondisi dan pusat internet di sekolah-sekolah sub-urban.</span>
                    </li>
                  </ul>
                </div>

                <div className="card col-6 donate-form-container">
                  <form onSubmit={handleDonateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {errorMsg && (
                      <div style={{ color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: '500' }}>
                        {errorMsg}
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Nama Lengkap</label>
                      <input
                        type="text"
                        required
                        disabled={isSubmitting}
                        className="form-input"
                        placeholder="Nama Lengkap Anda"
                        value={donateForm.name}
                        onChange={(e) => setDonateForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Alamat Email</label>
                      <input
                        type="email"
                        required
                        disabled={isSubmitting}
                        className="form-input"
                        placeholder="alamat.email@anda.com"
                        value={donateForm.email}
                        onChange={(e) => setDonateForm(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Pilih Nominal Donasi (Rp)</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        {['50000', '100000', '250000', '500000'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleAmountSelect(val)}
                            style={{
                              flex: 1,
                              padding: '10px 4px',
                              fontSize: '13px',
                              borderRadius: '8px',
                              border: '1px solid var(--card-border)',
                              backgroundColor: donateForm.amount === val && !donateForm.customAmount ? 'var(--primary)' : 'var(--bg)',
                              color: donateForm.amount === val && !donateForm.customAmount ? 'white' : 'var(--text-bold)',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              opacity: isSubmitting ? 0.6 : 1
                            }}
                          >
                            {formatRupiah(val).replace(',00', '')}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        disabled={isSubmitting}
                        className="form-input"
                        placeholder="Atau masukkan nominal kustom (Rp)"
                        value={donateForm.customAmount}
                        onChange={(e) => setDonateForm(prev => ({ ...prev, customAmount: e.target.value }))}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary"
                      style={{ justifyContent: 'center', marginTop: '8px', opacity: isSubmitting ? 0.7 : 1 }}
                    >
                      <FiHeart /> {isSubmitting ? 'Memproses...' : `Dukung Kami sebesar ${formatRupiah(finalDonateAmount)}`}
                    </button>
                  </form>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card col-12"
                style={{ textAlign: 'center', padding: '60px 40px' }}
              >
                <FiCheckCircle size={60} style={{ color: '#10B981', marginBottom: '24px' }} />
                <h2 className="serif-title" style={{ fontSize: '32px', marginBottom: '16px' }}>Terima Kasih, {donateForm.name}!</h2>
                <p style={{ fontSize: '18px', maxWidth: '600px', margin: '0 auto 32px auto', lineHeight: '1.6' }}>
                  Donasi Anda sebesar <strong>{formatRupiah(finalDonateAmount)}</strong> telah berhasil disimulasikan. Kami sangat mengapresiasi dukungan Anda dalam membantu kami memberdayakan pemuda sub-urban melalui pendidikan dan teknologi.
                </p>
                <button onClick={() => setIsDonateSubmitted(false)} className="btn-primary">
                  Lakukan Donasi Lain
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* SIMULATED CHECKOUT MODAL OVERLAY */}
      <AnimatePresence>
        {showSimulatedCheckout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="card"
              style={{
                width: '100%',
                maxWidth: '480px',
                background: 'var(--bg)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--card-border)',
                position: 'relative',
                color: 'var(--text-bold)'
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowSimulatedCheckout(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  opacity: 0.7
                }}
              >
                <FiX size={20} />
              </button>

              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', color: 'var(--primary)', textTransform: 'uppercase' }}>
                  Simulasi Pembayaran
                </span>
                <h3 className="serif-title" style={{ fontSize: '24px', marginTop: '6px' }}>Untuk Esok Sandbox</h3>
              </div>

              {checkoutStep === 'select' ? (
                <div>
                  <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.03)', border: '1px solid var(--card-border)', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                      <span style={{ opacity: 0.8 }}>Pendonor:</span>
                      <strong style={{ color: 'var(--text-bold)' }}>{donateForm.name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                      <span style={{ opacity: 0.8 }}>Email:</span>
                      <strong style={{ color: 'var(--text-bold)' }}>{donateForm.email}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px dashed var(--card-border)', paddingTop: '8px' }}>
                      <span style={{ opacity: 0.8 }}>Total Nominal:</span>
                      <strong style={{ color: 'var(--primary)', fontSize: '16px' }}>{formatRupiah(finalDonateAmount)}</strong>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Pilih Metode Simulasi</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                    {[
                      { id: 'gopay', name: 'Simulator GoPay / QRIS', desc: 'Pindai kode QR simulasi' },
                      { id: 'va', name: 'Simulator Virtual Account', desc: 'Transfer dana simulasi via virtual account bank' },
                      { id: 'cc', name: 'Simulator Kartu Kredit', desc: 'Gunakan detail kartu sandbox simulasi' }
                    ].map((method) => (
                      <div
                        key={method.id}
                        onClick={() => setSelectedMethod(method.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          borderRadius: '8px',
                          border: `1px solid ${selectedMethod === method.id ? 'var(--primary)' : 'var(--card-border)'}`,
                          backgroundColor: selectedMethod === method.id ? 'rgba(35, 59, 105, 0.05)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <input
                          type="radio"
                          checked={selectedMethod === method.id}
                          readOnly
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>{method.name}</div>
                          <div style={{ fontSize: '11px', opacity: 0.7 }}>{method.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setCheckoutStep('processing');
                      setTimeout(() => {
                        setIsDonateSubmitted(true);
                        setShowSimulatedCheckout(false);
                      }, 2500);
                    }}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Bayar Sekarang (Simulasi)
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  {/* Simulated Spinner */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    border: '4px solid rgba(35, 59, 105, 0.1)',
                    borderTop: '4px solid var(--primary)',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 24px auto'
                  }} />
                  <style jsx global>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                  <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Memproses transaksi simulasi...</h4>
                  <p style={{ fontSize: '14px', opacity: 0.8 }}>Jangan tutup jendela ini, sedang mensimulasikan otorisasi menggunakan {selectedMethod.toUpperCase()}...</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
