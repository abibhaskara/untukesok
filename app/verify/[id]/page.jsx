'use client';
export const runtime = 'edge';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '../../../src/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { generateCertificatePreviewUrl, downloadCertificatePng } from '../../../src/lib/certificateGenerator';

export default function VerifyCertificatePage() {
  const { id } = useParams();
  const router = useRouter();

  const [status, setStatus] = useState('loading'); // loading, valid, invalid
  const [certData, setCertData] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    const verifyCredential = async () => {
      try {
        const q = query(collection(db, 'applications'), where('credentialId', '==', id));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const appDoc = snapshot.docs[0];
          const docData = appDoc.data();

          let fullData = { ...docData, id: appDoc.id };

          if (docData.programId) {
            try {
              const progSnap = await getDoc(doc(db, 'programs', docData.programId));
              if (progSnap.exists()) {
                const pData = progSnap.data();
                fullData = {
                  ...fullData,
                  signer1Name: pData.signer1Name || fullData.signer1Name || 'Abi Bhaskara',
                  signer1Role: pData.signer1Role || fullData.signer1Role || 'Project Leader Untuk Esok',
                  signer1SignatureUrl: pData.signer1SignatureUrl || null,
                  signer2Name: pData.signer2Name || fullData.signer2Name || 'Wayan Sudarma',
                  signer2Role: pData.signer2Role || fullData.signer2Role || 'Manager Mitra',
                  signer2SignatureUrl: pData.signer2SignatureUrl || null,
                  certificateTemplateUrl: pData.certificateTemplateUrl || '/certificate-template-official.jpg',
                  programTitle: fullData.programTitle || pData.title || 'Untuk Esok',
                  programDate: fullData.programDate || pData.date,
                };
              }
            } catch (progErr) {
              console.warn("Could not fetch program details:", progErr);
            }
          }

          setCertData(fullData);
          setStatus('valid');

          setIsRendering(true);
          generateCertificatePreviewUrl(fullData)
            .then(url => setPreviewUrl(url))
            .catch(err => console.error("Error generating cert canvas:", err))
            .finally(() => setIsRendering(false));

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

  const handleDownload = () => {
    if (!certData) return;
    downloadCertificatePng(certData);
  };

  const isExternalUrl = certData?.certificateUrl &&
    certData.certificateUrl.startsWith('http') &&
    !certData.certificateUrl.includes('/verify/');

  return (
    <div className="verify-page-fullscreen">
      {status === 'loading' && (
        <div className="verify-loading-state">
          <div className="verify-spinner" />
          <p>Memverifikasi kredensial...</p>
        </div>
      )}

      {status === 'valid' && certData && (
        <div className="verify-fullscreen-layout">
          {/* Top Bar Header */}
          <header className="verify-header-bar">
            <div>
              <h1 className="verify-main-title">Verifikasi Sertifikat</h1>
              <p className="verify-main-sub">Sertifikat terdaftar dan valid dalam basis data Untuk Esok.</p>
            </div>
            <div className="verify-status-badge">
              Terverifikasi
            </div>
          </header>

          {/* Main 2-Column Full-width Grid */}
          <div className="verify-grid-container">
            {/* Left: Certificate Preview */}
            <div className="verify-preview-pane">
              <div className="verify-canvas-wrapper">
                {isRendering ? (
                  <div className="verify-canvas-loading">
                    <div className="verify-spinner" />
                    <span>Menyiapkan dokumen sertifikat...</span>
                  </div>
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Sertifikat Untuk Esok"
                    className="verify-canvas-img"
                  />
                ) : (
                  <div className="verify-canvas-loading">
                    <span>Pratinjau sertifikat tidak tersedia</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="verify-actions-row">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="verify-btn-primary"
                >
                  Unduh Sertifikat (PNG)
                </button>

                {isExternalUrl && (
                  <a
                    href={certData.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="verify-btn-secondary"
                  >
                    Buka Berkas Eksternal
                  </a>
                )}
              </div>
            </div>

            {/* Right: Credential Dossier */}
            <div className="verify-dossier-pane">
              <div className="verify-card-section">
                <div className="verify-section-heading">Informasi Penerima</div>
                <div className="verify-info-row">
                  <span className="verify-info-label">Nama</span>
                  <span className="verify-info-val">{certData.userName || '-'}</span>
                </div>
                <div className="verify-info-row">
                  <span className="verify-info-label">Program</span>
                  <span className="verify-info-val">{certData.programTitle || '-'}</span>
                </div>
                {certData.programDate && (
                  <div className="verify-info-row">
                    <span className="verify-info-label">Tanggal Pelaksanaan</span>
                    <span className="verify-info-val">{certData.programDate}</span>
                  </div>
                )}
              </div>

              <div className="verify-card-section">
                <div className="verify-section-heading">Data Kredensial</div>
                <div className="verify-info-row">
                  <span className="verify-info-label">Nomor Sertifikat</span>
                  <span className="verify-info-mono">{certData.certificateNumber || '-'}</span>
                </div>
                <div className="verify-info-row">
                  <span className="verify-info-label">ID Kredensial</span>
                  <span className="verify-info-mono">{certData.credentialId || id}</span>
                </div>
                <div className="verify-info-row">
                  <span className="verify-info-label">Status Validasi</span>
                  <span className="verify-info-val">Aktif</span>
                </div>
              </div>

              <div className="verify-card-section">
                <div className="verify-section-heading">Penandatangan</div>
                <div className="verify-info-row">
                  <span className="verify-info-label">Pihak 1</span>
                  <span className="verify-info-val">
                    {certData.signer1Name || 'Abi Bhaskara'} ({certData.signer1Role || 'Project Leader'})
                  </span>
                </div>
                <div className="verify-info-row">
                  <span className="verify-info-label">Pihak 2</span>
                  <span className="verify-info-val">
                    {certData.signer2Name || 'Wayan Sudarma'} ({certData.signer2Role || 'Manager Mitra'})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push('/')}
                className="verify-btn-home"
              >
                Kembali ke Beranda
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'invalid' && (
        <div className="verify-invalid-state">
          <h1 className="verify-invalid-title">Kredensial Tidak Ditemukan</h1>
          <p className="verify-invalid-text">
            ID kredensial <strong>{id}</strong> tidak terdaftar dalam sistem verifikasi Untuk Esok.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="verify-btn-primary"
            style={{ width: 'auto', padding: '12px 24px' }}
          >
            Kembali ke Beranda
          </button>
        </div>
      )}

      <style jsx>{`
        .verify-page-fullscreen {
          width: 100%;
          min-height: 100vh;
          background: #F8FAFC;
          color: #0F172A;
          box-sizing: border-box;
          padding: 40px 48px 120px 48px;
        }

        .verify-fullscreen-layout {
          max-width: 1360px;
          margin: 0 auto;
          width: 100%;
        }

        .verify-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 24px;
          margin-bottom: 32px;
          border-bottom: 1px solid #E2E8F0;
        }

        .verify-main-title {
          font-size: 24px;
          font-weight: 700;
          color: #233B69;
          margin: 0 0 6px 0;
          letter-spacing: -0.5px;
        }

        .verify-main-sub {
          font-size: 14px;
          color: #64748B;
          margin: 0;
        }

        .verify-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 16px;
          border-radius: 9999px;
          background: #ECFDF5;
          color: #065F46;
          border: 1px solid #A7F3D0;
          font-size: 13px;
          font-weight: 600;
        }

        .verify-grid-container {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 36px;
          align-items: start;
        }

        .verify-preview-pane {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .verify-canvas-wrapper {
          width: 100%;
          background: #0F172A;
          border: 1px solid #CBD5E1;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 380px;
        }

        .verify-canvas-img {
          width: 100%;
          height: auto;
          display: block;
        }

        .verify-canvas-loading {
          padding: 60px 20px;
          color: #94A3B8;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          font-size: 13px;
        }

        .verify-actions-row {
          display: flex;
          gap: 12px;
        }

        .verify-btn-primary {
          flex: 1;
          padding: 14px 20px;
          background: #233B69;
          color: #FFFFFF;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
          text-align: center;
          text-decoration: none;
        }

        .verify-btn-primary:hover {
          background: #1B2E53;
        }

        .verify-btn-secondary {
          flex: 1;
          padding: 14px 20px;
          background: #FFFFFF;
          color: #233B69;
          border: 1px solid #CBD5E1;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          text-decoration: none;
        }

        .verify-dossier-pane {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .verify-card-section {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .verify-section-heading {
          font-size: 12px;
          font-weight: 700;
          color: #233B69;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding-bottom: 8px;
          border-bottom: 1px solid #F1F5F9;
        }

        .verify-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          gap: 16px;
        }

        .verify-info-label {
          color: #64748B;
          font-weight: 500;
        }

        .verify-info-val {
          color: #0F172A;
          font-weight: 600;
          text-align: right;
        }

        .verify-info-mono {
          font-family: monospace;
          color: #0F172A;
          font-weight: 600;
          font-size: 12px;
        }

        .verify-btn-home {
          padding: 12px;
          background: transparent;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          color: #64748B;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          margin-top: 8px;
          transition: all 0.2s ease;
        }

        .verify-btn-home:hover {
          color: #0F172A;
          border-color: #CBD5E1;
          background: #FFFFFF;
        }

        .verify-loading-state,
        .verify-invalid-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          text-align: center;
          gap: 16px;
        }

        .verify-invalid-title {
          font-size: 24px;
          font-weight: 700;
          color: #0F172A;
          margin: 0;
        }

        .verify-invalid-text {
          font-size: 14px;
          color: #64748B;
          max-width: 420px;
          margin: 0;
          line-height: 1.6;
        }

        .verify-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid #E2E8F0;
          border-top-color: #233B69;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 960px) {
          .verify-page-fullscreen {
            padding: 24px 20px 100px 20px;
          }

          .verify-grid-container {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .verify-header-bar {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}
