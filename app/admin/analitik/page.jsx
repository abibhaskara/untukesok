'use client';

import { useState, useMemo } from 'react';
import {
  FiFileText, FiCopy, FiX, FiCheck,
  FiUsers, FiRepeat, FiBarChart2, FiStar, FiUserCheck
} from 'react-icons/fi';
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai';
import { app } from '../../../src/lib/firebase';
import { useAdminData } from '../../../src/context/AdminDataContext';
import AdminSearchFilterBar from '../../../src/components/AdminSearchFilterBar';
import { buildQualityAnalyticsPrompt } from '../../../src/lib/aiAnalyticsPrompt';

export default function AdminAnalyticsPage() {
  const { users, programs, applications, isLoading } = useAdminData();
  const [timeFilter, setTimeFilter] = useState('all'); // 'all', 'year', 'month'
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiReportModal, setAiReportModal] = useState(null);
  const [copiedAi, setCopiedAi] = useState(false);

  // Filter dataset based on time range
  const filteredData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const isWithinTime = (dateStr) => {
      if (!dateStr || timeFilter === 'all') return true;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      if (timeFilter === 'year') {
        return d.getFullYear() === currentYear;
      }
      if (timeFilter === 'month') {
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }
      return true;
    };

    const filteredApps = applications.filter(a => isWithinTime(a.appliedAt || a.createdAt));
    const activeApps = filteredApps.filter(a => a.status !== 'Dibatalkan' && a.status !== 'Dikeluarkan');

    return {
      apps: filteredApps,
      activeApps,
      totalUsers: users.length,
      programs
    };
  }, [applications, users, programs, timeFilter]);

  // Analytics Computations
  const analytics = useMemo(() => {
    const { activeApps, programs } = filteredData;

    // 1. Demografi & Gender
    let maleCount = 0;
    let femaleCount = 0;
    let unassignedGender = 0;
    let completeProfileCount = 0;
    let validPhoneCount = 0;

    const institutionMap = {};

    users.forEach(u => {
      const g = (u.gender || '').toLowerCase();
      if (g === 'laki-laki' || g === 'male' || g === 'pria') {
        maleCount++;
      } else if (g === 'perempuan' || g === 'female' || g === 'wanita') {
        femaleCount++;
      } else {
        unassignedGender++;
      }

      const hasName = Boolean(u.name && u.name.trim().length > 0);
      const hasNickname = Boolean(u.nickname && u.nickname.trim().length > 0);
      const hasPhone = Boolean(u.phone && u.phone.trim().length >= 7);
      const hasGender = Boolean(u.gender);
      const hasBirthYear = Boolean(u.birthYear || u.birth_year);

      if (hasPhone) validPhoneCount++;
      if (hasName && hasNickname && hasPhone && hasGender && hasBirthYear) {
        completeProfileCount++;
      }

      if (u.institution && u.institution.trim().length > 0) {
        const inst = u.institution.trim();
        institutionMap[inst] = (institutionMap[inst] || 0) + 1;
      }
    });

    // 2. Analisis Preferensi Commitment Fee
    const feeValues = [];
    const feeStepMap = {}; // 0K, 10K, 20K, ... 150K
    for (let i = 0; i <= 150000; i += 10000) {
      feeStepMap[i] = 0;
    }

    let freeFeeCount = 0;
    let paidFeeCount = 0;
    let tier10to30Count = 0; // 10k - 30k
    let tier40to70Count = 0; // 40k - 70k
    let tier80to100Count = 0; // 80k - 100k
    let tier110to150Count = 0; // 110k - 150k

    users.forEach(u => {
      if (u.commitmentFeePreference !== undefined || u.feePreference !== undefined) {
        const rawVal = Number(u.commitmentFeePreference ?? u.feePreference ?? 0);
        const val = Math.min(150000, Math.max(0, rawVal));
        feeValues.push(val);

        const roundedStep = Math.round(val / 10000) * 10000;
        if (feeStepMap[roundedStep] !== undefined) {
          feeStepMap[roundedStep]++;
        }

        if (val === 0) {
          freeFeeCount++;
        } else {
          paidFeeCount++;
          if (val <= 30000) tier10to30Count++;
          else if (val <= 70000) tier40to70Count++;
          else if (val <= 100000) tier80to100Count++;
          else tier110to150Count++;
        }
      }
    });

    const feeRecordedCount = feeValues.length;
    let avgFee = 0;
    let medianFee = 0;
    let modeFee = 0;

    if (feeRecordedCount > 0) {
      feeValues.sort((a, b) => a - b);
      const totalSum = feeValues.reduce((acc, curr) => acc + curr, 0);
      avgFee = Math.round(totalSum / feeRecordedCount);

      const mid = Math.floor(feeRecordedCount / 2);
      medianFee = feeRecordedCount % 2 !== 0
        ? feeValues[mid]
        : Math.round((feeValues[mid - 1] + feeValues[mid]) / 2);

      let maxFreq = 0;
      Object.entries(feeStepMap).forEach(([step, freq]) => {
        if (freq > maxFreq) {
          maxFreq = freq;
          modeFee = Number(step);
        }
      });
    }

    const wtpRate = feeRecordedCount > 0 ? Math.round((paidFeeCount / feeRecordedCount) * 100) : 0;
    const freeRate = feeRecordedCount > 0 ? Math.round((freeFeeCount / feeRecordedCount) * 100) : 0;

    // Highest frequency for histogram normalization
    let maxStepFreq = 1;
    Object.values(feeStepMap).forEach(freq => {
      if (freq > maxStepFreq) maxStepFreq = freq;
    });

    const totalUsersCount = users.length || 1;
    const specifiedGenderTotal = maleCount + femaleCount || 1;
    const malePct = Math.round((maleCount / specifiedGenderTotal) * 100);
    const femalePct = Math.round((femaleCount / specifiedGenderTotal) * 100);
    const dataCompletenessPct = Math.round((completeProfileCount / totalUsersCount) * 100);
    const phoneCoveragePct = Math.round((validPhoneCount / totalUsersCount) * 100);

    const topInstitutions = Object.entries(institutionMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 3. Retention & Cohorts
    const userAppCountMap = {};
    activeApps.forEach(a => {
      if (a.userId) {
        userAppCountMap[a.userId] = (userAppCountMap[a.userId] || 0) + 1;
      }
    });

    let championCount = 0;
    let enthusiastCount = 0;
    let firstTimerCount = 0;
    let inactiveUserCount = 0;

    users.forEach(u => {
      const count = userAppCountMap[u.id] || 0;
      if (count >= 5) championCount++;
      else if (count >= 2) enthusiastCount++;
      else if (count === 1) firstTimerCount++;
      else inactiveUserCount++;
    });

    const activeVolunteersCount = championCount + enthusiastCount + firstTimerCount;
    const repeatVolunteersCount = championCount + enthusiastCount;
    const repeatRate = activeVolunteersCount > 0
      ? Math.round((repeatVolunteersCount / activeVolunteersCount) * 100)
      : 0;
    const avgActivitiesPerVolunteer = activeVolunteersCount > 0
      ? (activeApps.length / activeVolunteersCount).toFixed(1)
      : '0.0';

    let totalTargetQuota = 0;
    let totalRegisteredInPrograms = 0;
    let totalBeneficiaries = 0;
    const categoryStats = {};

    programs.forEach(p => {
      const quota = Number(p.volunteersTarget) || Number(p.quota) || Number(p.targetRelawan) || 20;
      const registered = Number(p.volunteersJoined) || Number(p.registeredCount) || Number(p.registered) || 0;
      const cat = p.category || 'Sosial';
      const ben = Number(p.beneficiariesCount || p.beneficiaries) || 0;

      totalTargetQuota += quota;
      totalRegisteredInPrograms += registered;
      totalBeneficiaries += ben;

      if (!categoryStats[cat]) {
        categoryStats[cat] = { count: 0, totalQuota: 0, totalReg: 0 };
      }
      categoryStats[cat].count += 1;
      categoryStats[cat].totalQuota += quota;
      categoryStats[cat].totalReg += registered;
    });

    const avgFillRate = totalTargetQuota > 0
      ? Math.round((totalRegisteredInPrograms / totalTargetQuota) * 100)
      : 0;

    const categoryList = Object.entries(categoryStats).map(([name, val]) => ({
      name,
      programsCount: val.count,
      totalReg: val.totalReg,
      fillRate: val.totalQuota > 0 ? Math.round((val.totalReg / val.totalQuota) * 100) : 0
    })).sort((a, b) => b.totalReg - a.totalReg);

    const topPrograms = [...programs]
      .map(p => {
        const q = Number(p.volunteersTarget) || Number(p.quota) || Number(p.targetRelawan) || 20;
        const r = Number(p.volunteersJoined) || Number(p.registeredCount) || Number(p.registered) || 0;
        return {
          id: p.id,
          title: p.title,
          category: p.category || 'Umum',
          quota: q,
          registered: r,
          fillRate: q > 0 ? Math.round((r / q) * 100) : 0
        };
      })
      .sort((a, b) => b.fillRate - a.fillRate)
      .slice(0, 5);

    // 5. CSAT & Quality
    let reviewCount = 0;
    let ratingSum = 0;
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let certificatesIssued = 0;

    activeApps.forEach(a => {
      if (a.certificateUrl) certificatesIssued++;
      if (a.feedbackSubmitted && a.rating) {
        const r = Math.min(5, Math.max(1, Math.round(Number(a.rating))));
        ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
        ratingSum += Number(a.rating);
        reviewCount++;
      }
    });

    const avgCSAT = reviewCount > 0 ? (ratingSum / reviewCount).toFixed(1) : '5.0';
    const feedbackResponseRate = activeApps.length > 0
      ? Math.round((reviewCount / activeApps.length) * 100)
      : 0;
    const certIssueRate = activeApps.length > 0
      ? Math.round((certificatesIssued / activeApps.length) * 100)
      : 0;

    return {
      totalUsers: users.length,
      activeVolunteersCount,
      inactiveUserCount,
      repeatRate,
      avgActivitiesPerVolunteer,
      maleCount,
      femaleCount,
      unassignedGender,
      malePct,
      femalePct,
      dataCompletenessPct,
      phoneCoveragePct,
      topInstitutions,
      championCount,
      enthusiastCount,
      firstTimerCount,
      totalTargetQuota,
      totalRegisteredInPrograms,
      totalBeneficiaries,
      avgFillRate,
      categoryList,
      topPrograms,
      avgCSAT,
      reviewCount,
      ratingDistribution,
      feedbackResponseRate,
      certificatesIssued,
      certIssueRate,
      // Fee Analytics
      feeRecordedCount,
      avgFee,
      medianFee,
      modeFee,
      wtpRate,
      freeRate,
      freeFeeCount,
      paidFeeCount,
      tier10to30Count,
      tier40to70Count,
      tier80to100Count,
      tier110to150Count,
      feeStepMap,
      maxStepFreq
    };
  }, [filteredData, users]);

  const handleGenerateAiReport = async () => {
    setIsGeneratingAi(true);
    try {
      const periodLabel =
        timeFilter === 'month' ? 'Bulan Ini' :
        timeFilter === 'year' ? 'Tahun Ini' :
        'Semua Waktu';

      const feedbacks = filteredData.activeApps
        .filter(a => a.feedbackSubmitted && (a.kesan || a.pesan))
        .slice(0, 30)
        .map(a => ({
          rating: a.rating,
          kesan: a.kesan,
          pesan: a.pesan,
          programTitle: a.programTitle
        }));

      const metricsPayload = {
        totalUsers: analytics.totalUsers,
        activeVolunteersCount: analytics.activeVolunteersCount,
        inactiveUserCount: analytics.inactiveUserCount,
        repeatRate: analytics.repeatRate,
        avgActivitiesPerVolunteer: analytics.avgActivitiesPerVolunteer,
        championCount: analytics.championCount,
        enthusiastCount: analytics.enthusiastCount,
        firstTimerCount: analytics.firstTimerCount,
        avgFillRate: analytics.avgFillRate,
        totalRegisteredInPrograms: analytics.totalRegisteredInPrograms,
        totalTargetQuota: analytics.totalTargetQuota,
        categoryList: analytics.categoryList,
        topPrograms: analytics.topPrograms,
        feeRecordedCount: analytics.feeRecordedCount,
        avgFee: analytics.avgFee,
        medianFee: analytics.medianFee,
        modeFee: analytics.modeFee,
        wtpRate: analytics.wtpRate,
        paidFeeCount: analytics.paidFeeCount,
        freeFeeCount: analytics.freeFeeCount,
        tier10to30Count: analytics.tier10to30Count,
        tier40to70Count: analytics.tier40to70Count,
        tier80to100Count: analytics.tier80to100Count,
        tier110to150Count: analytics.tier110to150Count,
        maleCount: analytics.maleCount,
        malePct: analytics.malePct,
        femaleCount: analytics.femaleCount,
        femalePct: analytics.femalePct,
        dataCompletenessPct: analytics.dataCompletenessPct,
        phoneCoveragePct: analytics.phoneCoveragePct,
        topInstitutions: analytics.topInstitutions,
        avgCSAT: analytics.avgCSAT,
        reviewCount: analytics.reviewCount,
        feedbackResponseRate: analytics.feedbackResponseRate,
        certificatesIssued: analytics.certificatesIssued,
        certIssueRate: analytics.certIssueRate,
        totalBeneficiaries: analytics.totalBeneficiaries
      };

      // 1. Try Firebase AI Logic (Gemini 2.5 Flash) directly via Firebase Web SDK
      try {
        const ai = getAI(app, { backend: new GoogleAIBackend() });
        const reportSchema = Schema.object({
          properties: {
            headline: Schema.string(),
            executiveSummary: Schema.string(),
            keyMetricsInsight: Schema.object({
              properties: {
                volunteerAndRetention: Schema.string(),
                commitmentFeeAndPricing: Schema.string(),
                programAndQuota: Schema.string()
              }
            }),
            impactHighlights: Schema.array({ items: Schema.string() }),
            sentimentAnalysis: Schema.string(),
            strategicRecommendations: Schema.array({ items: Schema.string() }),
            partnerPitch: Schema.string()
          }
        });

        const model = getGenerativeModel(ai, {
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.35,
            topP: 0.9,
            responseMimeType: 'application/json',
            responseSchema: reportSchema
          }
        });

        const promptText = buildQualityAnalyticsPrompt({
          periodLabel,
          metrics: metricsPayload,
          feedbacks
        });

        const result = await model.generateContent(promptText);
        const text = result.response.text();
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed && parsed.headline && parsed.executiveSummary) {
            setAiReportModal({
              success: true,
              source: 'gemini-2.5-flash',
              periodLabel,
              report: parsed
            });
            return;
          }
        }
      } catch (firebaseAiErr) {
        console.info('Firebase AI Logic fallback ke API /api/ai/impact-report:', firebaseAiErr?.message);
      }

      // 2. Fallback to Server Route (/api/ai/impact-report)
      const res = await fetch('/api/ai/impact-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodLabel,
          metrics: metricsPayload,
          feedbacks
        })
      });
      const data = await res.json();
      if (data.success && data.report) {
        setAiReportModal({ ...data, periodLabel });
      } else {
        alert('Gagal menyusun laporan AI: ' + (data.error || 'Terjadi kesalahan'));
      }
    } catch (err) {
      alert('Gagal menghubungi layanan laporan AI: ' + err.message);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopyReport = () => {
    if (!aiReportModal?.report) return;
    const r = aiReportModal.report;
    const text = [
      `LAPORAN ANALITIK & DAMPAK AI — UNTUK ESOK (${aiReportModal.periodLabel || 'Semua Waktu'})`,
      r.headline,
      '',
      'RINGKASAN EKSEKUTIF:',
      r.executiveSummary,
      '',
      ...(r.keyMetricsInsight
        ? [
            'ANALISIS METRIK KUNCI:',
            `• Relawan & Retensi: ${r.keyMetricsInsight.volunteerAndRetention || '-'}`,
            `• Commitment Fee & WTP: ${r.keyMetricsInsight.commitmentFeeAndPricing || '-'}`,
            `• Kategori & Kuota Kegiatan: ${r.keyMetricsInsight.programAndQuota || '-'}`,
            ''
          ]
        : []),
      'SOROTAN CAPAIAN:',
      ...(r.impactHighlights || []).map(h => `• ${h}`),
      '',
      'EVALUASI & SENTIMEN RELAWAN:',
      r.sentimentAnalysis,
      '',
      'REKOMENDASI STRATEGIS:',
      ...(r.strategicRecommendations || []).map(rec => `• ${rec}`),
      '',
      'NARASI PROPOSAL MITRA & CSR:',
      r.partnerPitch
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAi(true);
    setTimeout(() => setCopiedAi(false), 2000);
  };

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* HEADER & TIME FILTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="ue-eyebrow" style={{ marginBottom: '4px' }}>ANALITIK</div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Analitik
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Time Filter Circular Dropdown */}
          <AdminSearchFilterBar
            hideSearch
            ariaLabel="Urutkan Kegiatan"
            title="Filter Periode Analitik"
            sections={[
              {
                label: 'Periode Waktu',
                value: timeFilter,
                onChange: setTimeFilter,
                options: [
                  { value: 'all', label: 'Semua Waktu' },
                  { value: 'year', label: 'Tahun Ini' },
                  { value: 'month', label: 'Bulan Ini' }
                ]
              }
            ]}
          />

          <button
            type="button"
            onClick={handleGenerateAiReport}
            disabled={isGeneratingAi || isLoading}
            className="ue-btn ue-btn-primary"
          >
            <FiFileText size={13} />
            <span>{isGeneratingAi ? 'Menyusun...' : 'Laporan AI'}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '48px', textAlign: 'center', background: '#ffffff', borderRadius: '10px', border: '1px solid #e8eaec' }}>
          <p style={{ margin: 0, color: '#6b6b6b', fontSize: '13px' }}>Memuat analitik...</p>
        </div>
      ) : (
        <>
          {/* SEPARATED KPI CARDS — Clean & Concise */}
          <section
            aria-label="Indikator analitik"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '16px',
              marginBottom: '20px'
            }}
          >
            {/* KPI 1: Relawan Aktif */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Relawan Aktif
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#233B69', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiUsers size={16} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                {analytics.activeVolunteersCount}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
                <span>dari <strong style={{ color: '#0F172A' }}>{analytics.totalUsers}</strong> akun</span>
              </div>
            </div>

            {/* KPI 2: Retensi */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Retensi
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiRepeat size={16} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                {analytics.repeatRate}%
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
                <span>≥2 kegiatan</span>
              </div>
            </div>

            {/* KPI 3: Keterisian */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Keterisian
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiBarChart2 size={16} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                {analytics.avgFillRate}%
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
                <span>rata-rata kuota</span>
              </div>
            </div>

            {/* KPI 4: Kepuasan */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Kepuasan
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiStar size={16} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                {analytics.avgCSAT} / 5.0
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
                <span><strong style={{ color: '#0F172A' }}>{analytics.reviewCount}</strong> ulasan</span>
              </div>
            </div>

            {/* KPI 5: Profil Lengkap */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Profil Lengkap
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F0FDF4', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiUserCheck size={16} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                {analytics.dataCompletenessPct}%
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
                <span>WA <strong style={{ color: '#0F172A' }}>{analytics.phoneCoveragePct}%</strong></span>
              </div>
            </div>
          </section>

          {/* DEDICATED PANEL: PREFERENSI COMMITMENT FEE */}
          <section
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #e2e8f0',
              marginBottom: '20px',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
            }}
          >
            {/* Card Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '18px',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 600, color: '#0f172a', letterSpacing: '-0.015em' }}>
                  Preferensi Commitment Fee
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  Rentang Rp 0 – 150.000 per relawan
                </p>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#233B69',
                  background: '#eff6ff',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: '1px solid #dbeafe',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {analytics.feeRecordedCount} Respon
              </span>
            </div>

            {/* 4 Statistical Summary KPI Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
                gap: '12px',
                marginBottom: '18px'
              }}
            >
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Rata-rata
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#0f172a', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
                  Rp {analytics.avgFee.toLocaleString('id-ID')}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Median
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#233B69', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
                  Rp {analytics.medianFee.toLocaleString('id-ID')}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Modus
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#b45309', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
                  Rp {analytics.modeFee.toLocaleString('id-ID')}
                </div>
              </div>

              <div style={{ background: '#f0fdf4', padding: '14px 16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Bersedia Bayar
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#166534', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
                  {analytics.wtpRate}% <span style={{ fontSize: '12px', fontWeight: 500, color: '#15803d' }}>(&gt; Rp 0)</span>
                </div>
              </div>
            </div>

            {/* Two-Column Split: Left = Proporsi & 5 Segmen Tier | Right = Histogram Kelipatan 10K */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '16px'
              }}
            >
              {/* Left Column: Proporsi Berbayar vs Rp 0 + 5 Segmen Tier */}
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                      gap: '6px'
                    }}
                  >
                    <span style={{ color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#166534' }} />
                      Berbayar: {analytics.paidFeeCount} ({analytics.wtpRate}%)
                    </span>
                    <span style={{ color: '#233B69', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#233B69' }} />
                      Gratis (Rp 0): {analytics.freeFeeCount} ({analytics.freeRate}%)
                    </span>
                  </div>
                  <div style={{ height: '10px', borderRadius: '999px', background: '#e2e8f0', display: 'flex', overflow: 'hidden', gap: '2px' }}>
                    <div style={{ width: `${analytics.wtpRate}%`, background: '#166534', borderRadius: '999px 0 0 999px' }} />
                    <div style={{ width: `${analytics.freeRate}%`, background: '#233B69', borderRadius: '0 999px 999px 0' }} />
                  </div>
                </div>

                {/* 5 Tier Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px' }}>
                  {[
                    { label: 'Rp 0', count: analytics.freeFeeCount, color: '#233B69', bg: '#ffffff', border: '#cbd5e1' },
                    { label: '10–30K', count: analytics.tier10to30Count, color: '#166534', bg: '#ffffff', border: '#bbf7d0' },
                    { label: '40–70K', count: analytics.tier40to70Count, color: '#b45309', bg: '#ffffff', border: '#fde68a' },
                    { label: '80–100K', count: analytics.tier80to100Count, color: '#233B69', bg: '#ffffff', border: '#e2e8f0' },
                    { label: '110–150K', count: analytics.tier110to150Count, color: '#166534', bg: '#ffffff', border: '#e2e8f0' }
                  ].map((tier) => {
                    const pct = analytics.feeRecordedCount > 0 ? Math.round((tier.count / analytics.feeRecordedCount) * 100) : 0;
                    return (
                      <div
                        key={tier.label}
                        style={{
                          background: tier.bg,
                          padding: '10px 6px',
                          borderRadius: '10px',
                          border: `1px solid ${tier.border}`,
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '4px'
                        }}
                      >
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{tier.label}</div>
                        <div style={{ fontSize: '17px', fontWeight: 600, color: tier.color, fontVariantNumeric: 'tabular-nums' }}>
                          {tier.count}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                          {pct}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Distribution Step Chart (0 - 150K per 10K step) */}
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}
                >
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Sebaran per 10K
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                    Rp 0 – 150K
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(16, 1fr)',
                    gap: '4px',
                    alignItems: 'flex-end',
                    height: '96px',
                    padding: '14px 0 6px 0',
                    borderBottom: '1px solid #cbd5e1'
                  }}
                >
                  {Object.entries(analytics.feeStepMap).map(([step, count]) => {
                    const numStep = Number(step);
                    const heightPct = analytics.maxStepFreq > 0 ? Math.round((count / analytics.maxStepFreq) * 100) : 0;
                    const barColor = numStep === 0 ? '#233B69' : numStep <= 30000 ? '#166534' : '#d97706';
                    return (
                      <div
                        key={step}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                          gap: '3px'
                        }}
                        title={`Rp ${numStep.toLocaleString('id-ID')}: ${count} relawan`}
                      >
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 600,
                            color: count > 0 ? '#0f172a' : 'transparent',
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1
                          }}
                        >
                          {count > 0 ? count : '0'}
                        </span>
                        <div
                          style={{
                            width: '100%',
                            height: `${Math.max(count > 0 ? 14 : 4, heightPct)}%`,
                            background: count > 0 ? barColor : '#e2e8f0',
                            borderRadius: '4px 4px 2px 2px',
                            transition: 'height 0.25s ease'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', fontWeight: 500, marginTop: '6px' }}>
                  <span>Rp 0</span>
                  <span>50K</span>
                  <span>100K</span>
                  <span>150K</span>
                </div>
              </div>
            </div>
          </section>

          {/* 2x2 EXECUTIVE ANALYTICS GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '20px' }}>

            {/* PANEL 1: DEMOGRAFI & GENDER */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '22px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                    Demografi & Gender
                  </h3>
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#233B69',
                      background: '#eff6ff',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      border: '1px solid #dbeafe'
                    }}
                  >
                    {analytics.maleCount + analytics.femaleCount} Data
                  </span>
                </div>

                {/* Gender Ratio Bar */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    <span style={{ color: '#233B69' }}>Laki-laki: {analytics.maleCount} ({analytics.malePct}%)</span>
                    <span style={{ color: '#166534' }}>Perempuan: {analytics.femaleCount} ({analytics.femalePct}%)</span>
                  </div>
                  <div style={{ height: '10px', borderRadius: '999px', background: '#e2e8f0', display: 'flex', overflow: 'hidden', gap: '2px' }}>
                    <div style={{ width: `${analytics.malePct}%`, background: '#233B69' }} />
                    <div style={{ width: `${analytics.femalePct}%`, background: '#166534' }} />
                  </div>
                </div>

                {/* Kelengkapan Kontak & Profil */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>WhatsApp</div>
                    <div style={{ fontSize: '17px', fontWeight: 600, color: '#0f172a', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                      {analytics.phoneCoveragePct}%
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>Profil Lengkap</div>
                    <div style={{ fontSize: '17px', fontWeight: 600, color: '#0f172a', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                      {analytics.dataCompletenessPct}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Instansi */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>
                  Top Instansi / Kampus
                </div>
                {analytics.topInstitutions.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                    Belum ada data.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {analytics.topInstitutions.map((inst, i) => (
                      <span
                        key={i}
                        style={{
                          background: '#f8fafc',
                          color: '#233B69',
                          border: '1px solid #e2e8f0',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '11.5px',
                          fontWeight: 500
                        }}
                      >
                        {inst.name} ({inst.count})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* PANEL 2: PARTISIPASI RELAWAN */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '22px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                    Partisipasi Relawan
                  </h3>
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#166534',
                      background: '#f0fdf4',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      border: '1px solid #bbf7d0'
                    }}
                  >
                    {analytics.avgActivitiesPerVolunteer} Kegiatan / Relawan
                  </span>
                </div>

                {/* Cohort Tiers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div
                    style={{
                      background: '#fffbeb',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid #fde68a',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>Champion (≥5 Kegiatan)</div>
                      <div style={{ fontSize: '11.5px', color: '#b45309', marginTop: '2px' }}>Relawan inti</div>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#92400e', fontVariantNumeric: 'tabular-nums' }}>
                      {analytics.championCount} orang
                    </span>
                  </div>

                  <div
                    style={{
                      background: '#eff6ff',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid #dbeafe',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#233B69' }}>Aktif (2–4 Kegiatan)</div>
                      <div style={{ fontSize: '11.5px', color: '#1e40af', marginTop: '2px' }}>Partisipasi berulang</div>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#233B69', fontVariantNumeric: 'tabular-nums' }}>
                      {analytics.enthusiastCount} orang
                    </span>
                  </div>

                  <div
                    style={{
                      background: '#f0fdf4',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid #bbf7d0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>Baru (1 Kegiatan)</div>
                      <div style={{ fontSize: '11.5px', color: '#15803d', marginTop: '2px' }}>Partisipasi perdana</div>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#166534', fontVariantNumeric: 'tabular-nums' }}>
                      {analytics.firstTimerCount} orang
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: '12.5px',
                  color: '#334155',
                  background: '#f8fafc',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  borderLeft: '3px solid #233B69'
                }}
              >
                Retensi berulang: <strong style={{ color: '#0f172a' }}>{analytics.repeatRate}%</strong>
              </div>
            </div>

            {/* PANEL 3: KETERISIAN PER KATEGORI */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '22px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px'
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                  Keterisian per Kategori
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {analytics.categoryList.map((cat, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                        <span style={{ color: '#0f172a' }}>{cat.name} ({cat.programsCount})</span>
                        <span style={{ color: cat.fillRate >= 100 ? '#166534' : '#233B69', fontVariantNumeric: 'tabular-nums' }}>
                          {cat.totalReg} Relawan ({cat.fillRate}%)
                        </span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, cat.fillRate)}%`,
                            background: cat.fillRate >= 100 ? '#166534' : '#233B69',
                            borderRadius: '999px'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', marginBottom: '10px' }}>
                  Top 5 Kegiatan
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {analytics.topPrograms.map((tp, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                        background: '#f8fafc',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #f1f5f9',
                        gap: '10px'
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 500,
                          color: '#1e293b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}
                      >
                        {i + 1}. {tp.title}
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: tp.fillRate >= 100 ? '#166534' : '#b45309',
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0
                        }}
                      >
                        {tp.registered}/{tp.quota} ({tp.fillRate}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PANEL 4: KEPUASAN & SERTIFIKAT */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '22px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                    Kepuasan & Sertifikat
                  </h3>
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#475569',
                      background: '#f8fafc',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    {analytics.reviewCount} Ulasan
                  </span>
                </div>

                {/* Skor Rata-rata CSAT Progress Bar */}
                <div style={{ background: '#FFFDF5', border: '1px solid #FDE68A', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Skor CSAT
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: 600, color: '#B45309', fontVariantNumeric: 'tabular-nums' }}>
                      ★ {analytics.avgCSAT} <span style={{ fontSize: '12px', fontWeight: 500, color: '#92400E' }}>/ 5.0</span>
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '9px', background: '#FEF3C7', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(8, (Number(analytics.avgCSAT) / 5) * 100))}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)',
                        borderRadius: '999px',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#B45309', marginTop: '6px', fontWeight: 500 }}>
                    <span>1.0</span>
                    <span>3.0</span>
                    <span>5.0 ({Math.round((Number(analytics.avgCSAT) / 5) * 100)}%)</span>
                  </div>
                </div>

                {/* Star Rating Distribution */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      Distribusi Bintang
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      height: '88px',
                      padding: '10px 14px 4px 14px',
                      background: '#F8FAFC',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0'
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((stars) => {
                      const count = analytics.ratingDistribution[stars] || 0;
                      const maxCount = Math.max(1, ...Object.values(analytics.ratingDistribution));
                      const barHeightPct = Math.round((count / maxCount) * 100);
                      const isTop = count > 0 && stars >= 4;

                      return (
                        <div key={stars} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1 }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: count > 0 ? '#0F172A' : '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
                            {count}
                          </span>
                          <div style={{ width: '28px', height: '44px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                            <div
                              style={{
                                width: '100%',
                                height: count > 0 ? `${Math.max(16, barHeightPct)}%` : '4px',
                                background: isTop ? '#D97706' : count > 0 ? '#F59E0B' : '#E2E8F0',
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.3s ease'
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: count > 0 ? '#334155' : '#94A3B8',
                              borderTop: '1px solid #CBD5E1',
                              width: '100%',
                              textAlign: 'center',
                              paddingTop: '3px'
                            }}
                          >
                            {stars}★
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Status Sertifikat & Respon */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Sertifikat Terbit</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    {analytics.certificatesIssued}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{analytics.certIssueRate}% pendaftar</div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Respon Ulasan</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    {analytics.feedbackResponseRate}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{analytics.reviewCount} ulasan</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL LAPORAN DAMPAK AI */}
      {aiReportModal?.report && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setAiReportModal(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#233B69',
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      padding: '2px 8px',
                      borderRadius: '999px'
                    }}
                  >
                    {aiReportModal.source?.includes('gemini-2.5')
                      ? 'Gemini 2.5 Flash'
                      : aiReportModal.source?.includes('gemini-1.5')
                        ? 'Gemini 1.5 Flash'
                        : 'Gemini Analytical Synthesis'}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>
                    Cakupan: {aiReportModal.periodLabel || 'Semua Waktu'}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0F172A', lineHeight: 1.35 }}>
                  {aiReportModal.report.headline}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleGenerateAiReport}
                  disabled={isGeneratingAi}
                  className="ue-btn"
                  title="Susun ulang ringkasan AI"
                >
                  <FiRepeat size={13} />
                  <span>{isGeneratingAi ? 'Menyusun...' : 'Buat Ulang'}</span>
                </button>
                <button type="button" onClick={handleCopyReport} className="ue-btn">
                  {copiedAi ? <FiCheck size={13} /> : <FiCopy size={13} />}
                  <span>{copiedAi ? 'Tersalin' : 'Salin'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiReportModal(null)}
                  className="ue-icon-btn"
                  style={{ width: '32px', height: '32px' }}
                  aria-label="Tutup modal"
                >
                  <FiX size={15} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13.5px', color: '#1E293B', lineHeight: 1.6 }}>
              <div style={{ background: '#F8FAFC', padding: '14px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#233B69', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  Ringkasan Eksekutif
                </div>
                <p style={{ margin: 0, color: '#0F172A' }}>{aiReportModal.report.executiveSummary}</p>
              </div>

              {aiReportModal.report.keyMetricsInsight && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#233B69', marginBottom: '4px' }}>
                      Relawan & Retensi
                    </div>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                      {aiReportModal.report.keyMetricsInsight.volunteerAndRetention}
                    </p>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#059669', marginBottom: '4px' }}>
                      Strategi Commitment Fee
                    </div>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                      {aiReportModal.report.keyMetricsInsight.commitmentFeeAndPricing}
                    </p>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#D97706', marginBottom: '4px' }}>
                      Keterisian & Kategori
                    </div>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                      {aiReportModal.report.keyMetricsInsight.programAndQuota}
                    </p>
                  </div>
                </div>
              )}

              {aiReportModal.report.impactHighlights?.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Sorotan Capaian Utama</div>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {aiReportModal.report.impactHighlights.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Sentimen & Refleksi Relawan</div>
                <p style={{ margin: 0 }}>{aiReportModal.report.sentimentAnalysis}</p>
              </div>

              {aiReportModal.report.strategicRecommendations?.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Rekomendasi Strategis & Operasional</div>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {aiReportModal.report.strategicRecommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ background: '#EFF6FF', padding: '14px 16px', borderRadius: '12px', border: '1px solid #BFDBFE' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E3A8A', marginBottom: '4px' }}>Narasi Proposal Mitra & CSR</div>
                <p style={{ margin: 0, color: '#1E293B', fontSize: '13px' }}>{aiReportModal.report.partnerPitch}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
