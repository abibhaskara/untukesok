'use client';
import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import { db } from '../../../src/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { clearCache } from '../../../src/lib/dataService';

export default function AdminNews() {
  const [newsList, setNewsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State form
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'Edukasi',
    date: '',
    imageUrl: '',
    summary: '',
    content: ''
  });

  const fetchNews = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'news'));
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

  const handleOpenModal = (article = null) => {
    if (article) {
      setEditingId(article.id);
      setFormData(article);
    } else {
      setEditingId(null);
      setFormData({
        title: '', category: 'Edukasi', date: '', imageUrl: '', summary: '', content: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let finalData = { ...formData };
      
      if (editingId) {
        await updateDoc(doc(db, 'news', editingId), formData);
      } else {
        // Otomatis set tanggal terbit saat buat baru
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const d = new Date();
        finalData.date = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        
        await addDoc(collection(db, 'news'), finalData);
      }
      clearCache('news');
      setIsModalOpen(false);
      fetchNews(); // Refresh
    } catch (error) {
      console.error("Error saving news:", error);
      alert("Gagal menyimpan data berita!");
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '32px', marginBottom: '8px' }}>Kelola Berita</h1>
          <p style={{ color: '#666', margin: 0 }}>Daftar artikel, publikasi, dan berita terbaru.</p>
        </div>
        <button onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          <FiPlus /> Buat Artikel
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #eaeaea' }}>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Judul Berita</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Kategori</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Tanggal Terbit</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>Memuat data...</td></tr>
            ) : newsList.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>Belum ada artikel berita.</td></tr>
            ) : (
              newsList.map(article => (
                <tr key={article.id} style={{ borderBottom: '1px solid #eaeaea' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 600 }}>{article.title}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ padding: '4px 12px', background: '#f9f0ff', color: '#722ed1', borderRadius: '100px', fontSize: '12px' }}>
                      {article.category}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', color: '#666' }}>{article.date}</td>
                  <td style={{ padding: '16px 24px', display: 'flex', gap: '12px' }}>
                    <button onClick={() => handleOpenModal(article)} style={{ background: 'none', border: 'none', color: '#1890ff', cursor: 'pointer', fontSize: '16px' }} title="Edit"><FiEdit2 /></button>
                    <button onClick={() => handleDelete(article.id)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '16px' }} title="Hapus"><FiTrash2 /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-playfair)' }}>{editingId ? 'Edit Artikel' : 'Buat Artikel'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}><FiX /></button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Judul Artikel</label>
                <input required name="title" value={formData.title} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Kategori</label>
                  <select required name="category" value={formData.category} onChange={handleInputChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none' }}>
                    <option value="Edukasi">Edukasi</option>
                    <option value="Kisah Inspiratif">Kisah Inspiratif</option>
                    <option value="Pengumuman">Pengumuman</option>
                    <option value="Kegiatan">Kegiatan</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>URL Gambar / Thumbnail</label>
                <input required name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} placeholder="https://..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Ringkasan Pendek (Summary)</label>
                <textarea required name="summary" value={formData.summary} onChange={handleInputChange} rows={3} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none', resize: 'vertical' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Isi Artikel Lengkap</label>
                <textarea required name="content" value={formData.content} onChange={handleInputChange} rows={10} placeholder="Tuliskan isi artikel selengkapnya di sini..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none', resize: 'vertical', lineHeight: '1.6' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
                <button type="submit" style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>{editingId ? 'Simpan Perubahan' : 'Terbitkan Artikel'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
