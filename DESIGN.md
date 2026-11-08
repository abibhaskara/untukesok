# UNTUK ESOK — Anti-AI-Slop Design System & Rulebook

> **Prinsip Utama:** Desain berbasis keputusan nyata, substansi fungsional, dan tipografi berwibawa — bukan rata-rata template generator AI.

---

## 1. Manifesto: Apa itu "AI Slop" dalam Desain?

Model AI generasi awal cenderung menghasilkan antarmuka rata-rata (*category average*):
- Teks judul 3 baris di tengah (*centered*) dengan label kecil di atasnya (*kicker*).
- Barisan kartu identik berisi ikon di dalam kotak berwarna-warni (*icon in a rounded colored square*).
- Emoji bertebaran sebagai pengganti poin teks atau ikon antarmuka.
- Gradien ungu/violet/neon menyala di setiap tombol dan latar belakang (*purple glow*).
- Layar dibatasi dalam satu kartu sempit melayang di tengah layar (*claustrophobic 680px card*).
- Kata-kata penuh jargon hampa: *"supercharge"*, *"seamless"*, *"elevate"*, *"all-in-one ecosystem"*.

**Design System Untuk Esok menolak seluruh kebiasaan tersebut.** Setiap piksel, warna, dan kata harus lahir dari fungsi dan kebutuhan nyata ekosistem kerelawanan di Bali.

---

## 2. 10 Aturan Mutlak Anti-Slop (The 10 Inviolable Rules)

### Aturan 1: Zero Decorative Emojis & Icon Clutter
- **DILARANG:** Memasang emoji (🛡️, ✓, ⬇, 📄, 🔗, ●, ⭐, 🚀) di tombol, judul, atau kartu data.
- **DILARANG:** Menaburkan ikon generik di setiap baris teks tanpa fungsi navigasi.
- **WAJIB:** Gunakan kata-kata yang jelas, presisi, dan lugas. Tipografi dan kontras warna yang baik tidak memerlukan emoji sebagai penopang.

### Aturan 2: Full-Screen Fluid Layouts (Bebaskan Ruang Layar)
- **DILARANG:** Menjebak seluruh pengalaman desktop ke dalam satu kartu kecil di tengah layar (`maxWidth: 680px`).
- **WAJIB:** Manfaatkan lebar layar desktop secara proporsional (`1200px` – `1440px` fluid):
  - Tata letak *edge-to-edge* yang bernapas lega.
  - Pisahkan area kerja menjadi kolom fungsional (*split-screen architecture*).

### Aturan 3: Asymmetrical Functional Split (Viewer + Dossier)
Saat menyajikan verifikasi, pratinjau dokumen, atau analitik, bagi layar secara logis:
- **Kolom Kiri (~60% lebar):** *Interactive Document / Canvas Viewer* (fokus visual utama, pratinjau sertifikat, dokumen asli).
- **Kolom Kanan (~40% lebar):** *Trust & Integrity Dossier* (kartu status validasi, data relawan, penandatangan, jejak audit kriptografis).

### Aturan 4: Disiplin Palet Warna (Maksimal 3 Warna Fungsional)
Gunakan palet warna yang membumi, berwibawa, dan merefleksikan identitas lokal Bali:
- **Deep Royal Navy (`#233B69` / `#0F172A`):** Warna otoritas utama, header dokumen, teks judul tebal.
- **Sacred Warm Gold (`#FFBD59` / `#D4AF37`):** Aksen kehormatan, border sertifikat, elemen berharga.
- **Emerald Green (`#059669` / `#065F46` / `#ECFDF5`):** Status terverifikasi, penyelesaian pendaftaran.
- **Surface Neutrals (`#FFFFFF`, `#F8FAFC`, `#E2E8F0`):** Latar belakang bersih tanpa tekstur berisik.
- **DILARANG KERAS:** Gradien ungu-neon (*AI purple*), efek glow kabur, atau kartu transparan *glassmorphism* berlebihan.

### Aturan 5: Hierarki Tipografi Tegas (Maksimal 4 Skala Jelas)
Jangan gunakan 9 ukuran font yang mirip (11px, 12px, 13px, 14px, 15px, 16px). Gunakan skala yang berjarak jauh:
1. **Display / Judul Sertifikat (22px – 28px):** `Cinzel` (Serif resmi) untuk dokumen dan sertifikat formal.
2. **Heading Seksi (16px – 20px Bold):** `Poppins` SemiBold / Bold untuk header halaman dan kartu.
3. **Body / Narasi (13px – 14px Regular):** `Poppins` untuk instruksi dan teks penjelasan.
4. **Data Monospace (10px – 12px Mono):** `Courier New` / `monospace` untuk Nomor Registrasi, ID Kredensial, dan Hash Kriptografis SHA-256.

### Aturan 6: Bahasa Lugas, Ringkas & Manusiawi (Zero Buzzwords)
- **KATA-KATA TERLARANG:** *Supercharge, unlock, seamless, elevate, revolutionary, next-gen, holistic, effortless, all-in-one ecosystem*.
- **GUNAKAN:** Kata kerja aktif dan fakta konkret:
  - *Buruk:* "Nikmati pengalaman sertifikasi relawan revolusioner yang seamless."
  - *Baik:* "Verifikasi Sertifikat. Dokumen terdaftar dan sah dalam basis data Untuk Esok."
  - *Buruk:* "Dampak sosial masif tak terhingga."
  - *Baik:* "Total 16 Jam Aksi Nyata di Pesisir Sanur."

