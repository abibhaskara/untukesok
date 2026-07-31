'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { getCachedNews } from '../../src/lib/dataService';
import { useState, useEffect } from 'react';

const containerVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 0, opacity: 1 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

export default function News() {
  const router = useRouter();
  const [newsData, setNewsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const data = await getCachedNews();
        setNewsData(data);
      } catch (error) {
        console.error("Error fetching news:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNews();
  }, []);

  const featuredArticle = newsData[0];
  const gridArticles = newsData.slice(1, 7);

  return (
    <div className="home-content">
      {/* Top Navbar Header (Fixed Anchored Top Navbar) */}
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
          Berita
        </h1>
      </div>

      <div className="news-page-container" style={{ paddingTop: '80px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>Memuat Berita...</div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
          {/* Featured Article */}
          {featuredArticle && (
            <motion.div 
              className="news-hero-section" 
              variants={itemVariants} 
              onClick={() => router.push(`/news/${featuredArticle.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <img 
                src={featuredArticle.imageUrl} 
                alt={featuredArticle.title} 
                className="news-hero-image"
              />
              <div className="news-hero-content-box">
                <div className="news-hero-meta">
                  {featuredArticle.category} — {featuredArticle.date}
                </div>
                <h2 className="news-hero-title">
                  {featuredArticle.title}
                </h2>
                <div style={{ fontSize: '15px', opacity: 0.7, maxWidth: '600px', margin: '0 auto' }}>
                  {featuredArticle.summary}
                </div>
              </div>
            </motion.div>
          )}

          {/* Top Headlines Section */}
          <motion.div className="news-section-title-container" variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ height: '1px', width: '40px', background: 'var(--primary)' }}></div>
              <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Berita Lainnya</span>
            </div>
            <h2 className="serif-title text-h2" style={{ margin: 0 }}>Berita Terhangat</h2>
          </motion.div>

          {/* Grid Articles */}
          <motion.div className="news-page-grid" variants={itemVariants}>
            {gridArticles.map((article) => (
              <div 
                key={article.id} 
                className="news-page-grid-item"
                onClick={() => router.push(`/news/${article.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <img src={article.imageUrl} alt={article.title} />
                <div>
                  <div className="news-page-grid-meta">
                    {article.category} — {article.date}
                  </div>
                  <h3 className="news-page-grid-title">{article.title}</h3>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Lihat Lainnya Button */}
          <motion.div variants={itemVariants} style={{ textAlign: 'center', marginTop: '60px' }}>
            <button className="program-explore-btn" style={{ width: 'auto', padding: '0 32px' }}>
              Lihat Lainnya
            </button>
          </motion.div>

        </motion.div>
        )}
      </div>
    </div>
  );
}
