/**
 * UNTUK ESOK — Gemini AI Analytics Prompt & Synthesis Builder
 * Digunakan oleh client-side Firebase AI Logic (gemini-2.5-flash) dan server-side /api/ai/impact-report.
 */

export function buildQualityAnalyticsPrompt({ periodLabel, metrics, feedbacks }) {
  const topCategoriesText = (metrics.categoryList || [])
    .map(c => `${c.name}: ${c.programsCount} kegiatan, ${c.totalReg} relawan (${c.fillRate}% keterisian)`)
    .join(' | ') || 'Belum ada rincian kategori';

  const topProgramsText = (metrics.topPrograms || [])
    .map((p, idx) => `${idx + 1}. ${p.title} [${p.category}] — ${p.registered}/${p.quota} relawan (${p.fillRate}%)`)
    .join('\n') || '- Belum ada data kegiatan';

  const topInstitutionsText = (metrics.topInstitutions || [])
    .map(([inst, count]) => `${inst} (${count} orang)`)
    .join(', ') || 'Belum terdata';

  const feedbackSamplesText = (feedbacks || [])
    .slice(0, 20)
    .map((f, i) => `${i + 1}. [${f.rating || 5}★ | ${f.programTitle || 'Kegiatan'}] Kesan: "${f.kesan || '-'}" | Pesan/Saran: "${f.pesan || '-'}"`)
    .join('\n') || '- Belum ada ulasan tertulis pada periode ini.';

  return `Anda adalah Lead Social Impact Strategist & Senior Data Analyst untuk "UNTUK ESOK", platform gerakan kepemudaan dan kerelawanan sosial di Indonesia.
Tugas Anda adalah menyusun Laporan Analitik & Ringkasan Eksekutif (Executive Summary) tingkat manajemen yang tajam, berbasis bukti kuantitatif, bebas klise, dan langsung dapat dieksekusi (actionable).

CAKUPAN PERIODE ANALISIS: ${periodLabel || 'Semua Waktu'}

1. INDIKATOR UTAMA & DEMOGRAFI RELAWAN:
- Total Akun Terdaftar: ${metrics.totalUsers || 0} akun
- Relawan Aktif Terjun Lapangan: ${metrics.activeVolunteersCount || 0} orang (${metrics.totalUsers > 0 ? Math.round(((metrics.activeVolunteersCount || 0) / metrics.totalUsers) * 100) : 0}% dari total akun)
- Akun Belum Aktif (Dormant): ${metrics.inactiveUserCount || 0} akun
- Komposisi Gender: Laki-laki ${metrics.maleCount || 0} (${metrics.malePct || 0}%), Perempuan ${metrics.femaleCount || 0} (${metrics.femalePct || 0}%)
- Kelengkapan Profil: ${metrics.dataCompletenessPct || 0}% lengkap | Cakupan WhatsApp Aktif: ${metrics.phoneCoveragePct || 0}%
- Top Asal Instansi / Kampus: ${topInstitutionsText}

2. PIRAMIDA PARTISIPASI & RETENSI:
- Tingkat Retensi Berulang (≥2 Kegiatan): ${metrics.repeatRate || 0}%
- Rata-rata Partisipasi: ${metrics.avgActivitiesPerVolunteer || '0.0'} kegiatan per relawan aktif
- Tier 1 Champion (≥5 Kegiatan): ${metrics.championCount || 0} orang
- Tier 2 Aktif (2–4 Kegiatan): ${metrics.enthusiastCount || 0} orang
- Tier 3 Baru (1 Kegiatan): ${metrics.firstTimerCount || 0} orang

3. UTILISASI KUOTA & PERFORMA KATEGORI KEGIATAN:
- Rata-rata Keterisian Kuota: ${metrics.avgFillRate || 0}% (${metrics.totalRegisteredInPrograms || 0} terisi dari ${metrics.totalTargetQuota || 0} total kuota)
- Performa per Kategori: ${topCategoriesText}
- Top 5 Kegiatan Berdasarkan Keterisian:
${topProgramsText}

4. ANALISIS PREFERENSI COMMITMENT FEE (WILLINGNESS TO PAY / WTP):
- Total Respon Preferensi Terdata: ${metrics.feeRecordedCount || 0} relawan
- Rata-rata (Mean): Rp ${Number(metrics.avgFee || 0).toLocaleString('id-ID')}
- Nilai Tengah (Median): Rp ${Number(metrics.medianFee || 0).toLocaleString('id-ID')}
- Nilai Terbanyak (Modus): Rp ${Number(metrics.modeFee || 0).toLocaleString('id-ID')}
- Kesediaan Membayar (WTP > Rp 0): ${metrics.wtpRate || 0}% (${metrics.paidFeeCount || 0} relawan berbayar vs ${metrics.freeFeeCount || 0} memilih Rp 0)
- Sebaran Tier Biaya Komitmen:
  • Rp 0 (Gratis): ${metrics.freeFeeCount || 0} orang
  • Rp 10K–30K: ${metrics.tier10to30Count || 0} orang
  • Rp 40K–70K: ${metrics.tier40to70Count || 0} orang
  • Rp 80K–100K: ${metrics.tier80to100Count || 0} orang
  • Rp 110K–150K: ${metrics.tier110to150Count || 0} orang

5. KEPUASAN (CSAT) & KREDENSIAL SERTIFIKAT:
- Indeks Skor Kepuasan (CSAT): ${metrics.avgCSAT || '5.0'} / 5.0 (dari ${metrics.reviewCount || 0} ulasan masuk, tingkat respon ulasan ${metrics.feedbackResponseRate || 0}%)
- Sertifikat Diterbitkan: ${metrics.certificatesIssued || 0} e-sertifikat (${metrics.certIssueRate || 0}% dari partisipasi aktif)

6. SAMPEL SUARA & REFLEKSI RELAWAN (KESAN & PESAN):
${feedbackSamplesText}

INSTRUKSI ANALISIS KHUSUS:
1. Lakukan sintesis silang antar-metrik (contoh: bandingkan tingginya keterisian kuota ${metrics.avgFillRate || 0}% dan skor CSAT ${metrics.avgCSAT || '5.0'}/5.0 dengan tingkat retensi ${metrics.repeatRate || 0}% serta konversi akun pasif).
2. Bedah anomali atau peluang dari selisih Mean (Rp ${Number(metrics.avgFee || 0).toLocaleString('id-ID')}), Median (Rp ${Number(metrics.medianFee || 0).toLocaleString('id-ID')}), dan Modus (Rp ${Number(metrics.modeFee || 0).toLocaleString('id-ID')}) pada Commitment Fee untuk merumuskan rekomendasi skema subsidi silang atau tier kontribusi yang realistis bagi relawan pelajar/mahasiswa.
3. Ekstrak pola sentimen, apresiasi, maupun saran perbaikan nyata dari kutipan kesan/pesan relawan.
4. Gunakan Bahasa Indonesia eksekutif yang lugas, padat, bernas, dan wajib menyertakan angka spesifik dari data di atas.

FORMAT OUTPUT WAJIB:
Kembalikan HANYA JSON valid (tanpa markdown \`\`\`json) dengan struktur persis berikut:
{
  "headline": "Judul utama laporan yang merangkum pencapaian terkuat & fokus strategis saat ini (maks 14 kata)",
  "executiveSummary": "Ringkasan eksekutif 3-4 kalimat yang mengintegrasikan performa mobilisasi relawan, utilisasi kuota kegiatan, kepuasan (CSAT), dan temuan kunci kesediaan kontribusi (Commitment Fee).",
  "keyMetricsInsight": {
    "volunteerAndRetention": "Analisis mendalam 2-3 kalimat terkait rasio relawan aktif vs akun pasif, distribusi piramida partisipasi (Baru vs Aktif vs Champion), dan strategi menaikkan retensi.",
    "commitmentFeeAndPricing": "Analisis 2-3 kalimat yang membedah distribusi WTP (${metrics.wtpRate || 0}%), perbandingan Mean/Median/Modus, serta titik harga (sweet spot) kontribusi yang paling sehat untuk keberlanjutan kegiatan.",
    "programAndQuota": "Analisis 2-3 kalimat mengenai daya tarik kategori kegiatan, efektivitas penyerapan kuota (${metrics.avgFillRate || 0}%), dan optimalisasi kapasitas batch berikutnya."
  },
  "impactHighlights": [
    "Sorotan kuantitatif 1 (keterisian kegiatan & mobilisasi relawan aktif)",
    "Sorotan kuantitatif 2 (retensi & piramida partisipasi relawan)",
    "Sorotan kuantitatif 3 (temuan kesediaan bayar / WTP & titik tengah commitment fee)",
    "Sorotan kuantitatif 4 (kualitas pengalaman lapangan CSAT & penerbitan sertifikat)"
  ],
  "sentimentAnalysis": "Sintesis 3 kalimat mengenai benang merah kesan, motivasi emosional, serta saran konstruktif yang paling menonjol dari ulasan tertulis relawan.",
  "strategicRecommendations": [
    "Rekomendasi konkret 1 untuk aktivasi akun belum aktif & peningkatan retensi Tier 3 (Baru) ke Tier 2 (Aktif)",
    "Rekomendasi konkret 2 untuk kebijakan tier Commitment Fee / skema subsidi silang berdasarkan data WTP",
    "Rekomendasi konkret 3 untuk ekspansi kategori kegiatan dengan permintaan tertinggi & kelengkapan data profil/WA",
    "Rekomendasi konkret 4 untuk peningkatan konversi pengisian ulasan pasca-kegiatan & distribusi sertifikat"
  ],
  "partnerPitch": "Narasi siap pakai (3-4 kalimat persuasif & kredibel) untuk diajukan kepada calon mitra CSR, sponsor, atau institusi pendidikan dengan menonjolkan rekam jejak terukur UNTUK ESOK."
}`;
}

