'use client';
import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiUsers, FiInfo, FiMapPin, FiLink, FiAlertCircle } from 'react-icons/fi';
import { db } from '../../../src/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { clearCache } from '../../../src/lib/dataService';
import { calculateProgramDeadlineAndDaysLeft, calculateDaysLeftGMT8 } from '../../../src/lib/dateUtils';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminPrograms() {
  const router = useRouter();
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State form
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'Pendidikan',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    imageUrl: '',
    volunteersTarget: 0,
    volunteersJoined: 0,
    daysLeft: 0,
    urgent: false,
    description: '',
    whatsappGroupLink: '',
    twibbonLink: ''
  });

  const fetchPrograms = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'programs'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPrograms(data);
    } catch (error) {
      console.error("Error fetching programs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleOpenModal = (prog = null) => {
    if (prog) {
      setEditingId(prog.id);
      setFormData(prog);
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        category: 'Pendidikan',
        date: '',
        startTime: '',
        endTime: '',
        location: '',
        imageUrl: '',
        volunteersTarget: 0,
        volunteersJoined: 0,
        daysLeft: 0,
        deadline: '',
        urgent: false,
        description: '',
        whatsappGroupLink: '',
        twibbonLink: '',
        tasks: '',
        criteria: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'programs', editingId), formData);
      } else {
        await addDoc(collection(db, 'programs'), formData);
      }
      clearCache('programs');
      setIsModalOpen(false);
      fetchPrograms(); // Refresh
    } catch (error) {
      console.error("Error saving program:", error);
      alert("Gagal menyimpan data!");
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Yakin ingin menghapus program ini?")) {
      try {
        await deleteDoc(doc(db, 'programs', id));
        clearCache('programs');
        fetchPrograms();
      } catch (error) {
        console.error("Error deleting program:", error);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value);
    
    if (name === 'date') {
      const { deadline, daysLeft } = calculateProgramDeadlineAndDaysLeft(value);
      
      setFormData(prev => ({ 
        ...prev, 
        date: value, 
        deadline: deadline, 
        daysLeft: daysLeft 
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: val }));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '32px', marginBottom: '8px' }}>Kelola Program</h1>
          <p style={{ color: '#666', margin: 0 }}>Daftar program relawan dan aktivitas sosial.</p>
        </div>
        <button onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          <FiPlus /> Tambah Program
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #eaeaea' }}>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Judul Program</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Kategori</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Relawan Terkumpul</th>
              <th style={{ padding: '16px 24px', color: '#666', fontWeight: 600 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>Memuat data...</td></tr>
            ) : programs.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>Belum ada program.</td></tr>
            ) : (
              programs.map(prog => (
                <tr key={prog.id} style={{ borderBottom: '1px solid #eaeaea' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 600 }}>{prog.title}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{prog.location}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ padding: '4px 12px', background: '#e6f7ff', color: '#1890ff', borderRadius: '100px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {prog.category}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>{prog.volunteersJoined} / {prog.volunteersTarget}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => router.push(`/admin/applications?programId=${prog.id}`)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '16px' }} title="Lihat Pendaftar"><FiUsers /></button>
                      <button onClick={() => handleOpenModal(prog)} style={{ background: 'none', border: 'none', color: '#1890ff', cursor: 'pointer', fontSize: '16px' }} title="Edit"><FiEdit2 /></button>
                      <button onClick={() => handleDelete(prog.id)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '16px' }} title="Hapus"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form Advance */}
      <AnimatePresence>
        {isModalOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 24px 50px rgba(0,0,0,0.1)' }}
            >
              <div style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #eaeaea', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-playfair)', fontSize: '24px' }}>{editingId ? 'Edit Program Relawan' : 'Buat Program Baru'}</h2>
                <button onClick={() => setIsModalOpen(false)} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#e0e0e0'} onMouseOut={e => e.currentTarget.style.background = '#f5f5f5'}>
                  <FiX />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                {/* SECTION 1: Informasi Dasar */}
                <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: '#1e293b' }}><FiInfo color="var(--primary)" /> Informasi Dasar</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Judul Program <span style={{ color: 'red' }}>*</span></label>
                      <input required name="title" value={formData.title} onChange={handleInputChange} placeholder="Ketik judul program yang menarik..." style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', transition: 'border 0.2s', background: 'white' }} onFocus={e => e.target.style.borderColor = 'var(--primary)'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Kategori Program <span style={{ color: 'red' }}>*</span></label>
                        <select required name="category" value={formData.category} onChange={handleInputChange} style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: 'white', cursor: 'pointer' }}>
                          <option value="Pendidikan">Pendidikan</option>
                          <option value="Lingkungan">Lingkungan</option>
                          <option value="Kesehatan">Kesehatan</option>
                          <option value="Sosial">Sosial</option>
                          <option value="Bencana Alam">Bencana Alam</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Deskripsi Lengkap <span style={{ color: 'red' }}>*</span></label>
                      <textarea required name="description" value={formData.description} onChange={handleInputChange} rows={5} placeholder="Jelaskan secara detail tentang program, kegiatan, dan dampaknya..." style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', resize: 'vertical', background: 'white', lineHeight: '1.6' }} onFocus={e => e.target.style.borderColor = 'var(--primary)'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Tugas Relawan <span style={{ color: 'red' }}>*</span></label>
                        <textarea required name="tasks" value={formData.tasks} onChange={handleInputChange} rows={4} placeholder="- Tugas 1&#10;- Tugas 2" style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', resize: 'vertical', background: 'white', lineHeight: '1.6' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Kriteria Relawan <span style={{ color: 'red' }}>*</span></label>
                        <textarea required name="criteria" value={formData.criteria} onChange={handleInputChange} rows={4} placeholder="- Kriteria 1&#10;- Kriteria 2" style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', resize: 'vertical', background: 'white', lineHeight: '1.6' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Waktu & Lokasi */}
                <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: '#1e293b' }}><FiMapPin color="var(--primary)" /> Pelaksanaan</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Waktu Pelaksanaan <span style={{ color: 'red' }}>*</span></label>
                      <input type="date" required name="date" value={formData.date} onChange={handleInputChange} style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: 'white' }} />
                      {formData.date && (
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b' }}>
                          Otomatis ditutup H-1 ({formData.deadline})<br/>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>⏱ Sisa waktu terhitung (GMT+8): {calculateDaysLeftGMT8(formData)} Hari</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Jam <span style={{ color: 'red' }}>*</span></label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="time" required name="startTime" value={formData.startTime} onChange={handleInputChange} style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: 'white' }} />
                        <span style={{ color: '#64748b', fontWeight: 600 }}>-</span>
                        <input type="time" required name="endTime" value={formData.endTime} onChange={handleInputChange} style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: 'white' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Titik Lokasi <span style={{ color: 'red' }}>*</span></label>
                      <input required name="location" value={formData.location} onChange={handleInputChange} placeholder="Misal: Desa Cibodas, Jawa Barat" style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: 'white' }} />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Tautan Media & Pendaftaran */}
                <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: '#1e293b' }}><FiLink color="var(--primary)" /> Tautan Penting</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>URL Poster / Gambar (Cover) <span style={{ color: 'red' }}>*</span></label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input required name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} placeholder="https://..." style={{ flex: 1, padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: 'white' }} />
                        {formData.imageUrl && (
                          <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                            <img src={formData.imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display='none'} />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Link WhatsApp Group (GC)</label>
                        <input name="whatsappGroupLink" value={formData.whatsappGroupLink || ''} onChange={handleInputChange} placeholder="https://chat.whatsapp.com/..." style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: 'white' }} />
                        <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>Akan otomatis terlihat oleh pendaftar</p>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#475569' }}>Link Twibbon Campaign</label>
                        <input name="twibbonLink" value={formData.twibbonLink || ''} onChange={handleInputChange} placeholder="https://twibbonize.com/..." style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: 'white' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: Kuota Relawan */}
                <div style={{ background: '#fefce8', padding: '24px', borderRadius: '16px', border: '1px solid #fef08a' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: '#854d0e' }}><FiUsers /> Kapasitas Relawan</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#854d0e' }}>Target Relawan Dibutuhkan <span style={{ color: 'red' }}>*</span></label>
                      <input type="number" required name="volunteersTarget" value={formData.volunteersTarget} onChange={handleInputChange} min="1" style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #fde047', outline: 'none', fontSize: '15px', background: 'white' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#854d0e' }}>Jumlah Bergabung Saat Ini</label>
                      <input type="number" required name="volunteersJoined" value={formData.volunteersJoined} onChange={handleInputChange} min="0" style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #fde047', outline: 'none', fontSize: '15px', background: 'white' }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '8px', position: 'sticky', bottom: '-32px', background: 'white', padding: '24px 0', borderTop: '1px solid #eaeaea', zIndex: 10 }}>
                  <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '14px 28px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', cursor: 'pointer', fontWeight: 700, fontSize: '15px', transition: 'all 0.2s' }} onMouseOver={e => e.target.style.background = '#f1f5f9'} onMouseOut={e => e.target.style.background = 'white'}>
                    Batal
                  </button>
                  <button type="submit" style={{ padding: '14px 28px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(26,115,232,0.3)', transition: 'all 0.2s' }} onMouseOver={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 16px rgba(26,115,232,0.4)'; }} onMouseOut={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 12px rgba(26,115,232,0.3)'; }}>
                    {editingId ? 'Simpan Perubahan' : 'Terbitkan Program'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