### Aturan 7: Shell Kontekstual — Footer Hidup di Publik, Mati di Admin
- **Halaman Publik (`/`, `/kegiatan`, `/berita`, `/verify`):**
  - **Footer WAJIB AKTIF:** Berfungsi sebagai jangkar visual, transparansi legalitas organisasi, navigasi cadangan, dan kontak resmi.
- **Halaman Operasional Admin (`/admin/*`):**
  - **Footer WAJIB DINONAKTIFKAN (`return null`):** Admin adalah ruang kerja data (*workspace*); footer hanya akan membuang ruang vertikal yang dibutuhkan tabel dan formulir.

### Aturan 8: Data Dossier Menggantikan "Card Cosplay"
- **DILARANG:** Membuat 10 kartu kecil melayang yang masing-masing hanya berisi satu kalimat dan bayangan tebal (*heavy shadow*).
- **WAJIB:** Susun data dalam bentuk **Dossier / Key-Value Rows**:
  - Kolom kiri: Label abu-abu (`#64748B`, semi-bold).
  - Kolom kanan: Nilai teks gelap (`#0F172A`, bold/monospace).
  - Garis pemisah halus atau jeda vertikal 12px.

### Aturan 9: Bukti Kredibilitas Nyata (Cryptographic Trust Markers)
Daripada animasi dot hijau berdenyut (*pulsing dot*) palsu, sajikan bukti teknis otentik:
- Timestamp lengkap beserta zona waktu resmi: `09 November 2026, 16:40:45 WITA`.
- Cuplikan Hash Integritas SHA-256: `sha256:7f83b165...126d9069`.
- Nama dan jabatan jelas dua penandatangan (*Project Leader & Manager Mitra*).

### Aturan 10: Efisiensi Piksel & Zero Storage Cost
- Bangun aset visual berat (seperti e-sertifikat beresolusi cetak 2000×1414) secara langsung di GPU browser pengguna menggunakan **HTML5 Canvas**, bukan mengunggah ribuan file gambar statis ke server cloud.

---

## 3. Style Dictionary & Design Tokens

### Token Warna
```css
:root {
  /* Brand Core */
  --color-brand-navy:      #233B69;
  --color-brand-navy-dark: #1B2E53;
  --color-brand-gold:      #FFBD59;
  --color-brand-gold-dark: #D4AF37;

  /* Neutrals */
  --color-bg-canvas:       #F8FAFC;
  --color-bg-surface:      #FFFFFF;
  --color-border-subtle:   #E2E8F0;
  --color-border-strong:   #CBD5E1;
  --color-text-title:      #0F172A;
  --color-text-body:       #334155;
  --color-text-muted:      #64748B;

  /* Semantics */
  --color-status-success:  #065F46;
  --color-status-bg:       #ECFDF5;
  --color-status-border:   #A7F3D0;
}
```

### Token Radius
- `8px`: Kontrol input, tombol sekunder kecil.
- `10px – 14px`: Tombol aksi utama, kartu dossier internal.
- `16px – 20px`: Container pratinjau dokumen / canvas box.
- `9999px`: Badge status (*pill*).

---

## 4. Pola Implementasi (Implementation Patterns)

### A. Pola Kontrol Footer Kontekstual
```jsx
// src/components/Footer.jsx
'use client';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();

  // Deaktifkan footer pada rute admin
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="ue-site-footer">
      {/* Konten Footer Publik */}
    </footer>
  );
}
```

### B. Pola Baris Data Dossier (Key-Value Row)
```jsx
<div className="verify-card-section">
  <div className="verify-section-heading">Informasi Penerima</div>
  <div className="verify-info-row">
    <span className="verify-info-label">Nama Lengkap</span>
    <span className="verify-info-val">Kadek Agus Pratama</span>
  </div>
  <div className="verify-info-row">
    <span className="verify-info-label">ID Kredensial</span>
    <span className="verify-info-mono">UE-2026-X89J21</span>
  </div>
</div>
```

---

## 5. Checklist Verifikasi Sebelum Rilis (Anti-Slop Quality Gate)

Sebelum fitur atau halaman baru dianggap selesai, periksa daftar ini:
- [ ] Apakah ada emoji dekoratif atau ikon tidak fungsional? *(Wajib dihilangkan)*
- [ ] Apakah ada gradien ungu neon atau kartu glassmorphism blur? *(Ganti dengan warna solid & kontras bersih)*
- [ ] Apakah halaman desktop terjebak dalam kotak kecil 680px? *(Ubah jadi full-screen fluid)*
- [ ] Apakah tombol aksi menggunakan kata kerja jelas dan bukan frasa marketing? *(Gunakan "Unduh Sertifikat (PNG)", bukan "Dapatkan Akses Ajaib")*
- [ ] Apakah footer tampil di publik dan mati di admin? *(Cek kondisi rute)*
- [ ] Apakah angka, ID, dan kode transaksi menggunakan font monospace yang rapi?
- [ ] Apakah desain telah diuji pada layar desktop 1440px dan mobile 375px?

---
*Dokumen ini merupakan standar resmi desain antarmuka ekosistem UNTUK ESOK.*
