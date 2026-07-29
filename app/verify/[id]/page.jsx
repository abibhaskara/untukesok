'use client';
export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FiCheckCircle, FiXCircle, FiHome } from 'react-icons/fi';
import { db } from '../../../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function VerifyCertificatePage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [status, setStatus] = useState('loading'); // loading, valid, invalid
  const [certData, setCertData] = useState(null);

  useEffect(() => {
    const verifyCredential = async () => {
      try {
        const q = query(collection(db, 'applications'), where('credentialId', '==', id));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          setCertData(docData);
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      } catch (error) {
        console.error("Error verifying credential:", error);
        setStatus('invalid');
      }
    };

    if (id) {
      verifyCredential();
    }
  }, [id]);

  return (
    <div className="home-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', background: '#f8f9fa' }}>
      
      {status === 'loading' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #ccc', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#666' }}>Memverifikasi Kredensial...</p>
        </div>
      )}

      {status === 'valid' && certData && (
        <div style={{ width: '100%', maxWidth: '400px', background: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <FiCheckCircle size={64} color="#10b981" style={{ marginBottom: '16px' }} />
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '24px', marginBottom: '8px', color: '#111' }}>Sertifikat Valid</h1>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '32px' }}>Dokumen ini adalah sertifikat resmi yang dikeluarkan oleh Untuk Esok.</p>
          
          <div style={{ background: '#f8f9fa', borderRadius: '16px', padding: '20px', textAlign: 'left', marginBottom: '24px', border: '1px solid #eaeaea' }}>
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Program Kegiatan</span>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#111', margin: '4px 0 0 0' }}>{certData.programTitle}</p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Tanggal Diterbitkan</span>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#111', margin: '4px 0 0 0' }}>{new Date(certData.appliedAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>ID Kredensial</span>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#111', margin: '4px 0 0 0', fontFamily: 'monospace' }}>{certData.credentialId}</p>
            </div>
          </div>

          <a href={certData.certificateUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', padding: '16px', background: 'var(--primary)', color: 'white', borderRadius: '12px', fontWeight: 700, textDecoration: 'none', marginBottom: '12px' }}>
            Lihat Sertifikat Asli
          </a>
          
          <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '16px', background: 'transparent', color: '#666', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
            <FiHome /> Kembali ke Beranda
          </button>
        </div>
      )}

      {status === 'invalid' && (
        <div style={{ width: '100%', maxWidth: '400px', background: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <FiXCircle size={64} color="#ef4444" style={{ marginBottom: '16px' }} />
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '24px', marginBottom: '8px', color: '#111' }}>Kredensial Tidak Valid</h1>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '32px' }}>ID Kredensial <strong>{id}</strong> tidak ditemukan dalam sistem kami atau mungkin palsu.</p>
          
          <button onClick={() => router.push('/')} style={{ display: 'block', width: '100%', padding: '16px', background: 'var(--primary)', color: 'white', borderRadius: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            Kembali ke Beranda
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
