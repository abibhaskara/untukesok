'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();

  // Deaktifkan footer pada seluruh rute admin
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="ue-site-footer">
      <div className="ue-footer-inner">
        <div className="ue-footer-brand">
          <div className="ue-footer-logo">UNTUK ESOK</div>
          <p className="ue-footer-desc">
            Platform manajemen dan pemberdayaan relawan sosial berbasis kecerdasan buatan.
          </p>
          <div className="ue-footer-locale">Bali, Indonesia</div>
        </div>

        <div className="ue-footer-col">
          <div className="ue-footer-heading">Navigasi</div>
          <ul className="ue-footer-links">
            <li><Link href="/">Beranda</Link></li>
            <li><Link href="/kegiatan">Kegiatan</Link></li>
            <li><Link href="/berita">Berita</Link></li>
            <li><Link href="/berita#kotak-suara">Kotak Suara</Link></li>
            <li><Link href="/akun">Portal Relawan</Link></li>
          </ul>
        </div>

        <div className="ue-footer-col">
          <div className="ue-footer-heading">Layanan</div>
          <ul className="ue-footer-links">
            <li><Link href="/verify">Verifikasi Sertifikat</Link></li>
            <li><Link href="/kegiatan">Pendaftaran Relawan</Link></li>
            <li><Link href="/#donasi">Transparansi Donasi</Link></li>
          </ul>
        </div>

        <div className="ue-footer-col">
          <div className="ue-footer-heading">Kontak</div>
          <p className="ue-footer-text">Denpasar, Bali</p>
          <p className="ue-footer-text">info@untukesok.id</p>
        </div>
      </div>

      <div className="ue-footer-bottom">
        <div className="ue-footer-copy">
          &copy; 2026 Untuk Esok. Seluruh hak cipta dilindungi.
        </div>
      </div>
    </footer>
  );
}

