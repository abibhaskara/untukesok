import '../src/index.css';
import Navbar from '../src/components/Navbar';
import Footer from '../src/components/Footer';
import { AuthProvider } from '../src/context/AuthContext';

export const metadata = {
  title: 'Untuk Esok — Pemberdayaan & Kreativitas Manusia',
  description: 'Organisasi non-pemerintah yang dipimpin oleh mahasiswa dengan fokus pada pemberdayaan masyarakat lokal melalui pendidikan yang mudah diakses dan teknologi kolaboratif.',
  openGraph: {
    title: 'Untuk Esok — Pemberdayaan & Kreativitas Manusia',
    description: 'Fokus pada pemberdayaan masyarakat lokal melalui pendidikan yang mudah diakses dan teknologi kolaboratif.',
    url: 'https://untukesok.org',
    siteName: 'Untuk Esok',
    images: [
      {
        url: 'https://res.cloudinary.com/dnbgczi9b/image/upload/v1785207727/3_rzvj2o.webp', // Default OG Image
        width: 1200,
        height: 630,
        alt: 'Untuk Esok Logo or Banner',
      },
    ],
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Untuk Esok — Pemberdayaan & Kreativitas Manusia',
    description: 'Pemberdayaan masyarakat lokal melalui pendidikan yang mudah diakses.',
    images: ['https://res.cloudinary.com/dnbgczi9b/image/upload/v1785207727/3_rzvj2o.webp'], // Default Twitter Image
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <script 
          src="https://app.sandbox.midtrans.com/snap/snap.js" 
          data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
          defer
        />
      </head>
      <body>
        <div className="app-container">
          <AuthProvider>
            {children}
            <Footer />
            <Navbar />
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
