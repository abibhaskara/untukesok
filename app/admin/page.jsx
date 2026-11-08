'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  FiChevronRight, FiPlus, FiAlertTriangle, FiUsers,
  FiBriefcase, FiTrendingUp, FiStar, FiArrowUpRight,
  FiInbox, FiZap
} from 'react-icons/fi';
import { useAdminData } from '../../src/context/AdminDataContext';
import { useAuth } from '../../src/context/AuthContext';
import { getAppAmount } from '../../src/lib/paymentUtils';
import AdminPagination from '../../src/components/AdminPagination';
import { collection, getDocs, limit, query, orderBy } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

function getInitials(name = 'Relawan') {
  return String(name)
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'UE';
}

export default function AdminDashboardOverview() {
  const { users, programs, applications, expenses, isLoading } = useAdminData();
  const { currentUser } = useAuth();
  const [progPage, setProgPage] = useState(1);
  const [progPageSize, setProgPageSize] = useState(10);
  const [appPage, setAppPage] = useState(1);
  const [appPageSize, setAppPageSize] = useState(10);
  const [voices, setVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadVoices() {
      try {
        let snap;
        try {
          snap = await getDocs(query(collection(db, 'kotak_suara'), orderBy('createdAt', 'desc'), limit(5)));
        } catch {
          snap = await getDocs(query(collection(db, 'kotak_suara'), limit(5)));
        }
        if (isMounted) {
          if (snap && !snap.empty) {
            setVoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          } else {
            setVoices([]);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat aspirasi di ringkasan:', err);
        if (isMounted) setVoices([]);
      } finally {
        if (isMounted) setVoicesLoading(false);
      }
    }
    loadVoices();
    return () => { isMounted = false; };
  }, []);

  const metrics = useMemo(() => {
    const activeApps = applications.filter(a => a.status !== 'Dibatalkan' && a.status !== 'Dikeluarkan');
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    let totalRevenue = 0;
    let thisMonthRegs = 0;
    let pendingProofsCount = 0;
    let needsCertCount = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    const recentFeedbacks = [];

    activeApps.forEach(app => {
      const amount = getAppAmount(app);
      if (amount > 0) {
        totalRevenue += amount;
      }
      if (app.appliedAt) {
        const d = new Date(app.appliedAt);
        if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
          thisMonthRegs += 1;
        }
      }
      if ((app.paymentProofUrl || app.storyProofUrl || app.igProofUrl) && app.status === 'Terdaftar') {
        pendingProofsCount += 1;
      }
      if (app.status === 'Selesai' && !app.certificateUrl && !app.noCertificate) {
        needsCertCount += 1;
      }
      if (app.feedbackSubmitted && app.rating) {
        ratingSum += Number(app.rating);
        ratingCount += 1;
        recentFeedbacks.push(app);
      }
    });

    const missingReceiptCount = expenses.filter(e => !e.receiptUrl).length;
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netBalance = totalRevenue - totalExpenses;
    const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : '5.0';

    const programSummary = programs.map(p => {
      const progApps = activeApps.filter(a => a.programId === p.id);
      const progRev = progApps.reduce((acc, a) => acc + getAppAmount(a), 0);
      const quota = Number(p.volunteersTarget || p.quota || p.targetRelawan || 20);
      const regCount = progApps.length || Number(p.volunteersJoined || 0);
      const fillPct = quota > 0 ? Math.round((regCount / quota) * 100) : 0;
      const statusLabel = p.status === 'Selesai' ? 'Selesai' : fillPct >= 100 ? 'Penuh' : 'Buka';
      return {
        ...p,
        regCount,
        quota,
        fillPct,
        revenue: progRev,
        statusLabel
      };
    });

    const totalCashVolume = Math.max(1, totalRevenue + totalExpenses);
    const inflowRatio = Math.round((totalRevenue / totalCashVolume) * 100);
    const outflowRatio = 100 - inflowRatio;

    const actionGroups = [
      pendingProofsCount > 0 && `${pendingProofsCount} berkas menunggu verifikasi`,
      needsCertCount > 0 && `${needsCertCount} sertifikat belum terbit`,
      missingReceiptCount > 0 && `${missingReceiptCount} pengeluaran tanpa nota`
    ].filter(Boolean);

    return {
      totalUsers: users.length,
      totalPrograms: programs.length,
      activePrograms: programs.filter(p => p.status !== 'Selesai').length,
      totalRegistrations: activeApps.length,
      thisMonthRegs,
      totalRevenue,
      totalExpenses,
      netBalance,
      inflowRatio,
      outflowRatio,
      pendingProofsCount,
      needsCertCount,
      missingReceiptCount,
      actionGroups,
      avgRating,
      ratingCount,
      programSummary,
      recentApplications: applications,
      recentFeedbacks: recentFeedbacks.slice(0, 2)
    };
  }, [users, programs, applications, expenses]);

  const paginatedPrograms = useMemo(() => {
    const start = (progPage - 1) * progPageSize;
    return metrics.programSummary.slice(start, start + progPageSize);
  }, [metrics.programSummary, progPage, progPageSize]);

  const paginatedApps = useMemo(() => {
    const start = (appPage - 1) * appPageSize;
    return metrics.recentApplications.slice(start, start + appPageSize);
  }, [metrics.recentApplications, appPage, appPageSize]);

  const firstName = (currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. STANDARDIZED PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="ue-eyebrow" style={{ marginBottom: '4px' }}>RINGKASAN</div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: '#0F172A', lineHeight: 1.2 }}>
            {greeting}, {firstName}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Link href="/admin/analitik" className="ue-btn">
            Analitik
          </Link>
          <Link href="/admin/kegiatan" className="ue-btn ue-btn-primary">
            <FiPlus size={15} /> Kegiatan Baru
          </Link>
        </div>
      </div>

      {/* 2. EXECUTIVE ACTION RADAR (Shown when pending actions exist) */}
      {metrics.actionGroups.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, #FFFDF8 0%, #FFF8EE 100%)',
            border: '1px solid #FDE68A',
            borderRadius: '14px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#FFBD59',
                color: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <FiAlertTriangle size={18} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                {metrics.actionGroups.length} Prioritas Menunggu
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {metrics.pendingProofsCount > 0 && (
                  <Link
                    href="/admin/relawan"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#92400E',
                      background: '#FEF3C7',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      textDecoration: 'none'
                    }}
                  >
                    <span>{metrics.pendingProofsCount} Berkas</span>
                    <FiChevronRight size={12} />
                  </Link>
                )}
                {metrics.needsCertCount > 0 && (
                  <Link
                    href="/admin/relawan"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#1E40AF',
                      background: '#DBEAFE',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      textDecoration: 'none'
                    }}
                  >
                    <span>{metrics.needsCertCount} Sertifikat</span>
                    <FiChevronRight size={12} />
                  </Link>
                )}
                {metrics.missingReceiptCount > 0 && (
                  <Link
                    href="/admin/keuangan"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#991B1B',
                      background: '#FEE2E2',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      textDecoration: 'none'
                    }}
                  >
                    <span>{metrics.missingReceiptCount} Tanpa Nota</span>
                    <FiChevronRight size={12} />
                  </Link>
                )}
              </div>
            </div>
          </div>

          <Link href="/admin/relawan" className="ue-btn ue-btn-primary" style={{ height: '36px', fontSize: '12.5px' }}>
            Tindak Lanjut
          </Link>
        </div>
      )}

      {/* 3. EXECUTIVE KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* KPI 1: Relawan */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Relawan
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#233B69', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiUsers size={16} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {isLoading ? '—' : metrics.totalRegistrations}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
            <span style={{ background: '#DCFCE7', color: '#166534', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
              +{metrics.thisMonthRegs}
            </span>
            <span>bln ini · {metrics.totalUsers} akun</span>
          </div>
        </div>

        {/* KPI 2: Kegiatan */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Kegiatan Aktif
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiBriefcase size={16} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {isLoading ? '—' : metrics.activePrograms}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
            <span style={{ background: '#F1F5F9', color: '#334155', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
              {metrics.totalPrograms} total
            </span>
            <span>kegiatan 2026</span>
          </div>
        </div>

        {/* KPI 3: Kas Bersih */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Kas Bersih
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiTrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: metrics.netBalance >= 0 ? '#0F172A' : '#DC2626', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {isLoading ? '—' : `Rp ${metrics.netBalance.toLocaleString('id-ID')}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
            <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
              Rp {metrics.totalRevenue.toLocaleString('id-ID')}
            </span>
            <span>kas masuk</span>
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
            {isLoading ? '—' : `★ ${metrics.avgRating}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
            <span style={{ background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
              {metrics.ratingCount} ulasan
            </span>
            <span>relawan</span>
          </div>
        </div>
      </div>

      {/* 4. MAIN EXECUTIVE GRID: 2-COLUMN (65% / 35%) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', alignItems: 'start' }}>

        {/* LEFT COLUMN: KEGIATAN BERJALAN & LOG PENDAFTARAN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>

          {/* PANEL 1: KEGIATAN BERJALAN */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Kegiatan Berjalan
              </h2>
              <Link href="/admin/kegiatan" style={{ fontSize: '12.5px', fontWeight: 600, color: '#233B69', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Semua <FiChevronRight size={14} />
              </Link>
            </div>

            {metrics.programSummary.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                Belum ada kegiatan terdaftar.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="ue-table">
                  <thead>
                    <tr>
                      <th>Kegiatan</th>
                      <th>Jadwal</th>
                      <th>Kuota</th>
                      <th style={{ textAlign: 'right' }}>Kas Masuk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPrograms.map(prog => {
                      const barColor = prog.fillPct >= 100 ? '#FFBD59' : '#233B69';

                      return (
                        <tr key={prog.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <Link
                              href={`/admin/relawan?programId=${prog.id}`}
                              style={{ fontWeight: 600, color: '#0F172A', textDecoration: 'none', display: 'block', fontSize: '13.5px' }}
                            >
                              {prog.title}
                            </Link>
                            <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                              {prog.category || 'Sosial'} · {prog.location || 'Bali'}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', color: '#334155', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                            {prog.date || 'Menyusul'}
                          </td>
                          <td style={{ padding: '14px 16px', minWidth: '130px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                              <span style={{ fontWeight: 600, color: '#0F172A' }}>
                                {prog.regCount} / {prog.quota}
                              </span>
                              <span style={{ color: '#64748B', fontWeight: 500 }}>{prog.fillPct}%</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: '#F1F5F9', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, Math.max(6, prog.fillPct))}%`,
                                  height: '100%',
                                  borderRadius: '999px',
                                  background: barColor,
                                  transition: 'width 0.3s ease'
                                }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            Rp {prog.revenue.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {metrics.programSummary.length > 0 && (
              <AdminPagination
                currentPage={progPage}
                pageSize={progPageSize}
                totalItems={metrics.programSummary.length}
                onPageChange={setProgPage}
                onPageSizeChange={setProgPageSize}
                pageSizeOptions={[10, 50, 100]}
              />
            )}
          </div>

          {/* PANEL 2: PENDAFTARAN TERKINI */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Pendaftaran Terkini
              </h2>
              <Link href="/admin/relawan" style={{ fontSize: '12.5px', fontWeight: 600, color: '#233B69', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Kelola <FiChevronRight size={14} />
              </Link>
            </div>

            {metrics.recentApplications.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                Belum ada pendaftaran terbaru.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="ue-table">
                  <thead>
                    <tr>
                      <th>Relawan</th>
                      <th>Kegiatan</th>
                      <th style={{ textAlign: 'right' }}>Kontribusi</th>
                      <th style={{ textAlign: 'center' }} aria-label="Aksi" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedApps.map(app => {
                      const amount = getAppAmount(app);
                      const shortDate = app.appliedAt
                        ? new Date(app.appliedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                        : '-';

                      return (
                        <tr key={app.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: '#EFF6FF',
                                  color: '#233B69',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                {getInitials(app.userName)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{app.userName}</div>
                                <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                                  {[app.userEmail || app.userPhone, shortDate].filter(Boolean).join(' · ')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', color: '#334155', maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                            {app.programTitle || 'Kegiatan Untuk Esok'}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: amount > 0 ? '#166534' : '#64748B', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {amount > 0 ? `Rp ${amount.toLocaleString('id-ID')}` : 'Gratis'}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <Link
                              href="/admin/relawan"
                              className="ue-icon-btn"
                              style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                              title="Tinjau Relawan"
                            >
                              <FiArrowUpRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {metrics.recentApplications.length > 0 && (
              <AdminPagination
                currentPage={appPage}
                pageSize={appPageSize}
                totalItems={metrics.recentApplications.length}
                onPageChange={setAppPage}
                onPageSizeChange={setAppPageSize}
                pageSizeOptions={[10, 50, 100]}
              />
            )}
          </div>
        </div>

        {/* RIGHT RAIL: TUGAS PRIORITAS, ARUS KAS, & ULASAN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* CARD 1: TUGAS PRIORITAS */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <h2 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Tugas Prioritas
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                {
                  title: 'Verifikasi Berkas',
                  sub: 'Bukti bayar & story IG',
                  count: metrics.pendingProofsCount,
                  href: '/admin/relawan',
                  badgeBg: metrics.pendingProofsCount > 0 ? '#FEF3C7' : '#F1F5F9',
                  badgeColor: metrics.pendingProofsCount > 0 ? '#B45309' : '#64748B'
                },
                {
                  title: 'Terbitkan Sertifikat',
                  sub: 'Relawan selesai kegiatan',
                  count: metrics.needsCertCount,
                  href: '/admin/relawan',
                  badgeBg: metrics.needsCertCount > 0 ? '#DBEAFE' : '#DCFCE7',
                  badgeColor: metrics.needsCertCount > 0 ? '#1E40AF' : '#166534'
                },
                {
                  title: 'Kas Tanpa Nota',
                  sub: 'Lengkapi bukti pengeluaran',
                  count: metrics.missingReceiptCount,
                  href: '/admin/keuangan',
                  badgeBg: metrics.missingReceiptCount > 0 ? '#FEE2E2' : '#F1F5F9',
                  badgeColor: metrics.missingReceiptCount > 0 ? '#991B1B' : '#64748B'
                },
                {
                  title: 'Ulasan Masuk',
                  sub: 'Evaluasi pasca-kegiatan',
                  count: metrics.ratingCount,
                  href: '/admin/ulasan',
                  badgeBg: '#EFF6FF',
                  badgeColor: '#1D4ED8'
                }
              ].map((task, idx) => (
                <Link
                  key={idx}
                  href={task.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '13px 20px',
                    borderBottom: idx < 3 ? '1px solid #F8FAFC' : 'none',
                    textDecoration: 'none',
                    transition: 'background 0.15s ease'
                  }}
                  className="hover:bg-slate-50"
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{task.title}</div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '1px' }}>{task.sub}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        background: task.badgeBg,
                        color: task.badgeColor,
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {task.count}
                    </span>
                    <FiChevronRight size={14} style={{ color: '#CBD5E1' }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* CARD 2: ARUS KAS */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Arus Kas
              </h2>
              <Link href="/admin/keuangan" style={{ fontSize: '12px', fontWeight: 600, color: '#233B69', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                Detail <FiChevronRight size={13} />
              </Link>
            </div>

            {/* Split Bar */}
            <div style={{ display: 'flex', gap: '4px', height: '8px', borderRadius: '999px', overflow: 'hidden', margin: '12px 0 14px 0' }}>
              <div style={{ width: `${Math.max(8, metrics.inflowRatio)}%`, background: '#233B69', borderRadius: '999px', transition: 'width 0.4s ease' }} title={`Masuk: ${metrics.inflowRatio}%`} />
              <div style={{ width: `${Math.max(8, metrics.outflowRatio)}%`, background: '#FFBD59', borderRadius: '999px', transition: 'width 0.4s ease' }} title={`Keluar: ${metrics.outflowRatio}%`} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#233B69' }} />
                  Kas Masuk
                </span>
                <span style={{ fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                  Rp {metrics.totalRevenue.toLocaleString('id-ID')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFBD59' }} />
                  Pengeluaran
                </span>
                <span style={{ fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                  Rp {metrics.totalExpenses.toLocaleString('id-ID')}
                </span>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ fontWeight: 600, color: '#64748B' }}>Saldo Bersih</span>
                <span style={{ fontWeight: 800, color: metrics.netBalance >= 0 ? '#166534' : '#DC2626', fontVariantNumeric: 'tabular-nums' }}>
                  Rp {metrics.netBalance.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* CARD 3: ULASAN TERBARU */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Ulasan Terbaru
              </h2>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B' }}>
                ★ {metrics.avgRating} · {metrics.ratingCount} ulasan
              </span>
            </div>

            {metrics.recentFeedbacks.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '12.5px' }}>
                Belum ada ulasan.
              </div>
            ) : (
              metrics.recentFeedbacks.map(fb => (
                <div
                  key={fb.id}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid #F8FAFC',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {fb.kesan && (
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#334155', lineHeight: 1.55, fontStyle: 'italic' }}>
                      “{fb.kesan}”
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: '#EFF6FF',
                          color: '#233B69',
                          fontSize: '10px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {getInitials(fb.userName)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fb.userName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fb.programTitle}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        background: '#FFF7EA',
                        color: '#B45309',
                        borderRadius: '999px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0
                      }}
                    >
                      ★ {Number(fb.rating).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* CARD 4: KOTAK SUARA WARGA */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#EFF6FF', color: '#233B69', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiInbox size={15} />
                </div>
                <h2 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Kotak Suara Warga
                </h2>
              </div>
              <Link href="/admin/suara" style={{ fontSize: '12px', fontWeight: 600, color: '#233B69', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                Semua <FiChevronRight size={13} />
              </Link>
            </div>

            <div style={{ padding: '12px 20px 0 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
                <span>Aspirasi Terkini Warga Bali</span>
                <span style={{ fontWeight: 600, color: '#233B69', background: '#EFF6FF', padding: '1px 8px', borderRadius: '999px' }}>
                  {voicesLoading ? '…' : `${voices.length} Masuk`}
                </span>
              </div>
            </div>

            {voices.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '12.5px' }}>
                Belum ada aspirasi warga.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {voices.slice(0, 3).map(voice => (
                  <div
                    key={voice.id}
                    style={{
                      padding: '12px 20px',
                      borderBottom: '1px solid #F8FAFC',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
                        {voice.isAnonymous ? 'Anonim' : (voice.name || 'Warga')}
                      </span>
                      <span style={{ fontSize: '10.5px', fontWeight: 500, color: '#1E40AF', background: '#EFF6FF', padding: '1px 6px', borderRadius: '4px' }}>
                        {voice.category || 'Aspirasi'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      "{voice.message}"
                    </p>
                    <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                      {voice.regency || 'Bali'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ padding: '14px 20px', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <Link
                href="/admin/suara"
                className="ue-btn ue-btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  height: '34px',
                  fontSize: '12px',
                  background: 'linear-gradient(135deg, #1E293B 0%, #233B69 100%)'
                }}
              >
                <FiZap size={13} style={{ color: '#FFBD59' }} /> Sintesis & Kelola Aspirasi AI
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
