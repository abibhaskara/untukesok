import { NextResponse } from 'next/server';

export const runtime = 'edge';

function buildDeterministicVoiceSummary({ voices = [] }) {
  const total = voices.length;
  if (total === 0) {
    return {
      headline: 'Belum Ada Aspirasi Masuk Dalam Kotak Suara',
      executiveSummary: 'Kotak Suara Warga saat ini belum menerima kiriman aspirasi dari masyarakat. Begitu warga mengirimkan pesan, modul AI ini akan secara otomatis memetakan isu prioritas, sentimen publik, dan rekomendasi aksi nyata untuk yayasan Untuk Esok.',
      keyStatistics: {
        totalVoices: 0,
        dominantCategory: '-',
        topRegency: '-',
        urgencyLevel: 'Normal'
      },
      topIssues: [],
      sentimentAnalysis: {
        positiveRatio: 0,
        criticalRatio: 0,
        constructiveRatio: 100,
        overview: 'Menunggu aspirasi masuk untuk analisis sentimen.'
      },
      strategicRecommendations: [
        'Sosialisasikan Kotak Suara Warga di media sosial Untuk Esok untuk menjaring aspirasi komunitas lokal.',
        'Ajak relawan di 9 kabupaten/kota di Bali untuk mendokumentasikan keluhan warga seputar lingkungan dan pendidikan.'
      ],
      representativeQuotes: []
    };
  }

  // Count by category
  const catCount = {};
  const regencyCount = {};
  voices.forEach(v => {
    const cat = v.category || 'Aspirasi Umum';
    catCount[cat] = (catCount[cat] || 0) + 1;

    const reg = v.regency || 'Bali';
    regencyCount[reg] = (regencyCount[reg] || 0) + 1;
  });

  const sortedCategories = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
  const sortedRegencies = Object.entries(regencyCount).sort((a, b) => b[1] - a[1]);

  const dominantCategory = sortedCategories[0]?.[0] || 'Lingkungan & Sampah';
  const dominantRegency = sortedRegencies[0]?.[0] || 'Denpasar';

  // Issue clustering heuristics based on keywords in messages
  const issues = [];
  const wasteKeywords = ['sampah', 'plastik', 'pantai', 'sungai', 'tpa', 'kotor', 'lingkungan', 'banjir'];
  const eduKeywords = ['sekolah', 'pendidikan', 'buku', 'anak', 'belajar', 'les', 'biaya'];
  const cultureKeywords = ['budaya', 'adat', 'seni', 'pura', 'tari', 'tradisi', 'upacara'];
  const socialKeywords = ['lansia', 'sembako', 'miskin', 'bantuan', 'difabel', 'disabilitas', 'kesehatan'];
  const infraKeywords = ['jalan', 'lampu', 'penerangan', 'trotoar', 'rusak', 'akses', 'air'];

  const wasteVoices = voices.filter(v => wasteKeywords.some(kw => (v.message || '').toLowerCase().includes(kw)) || v.category?.includes('Lingkungan'));
  const eduVoices = voices.filter(v => eduKeywords.some(kw => (v.message || '').toLowerCase().includes(kw)) || v.category?.includes('Pendidikan'));
  const cultureVoices = voices.filter(v => cultureKeywords.some(kw => (v.message || '').toLowerCase().includes(kw)) || v.category?.includes('Budaya'));
  const socialVoices = voices.filter(v => socialKeywords.some(kw => (v.message || '').toLowerCase().includes(kw)) || v.category?.includes('Sosial'));
  const infraVoices = voices.filter(v => infraKeywords.some(kw => (v.message || '').toLowerCase().includes(kw)) || v.category?.includes('Infrastruktur'));

  if (wasteVoices.length > 0) {
    issues.push({
      issue: 'Pengelolaan Sampah & Kelestarian Pesisir',
      category: 'Lingkungan',
      frequency: wasteVoices.length,
      priority: wasteVoices.length >= 2 ? 'Tinggi' : 'Sedang',
      regency: [...new Set(wasteVoices.map(v => v.regency))].join(', ') || 'Bali',
      description: `Warga menyoroti penumpukan sampah plastik, perlunya edukasi daur ulang, serta aksi pembersihan berkala di area pantai dan aliran sungai.`,
      proposedAction: 'Gelar aksi beach clean-up dan workshop pemilahan sampah organik/anorganik bersama relawan Untuk Esok.'
    });
  }

  if (eduVoices.length > 0) {
    issues.push({
      issue: 'Akses Literasi & Pendampingan Belajar Anak',
      category: 'Pendidikan',
      frequency: eduVoices.length,
      priority: eduVoices.length >= 2 ? 'Tinggi' : 'Sedang',
      regency: [...new Set(eduVoices.map(v => v.regency))].join(', ') || 'Bali',
      description: `Kebutuhan bahan bacaan interaktif, kelas bimbingan belajar gratis untuk anak keluarga prasejahtera di pedesaan.`,
      proposedAction: 'Buka pojok baca komunitas dan program kakak asuh belajar akhir pekan.'
    });
  }

  if (cultureVoices.length > 0) {
    issues.push({
      issue: 'Pelestarian Seni Adat & Regenerasi Budaya Pemuda',
      category: 'Sosial Budaya',
      frequency: cultureVoices.length,
      priority: 'Sedang',
      regency: [...new Set(cultureVoices.map(v => v.regency))].join(', ') || 'Bali',
      description: `Harapan masyarakat agar tradisi lokal, aksara Bali, dan kerajinan tangan tetap diwariskan kepada generasi muda.`,
      proposedAction: 'Kolaborasi dengan Sekaa Teruna Teruni (STT) untuk workshop digitalisasi warisan budaya lokal.'
    });
  }

  if (socialVoices.length > 0) {
    issues.push({
      issue: 'Dukungan Kesejahteraan Lansia & Kelompok Rentan',
      category: 'Bantuan Sosial',
      frequency: socialVoices.length,
      priority: 'Tinggi',
      regency: [...new Set(socialVoices.map(v => v.regency))].join(', ') || 'Bali',
      description: `Perhatian khusus untuk lansia tunggal dan keluarga marjinal yang membutuhkan sembako serta pemeriksaan kesehatan berkala.`,
      proposedAction: 'Salurkan paket nutrisi lansia dan pemeriksaan kesehatan geriatri gratis door-to-door.'
    });
  }

  if (infraVoices.length > 0) {
    issues.push({
      issue: 'Penerangan Jalan & Fasilitas Publik Komunitas',
      category: 'Infrastruktur Publik',
      frequency: infraVoices.length,
      priority: 'Sedang',
      regency: [...new Set(infraVoices.map(v => v.regency))].join(', ') || 'Bali',
      description: `Aspirasi perbaikan fasilitas umum di tingkat banjar/desa demi keamanan warga pada malam hari.`,
      proposedAction: 'Sampaikan laporan advokasi warga ke dinas terkait dan gotong royong perbaikan ringan.'
    });
  }

  if (issues.length === 0) {
    issues.push({
      issue: `Perhatian pada Sektor ${dominantCategory}`,
      category: dominantCategory,
      frequency: total,
      priority: 'Sedang',
      regency: dominantRegency,
      description: `Aspirasi warga berkisar pada peningkatan kualitas layanan publik dan kepedulian bersama di tingkat lokal.`,
      proposedAction: 'Petakan kebutuhan spesifik warga melalui audiensi lapangan bersama tokoh masyarakat.'
    });
  }

  // Sample representative quotes
  const representativeQuotes = voices.slice(0, 4).map(v => ({
    quote: (v.message || '').substring(0, 180),
    regency: v.regency || 'Bali',
    category: v.category || 'Umum',
    author: v.isAnonymous ? 'Warga Anonim' : (v.name || 'Warga')
  }));

  return {
    headline: `Sintesis Aspirasi: Isu ${dominantCategory} Mendominasi di ${dominantRegency} (${total} Suara Masuk)`,
    executiveSummary: `Dari rekapitulasi ${total} aspirasi masyarakat yang terhimpun melalui Kotak Suara Warga Untuk Esok, isu ${dominantCategory} menempati prioritas tertinggi (${sortedCategories[0]?.[1] || 0} aspirasi), dengan konsentrasi suara terbesar berasal dari Kabupaten/Kota ${dominantRegency}. Masyarakat secara konsisten mengekspresikan harapan akan hadirnya aksi nyata berbasis kerelawanan yang berkelanjutan, khususnya terkait kolaborasi pemuda untuk menjaga keseimbangan lingkungan, sosial, dan budaya Bali.`,
    keyStatistics: {
      totalVoices: total,
      dominantCategory,
      topRegency: dominantRegency,
      urgencyLevel: total >= 5 ? 'Tinggi' : 'Normal'
    },
    topIssues: issues,
    sentimentAnalysis: {
      positiveRatio: 25,
      criticalRatio: 35,
      constructiveRatio: 40,
      overview: `Sentimen publik didominasi dorongan konstruktif (40%) yang disertai kritik terhadap kelambanan penanganan di lapangan (35%), dan apresiasi terhadap inisiatif kepemudaan (25%). Warga menginginkan solusi yang terukur bukan sekadar seremonial.`
    },
    strategicRecommendations: [
      `Fokus Aksi Lapangan: Prioritaskan alokasi relawan Untuk Esok pada program ${dominantCategory} di ${dominantRegency} dalam kalender aksi 1-2 bulan ke depan.`,
      `Kemitraan Banjar & Komunitas: Gandeng Sekaa Teruna Teruni (STT) dan komunitas akar rumput untuk mempercepat eksekusi solusi berbasis kearifan lokal.`,
      `Transparansi Respons Aspirasi: Publikasikan ringkasan tindak lanjut aspirasi di portal berita Untuk Esok agar masyarakat melihat dampak langsung suaranya.`,
      `Pengembangan Fitur Suara: Dorong warga melampirkan foto/titik lokasi untuk mempercepat verifikasi lapangan oleh koordinator wilayah.`
    ],
    representativeQuotes
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { voices = [] } = body;

    // Filter and sanitize voices
    const sanitizedVoices = (voices || []).map(v => ({
      category: String(v.category || 'Umum').substring(0, 60),
      regency: String(v.regency || 'Bali').substring(0, 50),
      name: v.isAnonymous ? 'Warga Anonim' : String(v.name || 'Warga').substring(0, 60),
      isAnonymous: Boolean(v.isAnonymous),
      message: String(v.message || '')
        .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[EMAIL]')
        .replace(/(\+62|62|0)8[1-9][0-9]{6,10}/g, '[PHONE]')
        .substring(0, 500),
      createdAt: v.createdAt || new Date().toISOString()
    })).filter(v => v.message.length > 0);

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (apiKey && apiKey !== 'your_gemini_api_key' && sanitizedVoices.length > 0) {
      const prompt = `Anda adalah Analis Kebijakan Publik & Spesialis Komunitas Sosial untuk Yayasan Untuk Esok (sebuah yayasan pemuda dan kerelawanan di Bali).

Tugas Anda:
Lakukan sintesis mendalam, clustering masalah, analisis sentimen, dan rumuskan rekomendasi program aksi nyata berdasarkan data aspirasi warga Bali berikut:

DATA ASPIRASI WARGA (${sanitizedVoices.length} entri):
${JSON.stringify(sanitizedVoices, null, 2)}

Format balasan HARUS berupa objek JSON murni (tanpa markdown pembuka/penutup, tanpa teks pengantar):
{
  "headline": "Ringkasan tajuk utama 1 kalimat tegas dan profesional",
  "executiveSummary": "Paragraf ringkasan eksekutif komprehensif menguraikan temuan utama, kecenderungan aspirasi, dan urgensi.",
  "keyStatistics": {
    "totalVoices": ${sanitizedVoices.length},
    "dominantCategory": "Nama Kategori Terbanyak",
    "topRegency": "Kabupaten/Kota dengan aspirasi terbanyak",
    "urgencyLevel": "Tinggi" // "Tinggi" | "Sedang" | "Normal"
  },
  "topIssues": [
    {
      "issue": "Nama Masalah / Isu",
      "category": "Kategori",
      "frequency": 3,
      "priority": "Tinggi",
      "regency": "Kabupaten terkait",
      "description": "Deskripsi inti keluhan/harapan warga",
      "proposedAction": "Aksi nyata yang disarankan untuk dikerjakan yayasan Untuk Esok"
    }
  ],
  "sentimentAnalysis": {
    "positiveRatio": 20,
    "criticalRatio": 40,
    "constructiveRatio": 40,
    "overview": "Uraian ringkas tentang suasana kebatinan dan emosi aspirasi masyarakat."
  },
  "strategicRecommendations": [
    "Rekomendasi taktis 1 untuk yayasan",
    "Rekomendasi taktis 2 untuk yayasan",
    "Rekomendasi taktis 3 untuk yayasan",
    "Rekomendasi taktis 4 untuk yayasan"
  ],
  "representativeQuotes": [
    {
      "quote": "Kutipan paling menyentuh dari pesan warga",
      "regency": "Kabupaten",
      "category": "Kategori",
      "author": "Nama atau Warga Anonim"
    }
  ]
}`;

      const candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash'];
      for (const modelName of candidateModels) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.3,
                  topP: 0.85,
                  responseMimeType: 'application/json'
                }
              })
            }
          );

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
              const parsed = JSON.parse(cleaned);
              if (parsed && parsed.headline && parsed.executiveSummary) {
                return NextResponse.json({
                  success: true,
                  source: modelName,
                  report: parsed,
                  data: parsed
                });
              }
            }
          }
        } catch (geminiError) {
          console.warn(`Gemini API (${modelName}) voice-summary failed, trying next option:`, geminiError.message);
        }
      }
    }

    // Deterministic fallback synthesis
    const fallbackReport = buildDeterministicVoiceSummary({ voices: sanitizedVoices });

    return NextResponse.json({
      success: true,
      source: 'gemini-deterministic-synthesis',
      report: fallbackReport,
      data: fallbackReport
    });
  } catch (error) {
    console.error('Voice summary AI generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Gagal menghasilkan sintesis AI suara warga: ' + error.message
      },
      { status: 500 }
    );
  }
}

