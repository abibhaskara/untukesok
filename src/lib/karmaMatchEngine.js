/**
 * UNTUK ESOK — Karma Match Engine (AI Recommendation & NLP Semantic Match)
 * 
 * Menghitung tingkat kecocokan (Karma Match Score 0–100%) antara profil relawan/pencarian
 * dengan kegiatan sosial berbasis Hybrid Scoring:
 * 1. Sim_NLP: Pencocokan semantik intent pencarian (query) atau minat relawan terhadap judul, kategori, deskripsi, lokasi, dan tugas kegiatan.
 * 2. Sim_Category: Keselarasan kategori kegiatan dengan preferensi/riwayat relawan.
 * 3. PriceFit: Keselarasan antara nominal komitmen kegiatan dengan profil willingness-to-pay (commitmentFeePreference).
 * 4. UrgencyFit: Bobot keterisian kuota & batas waktu (membantu kegiatan yang masih membutuhkan relawan).
 */

// Stopwords umum bahasa Indonesia untuk efisiensi NLP
const INDO_STOPWORDS = new Set([
  'dan', 'atau', 'di', 'ke', 'dari', 'yang', 'untuk', 'pada', 'dengan', 'ini', 'itu',
  'saya', 'aku', 'kami', 'kita', 'ingin', 'bisa', 'suka', 'mau', 'ada', 'adalah',
  'oleh', 'saat', 'akan', 'juga', 'bisa', 'lebih', 'tentang', 'seperti', 'dalam'
]);

export function tokenizeAndClean(text = '') {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !INDO_STOPWORDS.has(w));
}

/**
 * Menghitung cosine/overlap semantic similarity antara 2 set kata
 */
export function calculateSemanticOverlap(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setB = new Set(tokensB);
  let matches = 0;
  tokensA.forEach(t => {
    if (setB.has(t)) matches++;
    else {
      // Fuzzy substring matching (misal: "ajar" cocok dgn "mengajar")
      for (const target of setB) {
        if (target.includes(t) || t.includes(target)) {
          matches += 0.8;
          break;
        }
      }
    }
  });
  return Math.min(1, matches / Math.sqrt(tokensA.length * tokensB.length));
}

/**
 * Menghitung Karma Match Score untuk 1 kegiatan
 * @param {Object} program - data kegiatan
 * @param {Object} context - { userProfile, searchQuery, userHistoryCategories }
 * @returns {Object} { score: number (0..100), reasons: string[], matchBadge: string }
 */
export function calculateKarmaMatch(program, context = {}) {
  const {
    userProfile = {},
    searchQuery = '',
    userHistoryCategories = []
  } = context;

  const reasons = [];

  // 1. Tokenisasi Dokumen Kegiatan
  const programDocText = [
    program.title || '',
    program.category || '',
    program.location || '',
    program.description || '',
    Array.isArray(program.tasks) ? program.tasks.join(' ') : (program.tasks || ''),
    Array.isArray(program.criteria) ? program.criteria.join(' ') : (program.criteria || '')
  ].join(' ');
  const programTokens = tokenizeAndClean(programDocText);

  // 2. Semantic NLP Query Match (jika ada input search bar)
  let nlpScore = 0;
  if (searchQuery.trim()) {
    const queryTokens = tokenizeAndClean(searchQuery);
    nlpScore = calculateSemanticOverlap(queryTokens, programTokens);
    if (nlpScore > 0.4) {
      reasons.push('Sangat cocok dengan kata kunci minatmu');
    }
  }

  // 3. User Interest & Category Alignment
  let categoryScore = 0.5; // baseline
  const userCatPref = userProfile.interestCategory || userProfile.preferredCategory || '';
  if (userCatPref && userCatPref !== 'Semua' && program.category) {
    if (userCatPref.toLowerCase() === program.category.toLowerCase()) {
      categoryScore = 1.0;
      reasons.push(`Sesuai minat bidang ${program.category}`);
    }
  } else if (userHistoryCategories.includes(program.category)) {
    categoryScore = 0.9;
    reasons.push(`Kategori favorit yang pernah kamu ikuti (${program.category})`);
  }

  // 4. Commitment Fee / WTP Fit (keselarasan daya dukung finansial)
  let priceFitScore = 0.8;
  const userFeePref = Number(userProfile.commitmentFeePreference ?? userProfile.feePreference ?? -1);
  const progFee = Number(program.price || program.commitmentFee || program.amount || 0);

  if (userFeePref >= 0) {
    if (progFee === 0) {
      priceFitScore = 1.0;
      reasons.push('Kegiatan terbuka tanpa komitmen biaya (Rp 0)');
    } else if (progFee <= userFeePref) {
      priceFitScore = 0.95;
      reasons.push(`Biaya komitmen Rp ${progFee.toLocaleString('id-ID')} masuk rentang pilihanmu`);
    } else {
      const diff = progFee - userFeePref;
      priceFitScore = Math.max(0.4, 1 - (diff / 150000));
    }
  }

  // 5. Urgency & Availability Fit (membantu kegiatan yang masih membutuhkan relawan aktif)
  const target = Number(program.volunteersTarget) || 20;
  const joined = Number(program.volunteersJoined) || 0;
  const fillRate = target > 0 ? joined / target : 0;
  let urgencyScore = 0.7;
  if (fillRate < 0.9 && fillRate >= 0.3) {
    urgencyScore = 0.95;
    reasons.push('Sisa kuota relawan sangat terbuka');
  } else if (fillRate >= 1.0) {
    urgencyScore = 0.5; // kuota sudah penuh
  }

  // Final Hybrid Formula
  let finalScore = 0;
  if (searchQuery.trim()) {
    // Mode pencarian aktif: bobot semantik query dominan
    finalScore = (nlpScore * 0.55) + (categoryScore * 0.20) + (priceFitScore * 0.15) + (urgencyScore * 0.10);
  } else {
    // Mode rekomendasi personal (browse/explore)
    finalScore = (categoryScore * 0.45) + (priceFitScore * 0.35) + (urgencyScore * 0.20);
  }

  // Normalisasi ke 65% - 99% agar tampak realistis bagi user
  const matchPct = Math.min(99, Math.max(65, Math.round(finalScore * 100)));

  return {
    score: matchPct,
    rawScore: finalScore,
    reasons: reasons.slice(0, 2),
    isTopMatch: matchPct >= 85
  };
}

