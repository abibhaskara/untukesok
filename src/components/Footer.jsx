import Link from 'next/link';
import { FiInstagram, FiGlobe } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="footer-container">
      <div className="main-content footer-content">
        <div className="footer-top-grid">
          <div className="footer-brand">
            <img 
              src="/logo_UE.webp" 
              alt="Untuk Esok Logo" 
              style={{ marginBottom: '8px', borderRadius: '4px', width: '120px', height: '120px', objectFit: 'cover' }} 
            />

          </div>
          
          <div className="footer-links">
            <ul>
              <li><Link href="/">TENTANG KAMI</Link></li>
              <li><Link href="/#about">MISI KAMI</Link></li>
              <li><Link href="/#founders">TIM KAMI</Link></li>
            </ul>
          </div>

          <div className="footer-links">
            <ul>
              <li><Link href="/programs">PROGRAM</Link></li>
              <li><Link href="/#donate">DONASI SEKARANG</Link></li>
              <li><Link href="/programs">JADI RELAWAN</Link></li>
            </ul>
          </div>

          <div className="footer-links">
            <ul>
              <li><Link href="/news">BERITA & CERITA</Link></li>
              <li><Link href="/news">SIARAN PERS</Link></li>
              <li><Link href="/news">MEDIA KIT</Link></li>
            </ul>
          </div>

          <div className="footer-links">
            <ul>
              <li><Link href="/account">AKUN SAYA</Link></li>
              <li><Link href="mailto:hello@untukesok.org">HUBUNGI KAMI</Link></li>
              <li><Link href="/">SYARAT & KETENTUAN</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-divider"></div>

        <div className="footer-bottom">
          <div className="footer-socials">
            <a href="https://www.instagram.com/untukesok" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="social-icon">
              <FiInstagram size={14} />
            </a>
            <a href="https://untukesok.id" target="_blank" rel="noopener noreferrer" aria-label="Website" className="social-icon">
              <FiGlobe size={14} />
            </a>
            <a href="https://chat.whatsapp.com/DQ8RnyXwkEkIIdN5xvSRga" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp Community" className="social-icon">
              <FaWhatsapp size={14} />
            </a>
          </div>
          <p>&copy;Hak Cipta. Semua hak dilindungi.</p>
        </div>
      </div>
    </footer>
  );
}
