import '../src/index.css';
import { Poppins, Cinzel } from 'next/font/google';
import Navbar from '../src/components/Navbar';
import Footer from '../src/components/Footer';
import { AuthProvider } from '../src/context/AuthContext';
import CacheWarmer from '../src/components/CacheWarmer';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-cinzel',
  display: 'swap',
});

// eslint-disable-next-line react/only-export-components
export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://untukesok.id'),
  title: 'Untuk Esok',
  description: 'Organisasi non-pemerintah yang dipimpin oleh mahasiswa dengan fokus pada pemberdayaan masyarakat lokal melalui pendidikan yang mudah diakses dan teknologi kolaboratif.',
  openGraph: {
    title: 'Untuk Esok',
    description: 'Fokus pada pemberdayaan masyarakat lokal melalui pendidikan yang mudah diakses dan teknologi kolaboratif.',
    url: 'https://untukesok.id',
    siteName: 'Untuk Esok',
    images: [
      {
        url: '/logo_UE.webp',
        width: 800,
        height: 800,
        alt: 'Logo Untuk Esok',
      },
    ],
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Untuk Esok',
    description: 'Pemberdayaan masyarakat lokal melalui pendidikan yang mudah diakses.',
    images: ['/logo_UE.webp'],
  },
  icons: {
    icon: '/logo_UE.webp',
    apple: '/logo_UE.webp',
  },
  other: {
    'google-adsense-account': 'ca-pub-3616844824692827',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${poppins.variable} ${cinzel.variable}`}>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3616844824692827"
          crossOrigin="anonymous"
        />
      </head>
      <body className={poppins.className}>
        <div className="app-container">
          <AuthProvider>
            <CacheWarmer />
            {children}
            <Footer />
            <Navbar />
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}


