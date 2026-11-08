'use client';
import { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiInstagram, FiChevronRight } from 'react-icons/fi';
import { db } from '../../../src/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, limit } from 'firebase/firestore';
import { clearCache } from '../../../src/lib/dataService';
import AdminPagination from '../../../src/components/AdminPagination';
import AdminSearchFilterBar from '../../../src/components/AdminSearchFilterBar';

export default function AdminNews() {
  const [newsList, setNewsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('date_desc'); // date_desc, date_asc, title_asc
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // State form
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: 'Edukasi',
    date: '',
    imageUrl: '',
    summary: '',
    content: '',
    instagramUrl: '',
    instagramImages: ''
  });

  const fetchNews = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(query(collection(db, 'news'), limit(100)));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNewsList(data);
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const filteredNews = useMemo(() => {
    let list = newsList.filter(article => {
      const title = (article.title || '').toLowerCase();
      const summary = (article.summary || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      return title.includes(q) || summary.includes(q);
    });

    list.sort((a, b) => {
      if (sortOrder === 'date_desc') {
        return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
      }
      if (sortOrder === 'date_asc') {
        return new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0);
      }
      if (sortOrder === 'title_asc') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });

    return list;
  }, [newsList, searchQuery, sortOrder]);

  const paginatedNews = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredNews.slice(start, start + pageSize);
  }, [filteredNews, currentPage, pageSize]);

  const handleOpenModal = (article = null) => {
    if (article) {
      setEditingId(article.id);
      let imgStr = '';
      if (Array.isArray(article.carouselImages)) {
        imgStr = article.carouselImages.join('\n');
      } else if (typeof article.carouselImages === 'string') {
        imgStr = article.carouselImages;
      } else if (Array.isArray(article.instagramImages)) {
        imgStr = article.instagramImages.join('\n');
      } else if (typeof article.instagramImages === 'string') {
        imgStr = article.instagramImages;
      }

      setFormData({
        title: article.title || '',
        category: article.category || 'Edukasi',
        date: article.date || '',
        imageUrl: article.imageUrl || '',
        summary: article.summary || '',
        content: article.content || '',
        instagramUrl: article.instagramUrl || '',
        instagramImages: imgStr
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        category: 'Edukasi',
        date: '',
        imageUrl: '',
        summary: '',
        content: '',
        instagramUrl: '',
        instagramImages: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const carouselImages = formData.instagramImages
        ? formData.instagramImages
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean)
        : [];

      const payload = {
        title: formData.title,
        category: formData.category,
        imageUrl: formData.imageUrl,
        summary: formData.summary,
        content: formData.content,
        instagramUrl: formData.instagramUrl || '',
        carouselImages: carouselImages
      };
      
      if (editingId) {
        if (formData.date) payload.date = formData.date;
        await updateDoc(doc(db, 'news', editingId), payload);
      } else {
        // Otomatis set tanggal terbit saat buat baru
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const d = new Date();
        payload.date = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        
        await addDoc(collection(db, 'news'), payload);
      }
      clearCache('news');
      setIsModalOpen(false);
      fetchNews(); // Refresh
    } catch (error) {
      console.error("Error saving news:", error);
      alert("Gagal menyimpan data berita!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Yakin ingin menghapus artikel ini?")) {
      try {
        await deleteDoc(doc(db, 'news', id));
        clearCache('news');
        fetchNews();
      } catch (error) {
        console.error("Error deleting news:", error);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="ue-eyebrow" style={{ marginBottom: '4px' }}>DIVISI MEDIA & PUBLIKASI</div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Publikasi & Berita
          </h1>
        </div>
        <button 
          type="button"
          onClick={() => handleOpenModal()} 
          className="ue-icon-btn"
          title="Buat Artikel Baru"
          aria-label="Buat Artikel Baru"
        >
          <FiPlus size={18} />
        </button>
      </div>

      {/* SEARCH, FILTER & SORTING BAR */}
      <AdminSearchFilterBar
        searchValue={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Cari judul berita atau rangkuman..."
        ariaLabel="Urutkan Kegiatan"
        title="Urutkan Kegiatan"
        style={{ marginBottom: '20px' }}
        sections={[
          {
            label: 'Urutkan',
            value: sortOrder,
            onChange: (val) => {
              setSortOrder(val);
              setCurrentPage(1);
            },
            options: [
              { value: 'date_desc', label: 'Tanggal Terbit Terbaru' },
              { value: 'date_asc', label: 'Tanggal Terbit Terlama' },
              { value: 'title_asc', label: 'Judul (A-Z)' }
            ]
          }
        ]}
      />

      <div className="admin-table-card">
        <div className="admin-mobile-swipe-hint">
          <FiChevronRight size={14} /> Geser tabel ke kanan untuk melihat tanggal terbit & aksi
        </div>
        <div className="admin-table-responsive">
          <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
                <th style={{ padding: '14px 20px' }}>Judul Berita</th>
                <th style={{ padding: '14px 20px' }}>Kategori</th>
                <th style={{ padding: '14px 20px' }}>Tanggal Terbit</th>
                <th style={{ padding: '14px 20px', textAlign: 'center' }} aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="4" style={{ padding: '28px', textAlign: 'center', color: '#64748b' }}>Memuat data artikel...</td></tr>
              ) : filteredNews.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: '28px', textAlign: 'center', color: '#64748b' }}>Tidak ada artikel berita yang sesuai filter.</td></tr>
              ) : (
                paginatedNews.map(article => (
                  <tr key={article.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, fontSize: '13.5px', color: '#0F172A' }}>{article.title}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="ue-pill ue-pill-neutral" style={{ fontSize: '11.5px', fontWeight: 500 }}>
                        {article.category}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748B', fontSize: '12.5px', whiteSpace: 'nowrap' }}>{article.date}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button onClick={() => handleOpenModal(article)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Edit">
                          <FiEdit2 size={12} /> Edit
                        </button>
                        <button onClick={() => handleDelete(article.id)} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Hapus">
                          <FiTrash2 size={12} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredNews.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 50, 100]}
        />
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="admin-modal-container" style={{ maxWidth: '640px' }}>
            <div className="admin-modal-header">
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0F172A' }}>{editingId ? 'Edit Artikel' : 'Buat Artikel'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}><FiX /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="admin-modal-body">
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Judul Artikel</label>
                <input required name="title" value={formData.title} onChange={handleInputChange} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Kategori</label>
                <select required name="category" value={formData.category} onChange={handleInputChange} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', boxSizing: 'border-box' }}>
                  <option value="Edukasi">Edukasi</option>
                  <option value="Kisah Inspiratif">Kisah Inspiratif</option>
                  <option value="Pengumuman">Pengumuman</option>
                  <option value="Kegiatan">Kegiatan</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>URL Gambar / Thumbnail</label>
                <input required name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} placeholder="https://..." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Ringkasan Pendek (Summary)</label>
                <textarea required name="summary" value={formData.summary} onChange={handleInputChange} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Isi Artikel Lengkap</label>
                <textarea required name="content" value={formData.content} onChange={handleInputChange} rows={8} placeholder="Tuliskan isi artikel selengkapnya di sini..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical', lineHeight: '1.6', boxSizing: 'border-box' }} />
              </div>

              {/* SECTION CAROUSEL INSTAGRAM */}
              <div style={{ padding: '16px', background: '#fdf4ff', borderRadius: '10px', border: '1px solid #f5d0fe', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9333ea', fontWeight: 700, fontSize: '14px' }}>
                  <FiInstagram style={{ fontSize: '18px' }} /> Postingan Carousel Instagram (Opsional)
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                    URL Postingan Instagram
                  </label>
                  <input 
                    name="instagramUrl" 
                    value={formData.instagramUrl} 
                    onChange={handleInputChange} 
                    placeholder="https://www.instagram.com/p/..." 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', background: 'white', boxSizing: 'border-box' }} 
                  />
                  <small style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Tautan ke postingan asli Instagram (contoh: https://www.instagram.com/p/DBxy1234/)
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                    Daftar URL Gambar Carousel (1 URL per baris)
                  </label>
                  <textarea 
                    name="instagramImages" 
                    value={formData.instagramImages} 
                    onChange={handleInputChange} 
                    rows={4} 
                    placeholder={"https://images.unsplash.com/photo-1...\nhttps://images.unsplash.com/photo-2..."} 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', resize: 'vertical', background: 'white', fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box' }} 
                  />
                  <small style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Masukkan link foto slide carousel (bisa lebih dari satu, pisahkan dengan baris baru).
                  </small>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" disabled={isSubmitting} onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: isSubmitting ? 0.6 : 1 }}>Batal</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: isSubmitting ? 0.7 : 1 }}>{isSubmitting ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Terbitkan Artikel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
