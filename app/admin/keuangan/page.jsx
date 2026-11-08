'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FiArrowUpRight, FiArrowDownLeft, FiPlus,
  FiDownload, FiFileText, FiTrash2, FiEdit2,
  FiExternalLink, FiX,
  FiEye, FiTrendingUp, FiChevronRight, FiMoreVertical,
  FiPackage, FiCoffee, FiTruck, FiAward, FiMapPin, FiCamera,
  FiLayers, FiBookOpen, FiGlobe, FiHeart, FiStar, FiGift, FiUsers
} from 'react-icons/fi';
import { db } from '../../../src/lib/firebase';
import { getAppAmount } from '../../../src/lib/paymentUtils';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore';
import AdminPagination from '../../../src/components/AdminPagination';
import AdminSearchFilterBar from '../../../src/components/AdminSearchFilterBar';

const parseFinanceDate = (val) => {
  if (!val) return 0;
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return val.seconds * 1000;
  }
  const ts = Date.parse(val);
  return Number.isNaN(ts) ? 0 : ts;
};

const getMonthNumber = (val) => {
  const ts = parseFinanceDate(val);
  if (!ts) return 0;
  return new Date(ts).getMonth() + 1; // 1..12
};

const matchesPeriod = (item, scope, programs = []) => {
  if (!scope || scope === 'all') return true;
  if (scope.startsWith('batch:')) {
    const targetId = scope.slice(6);
    if (targetId === 'general') {
      return !item.programId || item.programId === 'general';
    }
    const targetProg = programs.find(p => p.id === targetId);
    if (item.programId && item.programId === targetId) return true;
    if (targetProg && (item.programTitle === targetProg.title || item.title === targetProg.title)) return true;
    return false;
  }
  const m = getMonthNumber(item.date || item.createdAt);
  if (!m) return false;
  if (scope === 'q1') return m >= 1 && m <= 3;
  if (scope === 'q2') return m >= 4 && m <= 6;
  if (scope === 'q3') return m >= 7 && m <= 9;
  if (scope === 'q4') return m >= 10 && m <= 12;
  return true;
};

export default function AdminFinancePage() {
  const [activeTab, setActiveTab] = useState('outflow'); // 'outflow' | 'inflow'
  const [expenses, setExpenses] = useState([]);
  const [inflowTransactions, setInflowTransactions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [breakdownSort, setBreakdownSort] = useState('amount_desc'); // 'amount_desc' | 'amount_asc' | 'name_asc'
  const [hoveredCategory, setHoveredCategory] = useState(null);

  // Sorting & Filtering State for Expenses (Dana Keluar)
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expenseSortOrder, setExpenseSortOrder] = useState('date_desc'); // date_desc, date_asc, amount_desc, amount_asc, title_asc
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(10);

  // Sorting & Filtering State for Inflow (Dana Masuk)
  const [inflowSearch, setInflowSearch] = useState('');
  const [inflowTypeFilter, setInflowTypeFilter] = useState('all'); // all, program, donation
  const [inflowSortOrder, setInflowSortOrder] = useState('date_desc'); // date_desc, date_asc, amount_desc, amount_asc, name_asc
  const [inflowPage, setInflowPage] = useState(1);
  const [inflowPageSize, setInflowPageSize] = useState(10);

  // Modal State for Adding / Editing Expense
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'Logistik & Operasional',
    programId: '',
    programTitle: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    receiptUrl: '',
    notes: '',
    pic: ''
  });

  // Modal State for Editing Inflow Transaction
  const [isInflowModalOpen, setIsInflowModalOpen] = useState(false);
  const [editingInflow, setEditingInflow] = useState(null);
  const [isSubmittingInflow, setIsSubmittingInflow] = useState(false);
  const [inflowForm, setInflowForm] = useState({
    amount: '',
    sourceName: '',
    sourceContact: '',
    status: '',
    title: ''
  });

  // Modal State for Previewing Receipt
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [activeMenuFinanceId, setActiveMenuFinanceId] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeMenuFinanceId && !e.target.closest('.finance-action-menu-container')) {
        setActiveMenuFinanceId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuFinanceId]);

  // Fetch all financial data (applications with payments, donations, and expenses)
  const fetchFinanceData = async () => {
    setIsLoading(true);
    try {
      const [appsSnap, progsSnap, expensesSnap] = await Promise.all([
        getDocs(collection(db, 'applications')),
        getDocs(collection(db, 'programs')),
        getDocs(collection(db, 'expenses')).catch(() => ({ docs: [] }))
      ]);

      const progsList = progsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPrograms(progsList);

      const progMap = {};
      progsList.forEach(p => {
        progMap[p.id] = p.title || 'Program Tanpa Judul';
      });

      // 1. Process Inflow Transactions from applications
      const appsList = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const inflowList = [];

      appsList.forEach(app => {
        if (app.status !== 'Dibatalkan' && app.status !== 'Dikeluarkan') {
          const nominal = getAppAmount(app);
          if (nominal > 0 || app.isPaid || app.paymentProofUrl || app.paymentStatus === 'PAID') {
            inflowList.push({
              id: app.id,
              type: 'program',
              typeLabel: 'Pendaftaran Program',
              programId: app.programId || '',
              sourceName: app.userName || app.name || 'Relawan',
              sourceContact: app.userEmail || app.email || app.userPhone || '-',
              title: app.programTitle || progMap[app.programId] || 'Pendaftaran Relawan',
              amount: nominal,
              date: app.appliedAt || app.createdAt || new Date().toISOString(),
              status: (app.paymentStatus === 'PAID' || app.paymentProofUrl || app.isPaid) ? 'Lunas / Terverifikasi' : 'Menunggu',
              proofUrl: app.paymentProofUrl || ''
            });
          }
        }
      });

      setInflowTransactions(inflowList);

      // 2. Process Expenses (Outflow)
      const expensesList = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(expensesList);
    } catch (err) {
      console.error("Gagal mengambil data keuangan:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  // Open modal for adding a new expense
  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      title: '',
      category: 'Logistik & Operasional',
      programId: '',
      programTitle: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      receiptUrl: '',
      notes: '',
      pic: ''
    });
    setIsExpenseModalOpen(true);
  };

  // Open modal for editing an existing expense
  const handleOpenEditExpense = (item) => {
    setEditingExpense(item);
    setExpenseForm({
      title: item.title || '',
      category: item.category || 'Logistik & Operasional',
      programId: item.programId === 'general' ? '' : (item.programId || ''),
      programTitle: item.programTitle || '',
      amount: item.amount ? String(item.amount) : '',
      date: item.date || new Date().toISOString().split('T')[0],
      receiptUrl: item.receiptUrl || '',
      notes: item.notes || '',
      pic: item.pic || ''
    });
    setIsExpenseModalOpen(true);
  };

  // Submit New or Updated Expense
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.title.trim()) {
      alert('Judul pengeluaran wajib diisi.');
      return;
    }
    const nominal = Number(expenseForm.amount);
    if (isNaN(nominal) || nominal <= 0) {
      alert('Nominal pengeluaran harus berupa angka lebih dari 0.');
      return;
    }
    if (!expenseForm.receiptUrl.trim()) {
      alert('Bukti pengeluaran (link nota / kwitansi / struk / transfer) WAJIB disertakan.');
      return;
    }

    setIsSubmittingExpense(true);
    try {
      const selectedProg = programs.find(p => p.id === expenseForm.programId);
      const payload = {
        title: expenseForm.title.trim(),
        category: expenseForm.category,
        programId: expenseForm.programId || 'general',
        programTitle: selectedProg ? selectedProg.title : 'Operasional Umum Organisasi',
        amount: nominal,
        date: expenseForm.date || new Date().toISOString().split('T')[0],
        receiptUrl: expenseForm.receiptUrl.trim(),
        notes: expenseForm.notes.trim(),
        pic: expenseForm.pic.trim() || 'Admin Finansial',
      };

      if (editingExpense) {
        payload.updatedAt = new Date().toISOString();
        await updateDoc(doc(db, 'expenses', editingExpense.id), payload);
        setExpenses(prev => prev.map(e => e.id === editingExpense.id ? { ...e, ...payload } : e));
        setIsExpenseModalOpen(false);
        setEditingExpense(null);
        alert('Catatan pengeluaran berhasil diperbarui.');
      } else {
        payload.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, 'expenses'), payload);
        setExpenses(prev => [{ id: docRef.id, ...payload }, ...prev]);
        setIsExpenseModalOpen(false);
        alert('Pengeluaran berhasil dicatat dan diverifikasi bukti.');
      }

      setExpenseForm({
        title: '',
        category: 'Logistik & Operasional',
        programId: '',
        programTitle: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        receiptUrl: '',
        notes: '',
        pic: ''
      });
    } catch (err) {
      console.error("Gagal menyimpan pengeluaran:", err);
      alert("Terjadi kesalahan saat menyimpan pengeluaran.");
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Open modal for editing Inflow transaction
  const handleOpenEditInflow = (item) => {
    setEditingInflow(item);
    setInflowForm({
      amount: item.amount ? String(item.amount) : '0',
      sourceName: item.sourceName || '',
      sourceContact: item.sourceContact || '',
      status: item.status || 'Lunas / Terverifikasi',
      title: item.title || ''
    });
    setIsInflowModalOpen(true);
  };

  // Submit Inflow update
  const handleSaveInflow = async (e) => {
    e.preventDefault();
    if (!editingInflow) return;
    const nominal = Number(inflowForm.amount);
    if (isNaN(nominal) || nominal < 0) {
      alert('Nominal penerimaan dana harus berupa angka valid (minimal 0).');
      return;
    }

    setIsSubmittingInflow(true);
    try {
      const isPaidFlag = inflowForm.status.includes('Lunas') || inflowForm.status.includes('Terverifikasi') || nominal > 0;
      const updateData = {
        amount: nominal,
        isPaid: isPaidFlag,
        userName: inflowForm.sourceName.trim(),
        statusAudit: inflowForm.status
      };

      await updateDoc(doc(db, 'applications', editingInflow.id), updateData);

      setInflowTransactions(prev => prev.map(t => {
        if (t.id === editingInflow.id) {
          return {
            ...t,
            amount: nominal,
            sourceName: inflowForm.sourceName.trim(),
            status: inflowForm.status
          };
        }
        return t;
      }));

      setIsInflowModalOpen(false);
      setEditingInflow(null);
      alert('Data transaksi penerimaan berhasil diperbarui.');
    } catch (err) {
      console.error("Gagal memperbarui data penerimaan:", err);
      alert("Gagal memperbarui transaksi penerimaan.");
    } finally {
      setIsSubmittingInflow(false);
    }
  };

  // Delete Expense Handler
  const handleDeleteExpense = async (item) => {
    if (!confirm(`Hapus catatan pengeluaran "${item.title}" (Rp ${Number(item.amount).toLocaleString('id-ID')})? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'expenses', item.id));
      setExpenses(prev => prev.filter(e => e.id !== item.id));
      alert('Data pengeluaran berhasil dihapus.');
    } catch (err) {
      console.error("Gagal menghapus pengeluaran:", err);
      alert("Gagal menghapus data pengeluaran.");
    }
  };

  // Totals & Financial Metrics (filtered by selectedPeriod: Keseluruhan / 4 Kuartal / Per Batch)
  const totalInflow = useMemo(() => {
    return inflowTransactions
      .filter(curr => matchesPeriod(curr, selectedPeriod, programs))
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [inflowTransactions, selectedPeriod, programs]);

  const totalOutflow = useMemo(() => {
    return expenses
      .filter(curr => matchesPeriod(curr, selectedPeriod, programs))
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [expenses, selectedPeriod, programs]);

  const netBalance = totalInflow - totalOutflow;

  const periodScopeOptions = useMemo(() => [
    { value: 'all', label: 'Keseluruhan (Semua Data)' },
    { value: 'q1', label: 'Kuartal 1 (Jan - Mar)' },
    { value: 'q2', label: 'Kuartal 2 (Apr - Jun)' },
    { value: 'q3', label: 'Kuartal 3 (Jul - Sep)' },
    { value: 'q4', label: 'Kuartal 4 (Okt - Des)' },
    ...programs.map(p => ({ value: `batch:${p.id}`, label: `Batch: ${p.title}` })),
    { value: 'batch:general', label: 'Batch: Operasional Umum' }
  ], [programs]);

  // Filtered & Sorted Expenses
  const filteredExpenses = useMemo(() => {
    let list = [...expenses];

    if (selectedPeriod !== 'all') {
      list = list.filter(item => matchesPeriod(item, selectedPeriod, programs));
    }

    if (expenseSearch.trim()) {
      const q = expenseSearch.toLowerCase();
      list = list.filter(item =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.programTitle || '').toLowerCase().includes(q) ||
        (item.pic || '').toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q)
      );
    }

    if (expenseCategoryFilter !== 'all') {
      list = list.filter(item => item.category === expenseCategoryFilter);
    }

    // Sorting
    list.sort((a, b) => {
      if (expenseSortOrder === 'date_desc') {
        const diff = parseFinanceDate(b.date || b.createdAt) - parseFinanceDate(a.date || a.createdAt);
        return diff !== 0 ? diff : (Number(b.amount) || 0) - (Number(a.amount) || 0);
      }
      if (expenseSortOrder === 'date_asc') {
        const diff = parseFinanceDate(a.date || a.createdAt) - parseFinanceDate(b.date || b.createdAt);
        return diff !== 0 ? diff : (Number(a.amount) || 0) - (Number(b.amount) || 0);
      }
      if (expenseSortOrder === 'amount_desc') {
        return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      }
      if (expenseSortOrder === 'amount_asc') {
        return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      }
      if (expenseSortOrder === 'title_asc') {
        return (a.title || '').localeCompare(b.title || '', 'id-ID');
      }
      if (expenseSortOrder === 'title_desc') {
        return (b.title || '').localeCompare(a.title || '', 'id-ID');
      }
      return 0;
    });

    return list;
  }, [expenses, selectedPeriod, programs, expenseSearch, expenseCategoryFilter, expenseSortOrder]);

  // Filtered & Sorted Inflows
  const filteredInflows = useMemo(() => {
    let list = [...inflowTransactions];

    if (selectedPeriod !== 'all') {
      list = list.filter(item => matchesPeriod(item, selectedPeriod, programs));
    }

    if (inflowSearch.trim()) {
      const q = inflowSearch.toLowerCase();
      list = list.filter(item =>
        (item.sourceName || '').toLowerCase().includes(q) ||
        (item.sourceContact || '').toLowerCase().includes(q) ||
        (item.title || '').toLowerCase().includes(q)
      );
    }

    if (inflowTypeFilter !== 'all') {
      list = list.filter(item => item.type === inflowTypeFilter);
    }

    // Sorting
    list.sort((a, b) => {
      if (inflowSortOrder === 'date_desc') {
        const diff = parseFinanceDate(b.date) - parseFinanceDate(a.date);
        return diff !== 0 ? diff : (Number(b.amount) || 0) - (Number(a.amount) || 0);
      }
      if (inflowSortOrder === 'date_asc') {
        const diff = parseFinanceDate(a.date) - parseFinanceDate(b.date);
        return diff !== 0 ? diff : (Number(a.amount) || 0) - (Number(b.amount) || 0);
      }
      if (inflowSortOrder === 'amount_desc') {
        return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      }
      if (inflowSortOrder === 'amount_asc') {
        return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      }
      if (inflowSortOrder === 'name_asc') {
        return (a.sourceName || '').localeCompare(b.sourceName || '', 'id-ID');
      }
      if (inflowSortOrder === 'name_desc') {
        return (b.sourceName || '').localeCompare(a.sourceName || '', 'id-ID');
      }
      return 0;
    });

    return list;
  }, [inflowTransactions, selectedPeriod, programs, inflowSearch, inflowTypeFilter, inflowSortOrder]);

  const paginatedExpenses = useMemo(() => {
    const start = (expensePage - 1) * expensePageSize;
    return filteredExpenses.slice(start, start + expensePageSize);
  }, [filteredExpenses, expensePage, expensePageSize]);

  const paginatedInflows = useMemo(() => {
    const start = (inflowPage - 1) * inflowPageSize;
    return filteredInflows.slice(start, start + inflowPageSize);
  }, [filteredInflows, inflowPage, inflowPageSize]);

  // Helper to resolve dynamic SVG icon representing each category
  const getCategoryIcon = (categoryName) => {
    const lower = (categoryName || '').toLowerCase();
    if (lower.includes('logistik') || lower.includes('operasional') || lower.includes('perlengkapan')) return FiPackage;
    if (lower.includes('konsumsi') || lower.includes('makan') || lower.includes('minum')) return FiCoffee;
    if (lower.includes('transport') || lower.includes('bahan bakar') || lower.includes('bensin') || lower.includes('perjalanan')) return FiTruck;
    if (lower.includes('sertifikat') || lower.includes('id card') || lower.includes('merchandise') || lower.includes('atribut')) return FiAward;
    if (lower.includes('sewa') || lower.includes('lokasi') || lower.includes('tempat') || lower.includes('alat')) return FiMapPin;
    if (lower.includes('dokumentasi') || lower.includes('publikasi') || lower.includes('media') || lower.includes('foto')) return FiCamera;
    if (lower.includes('pendidikan') || lower.includes('nalar') || lower.includes('literasi') || lower.includes('kelas') || lower.includes('belajar')) return FiBookOpen;
    if (lower.includes('lingkungan') || lower.includes('alam') || lower.includes('bahari') || lower.includes('pohon')) return FiGlobe;
    if (lower.includes('lansia') || lower.includes('peduli') || lower.includes('cinta') || lower.includes('sosial') || lower.includes('kesehatan')) return FiHeart;
    if (lower.includes('kreativ') || lower.includes('inovatif') || lower.includes('seni')) return FiStar;
    if (lower.includes('donasi') || lower.includes('sponsor')) return FiGift;
    if (lower.includes('batch') || lower.includes('relawan') || lower.includes('pendaftaran') || lower.includes('kegiatan') || lower.includes('program')) return FiUsers;
    return FiLayers;
  };

  // Breakdown & Donut Chart Calculation (50/50 Circle Graph)
  const currentTotal = useMemo(() => {
    const source = activeTab === 'outflow' ? expenses : inflowTransactions;
    return source
      .filter(item => matchesPeriod(item, selectedPeriod, programs))
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [activeTab, expenses, inflowTransactions, selectedPeriod, programs]);

  const activeBreakdown = useMemo(() => {
    const catMap = {};
    const colors = [
      '#8B5CF6', // Ungu
      '#06B6D4', // Cyan
      '#233B69', // Navy
      '#F59E0B', // Amber / Emas
      '#10B981', // Emerald
      '#F43F5E', // Rose
      '#3B82F6'  // Blue
    ];

    if (activeTab === 'outflow') {
      expenses
        .filter(e => matchesPeriod(e, selectedPeriod, programs))
        .forEach(e => {
          const cat = e.category || 'Lainnya';
          const amt = Number(e.amount) || 0;
          catMap[cat] = (catMap[cat] || 0) + amt;
        });
    } else {
      inflowTransactions
        .filter(i => matchesPeriod(i, selectedPeriod, programs))
        .forEach(i => {
          const cat = i.title || i.typeLabel || 'Penerimaan Kegiatan';
          const amt = Number(i.amount) || 0;
          catMap[cat] = (catMap[cat] || 0) + amt;
        });
    }

    const rawTotal = Object.values(catMap).reduce((s, v) => s + v, 0);
    const total = rawTotal || 1;
    // Assign stable color by descending amount rank so sorting doesn't scramble category colors
    const sortedByAmountNames = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const entries = Object.entries(catMap).map(([name, amount]) => {
      const colorIdx = Math.max(0, sortedByAmountNames.indexOf(name));
      const fraction = rawTotal > 0 ? amount / rawTotal : 0;
      return {
        name,
        amount,
        fraction,
        percentage: rawTotal > 0 ? Math.max(1, Math.round((amount / total) * 100)) : 0,
        color: colors[colorIdx % colors.length],
        Icon: getCategoryIcon(name)
      };
    });

    entries.sort((a, b) => {
      if (breakdownSort === 'amount_asc') return a.amount - b.amount;
      if (breakdownSort === 'name_asc') return a.name.localeCompare(b.name, 'id-ID');
      return b.amount - a.amount;
    });

    return entries;
  }, [activeTab, expenses, inflowTransactions, selectedPeriod, programs, breakdownSort]);

  const donutRadius = 96;
  const donutCenter = 140;
  const donutViewBox = 280;
  const circumference = 2 * Math.PI * donutRadius;

  const donutSegments = useMemo(() => {
    let accumulatedFraction = 0;
    return activeBreakdown.map((item) => {
      const segFraction = item.fraction || 0;
      const segLength = segFraction * circumference;
      const strokeDasharray = `${segLength} ${circumference}`;
      const strokeDashoffset = -(accumulatedFraction * circumference);
      const midFraction = accumulatedFraction + segFraction / 2;
      // Angle in radians where 0 fraction starts at top (-PI/2) and moves clockwise
      const angleRad = midFraction * 2 * Math.PI - Math.PI / 2;
      const badgeX = donutCenter + donutRadius * Math.cos(angleRad);
      const badgeY = donutCenter + donutRadius * Math.sin(angleRad);
      const badgeLeftPct = (badgeX / donutViewBox) * 100;
      const badgeTopPct = (badgeY / donutViewBox) * 100;
      accumulatedFraction += segFraction;
      return {
        ...item,
        strokeDasharray,
        strokeDashoffset,
        badgeLeftPct,
        badgeTopPct,
        showBadge: segFraction >= 0.04 || activeBreakdown.length <= 4
      };
    });
  }, [activeBreakdown, circumference]);

  const hoveredItem = useMemo(() => {
    if (!hoveredCategory) return null;
    return activeBreakdown.find(item => item.name === hoveredCategory) || null;
  }, [hoveredCategory, activeBreakdown]);

  // Categories list for expenses
  const expenseCategories = [
    'Logistik & Operasional',
    'Konsumsi & Konsumsi Lapangan',
    'Transportasi & Bahan Bakar',
    'Sertifikat, Id Card & Merchandise',
    'Sewa Lokasi & Alat',
    'Dokumentasi & Publikasi',
    'Lainnya'
  ];

  // Export to CSV helper
  const handleExportCSV = () => {
    if (activeTab === 'outflow') {
      const headers = ['ID', 'Tanggal', 'Judul Pengeluaran', 'Kategori', 'Program Terkait', 'Nominal (Rp)', 'PIC', 'Link Bukti'];
      const rows = filteredExpenses.map(e => [
        `"${e.id}"`,
        `"${e.date || '-'}"`,
        `"${(e.title || '').replace(/"/g, '""')}"`,
        `"${e.category || '-'}"`,
        `"${(e.programTitle || '').replace(/"/g, '""')}"`,
        e.amount || 0,
        `"${e.pic || '-'}"`,
        `"${e.receiptUrl || '-'}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `laporan_pengeluaran_kas_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ['ID', 'Tanggal', 'Tipe', 'Nama Pengirim', 'Kontak', 'Keterangan / Program', 'Nominal (Rp)', 'Status'];
      const rows = filteredInflows.map(i => [
        `"${i.id}"`,
        `"${i.date ? new Date(i.date).toLocaleDateString('id-ID') : '-'}"`,
        `"${i.typeLabel || '-'}"`,
        `"${(i.sourceName || '').replace(/"/g, '""')}"`,
        `"${i.sourceContact || '-'}"`,
        `"${(i.title || '').replace(/"/g, '""')}"`,
        i.amount || 0,
        `"${i.status || '-'}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `laporan_dana_masuk_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="ue-eyebrow" style={{ marginBottom: '4px' }}>DIVISI KEUANGAN & ANGGARAN</div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Keuangan & Arus Kas
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleOpenAddExpense}
            className="ue-icon-btn"
            title="Catat Pengeluaran Kas Baru"
            aria-label="Catat Pengeluaran Kas Baru"
          >
            <FiPlus size={18} />
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="ue-icon-btn"
            title="Export CSV"
            aria-label="Export CSV"
          >
            <FiDownload size={16} />
          </button>
        </div>
      </div>

      {/* METRICS SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {/* Total Inflow */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Dana Masuk</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiArrowDownLeft size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#166534' }}>
            Rp {totalInflow.toLocaleString('id-ID')}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            {inflowTransactions.length} transaksi pendaftaran & donasi
          </p>
        </div>

        {/* Total Outflow */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Dana Keluar (Pengeluaran)</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiArrowUpRight size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626' }}>
            Rp {totalOutflow.toLocaleString('id-ID')}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            {expenses.length} pos pengeluaran berbukti
          </p>
        </div>

        {/* Net Cash Balance */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Saldo Kas Bersih</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: netBalance >= 0 ? '#eff6ff' : '#fff1f2', color: netBalance >= 0 ? '#2563eb' : '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiTrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: netBalance >= 0 ? '#2563eb' : '#e11d48' }}>
            Rp {netBalance.toLocaleString('id-ID')}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            Status: {netBalance >= 0 ? 'Surplus Operasional' : 'Defisit Anggaran'}
          </p>
        </div>
      </div>

      {/* 50/50 CIRCLE GRAPH & CASHFLOW SWITCH CARD */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '28px 32px',
          marginBottom: '28px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '36px',
            alignItems: 'center'
          }}
        >
          {/* SISI KIRI (50%): ENLARGED CIRCLE GRAPH / DONUT CHART WITH DYNAMIC CATEGORY SVG BADGES */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              minHeight: '340px'
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '300px',
                height: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              <svg viewBox="0 0 280 280" width="300" height="300" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
                <circle
                  cx="140"
                  cy="140"
                  r="96"
                  fill="transparent"
                  stroke="#F1F5F9"
                  strokeWidth="28"
                />
                {donutSegments.map((seg) => {
                  const isHovered = hoveredCategory === seg.name;
                  const isDimmed = hoveredCategory && !isHovered;
                  return (
                    <circle
                      key={seg.name}
                      cx="140"
                      cy="140"
                      r="96"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={isHovered ? '34' : '28'}
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      strokeLinecap={donutSegments.length > 1 ? 'butt' : 'round'}
                      onMouseEnter={() => setHoveredCategory(seg.name)}
                      style={{
                        transition: 'stroke-dasharray 0.45s cubic-bezier(0.22, 1, 0.36, 1), stroke-dashoffset 0.45s cubic-bezier(0.22, 1, 0.36, 1), stroke-width 0.25s ease, opacity 0.25s ease',
                        opacity: isDimmed ? 0.45 : 1,
                        cursor: 'pointer'
                      }}
                    />
                  );
                })}
              </svg>

              {/* Dynamic Floating Category SVG Badges on Donut Ring */}
              {donutSegments.map((seg) => {
                if (!seg.showBadge) return null;
                const SegIcon = seg.Icon || FiLayers;
                const isHovered = hoveredCategory === seg.name;
                return (
                  <button
                    key={seg.name}
                    type="button"
                    onMouseEnter={() => setHoveredCategory(seg.name)}
                    onFocus={() => setHoveredCategory(seg.name)}
                    onClick={() => setHoveredCategory(prev => prev === seg.name ? null : seg.name)}
                    title={`${seg.name} (${seg.percentage}%) — Rp ${Number(seg.amount).toLocaleString('id-ID')}`}
                    aria-label={`${seg.name} (${seg.percentage}%)`}
                    style={{
                      position: 'absolute',
                      left: `${seg.badgeLeftPct}%`,
                      top: `${seg.badgeTopPct}%`,
                      transform: `translate(-50%, -50%) scale(${isHovered ? 1.18 : 1})`,
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      boxShadow: isHovered
                        ? `0 6px 16px ${seg.color}55`
                        : '0 3px 10px rgba(15, 23, 42, 0.16)',
                      border: `2px solid ${isHovered ? seg.color : '#FFFFFF'}`,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: isHovered ? 5 : 2,
                      transition: 'left 0.45s cubic-bezier(0.22, 1, 0.36, 1), top 0.45s cubic-bezier(0.22, 1, 0.36, 1), transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease'
                    }}
                  >
                    <span
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: seg.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF'
                      }}
                    >
                      <SegIcon size={13} />
                    </span>
                  </button>
                );
              })}

              {/* Inside Donut Center Info */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  textAlign: 'center',
                  padding: '0 44px'
                }}
              >
                {hoveredItem ? (
                  <>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: hoveredItem.color,
                        background: `${hoveredItem.color}18`,
                        padding: '3px 9px',
                        borderRadius: '999px',
                        marginBottom: '6px'
                      }}
                    >
                      {hoveredItem.percentage}% Porsi
                    </span>
                    <span
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: '#0F172A',
                        lineHeight: 1.25,
                        maxWidth: '175px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {hoveredItem.name}
                    </span>
                    <span
                      style={{
                        fontSize: '20px',
                        fontWeight: 800,
                        color: '#0F172A',
                        marginTop: '6px',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      Rp {Number(hoveredItem.amount).toLocaleString('id-ID')}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748B', lineHeight: 1.2 }}>
                      Total {activeTab === 'outflow' ? 'Pengeluaran' : 'Pemasukan'}
                    </span>
                    <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#64748B', letterSpacing: '0.08em', marginTop: '6px' }}>
                      IDR
                    </span>
                    <span
                      style={{
                        fontSize: '23px',
                        fontWeight: 800,
                        color: activeTab === 'outflow' ? '#0F172A' : '#166534',
                        marginTop: '2px',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {Number(currentTotal).toLocaleString('id-ID')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* SISI KANAN (50%): SWITCH PENGELUARAN/PEMASUKAN & ENLARGED BREAKDOWN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            {/* SWITCH PENGELUARAN & PEMASUKAN */}
            <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('outflow');
                  setHoveredCategory(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: activeTab === 'outflow' ? '3px solid #233B69' : '3px solid transparent',
                  color: activeTab === 'outflow' ? '#233B69' : '#64748B',
                  fontWeight: activeTab === 'outflow' ? 700 : 500,
                  fontSize: '16px',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                  transition: 'all 0.15s ease'
                }}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('inflow');
                  setHoveredCategory(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: activeTab === 'inflow' ? '3px solid #233B69' : '3px solid transparent',
                  color: activeTab === 'inflow' ? '#233B69' : '#64748B',
                  fontWeight: activeTab === 'inflow' ? 700 : 500,
                  fontSize: '16px',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                  transition: 'all 0.15s ease'
                }}
              >
                Pemasukan
              </button>
            </div>

            {/* PERIODE & SORTING BREAKDOWN SELECTOR */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
              <select
                value={selectedPeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value);
                  setExpensePage(1);
                  setInflowPage(1);
                }}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <optgroup label="Keseluruhan">
                  <option value="all">Keseluruhan (Semua Periode & Batch)</option>
                </optgroup>
                <optgroup label="Per Kuartal (4 Kuartal)">
                  <option value="q1">Kuartal 1 (Jan - Mar)</option>
                  <option value="q2">Kuartal 2 (Apr - Jun)</option>
                  <option value="q3">Kuartal 3 (Jul - Sep)</option>
                  <option value="q4">Kuartal 4 (Okt - Des)</option>
                </optgroup>
                <optgroup label="Per Batch / Kegiatan">
                  {programs.map(p => (
                    <option key={p.id} value={`batch:${p.id}`}>
                      {p.title}
                    </option>
                  ))}
                  <option value="batch:general">Operasional Umum</option>
                </optgroup>
              </select>

              <select
                value={breakdownSort}
                onChange={(e) => setBreakdownSort(e.target.value)}
                title="Urutkan Rincian Kategori"
                style={{
                  height: '44px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  color: '#233B69',
                  fontWeight: 600,
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="amount_desc">Nominal Terbesar ↓</option>
                <option value="amount_asc">Nominal Terkecil ↑</option>
                <option value="name_asc">Kategori (A-Z)</option>
              </select>
            </div>

            {/* ENLARGED BREAKDOWN CATEGORY LIST (KETERANGAN) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '280px',
                overflowY: 'auto',
                paddingRight: '6px'
              }}
            >
              {activeBreakdown.length === 0 ? (
                <div style={{ fontSize: '14px', color: '#94A3B8', textAlign: 'center', padding: '24px' }}>
                  Belum ada data pada kategori ini.
                </div>
              ) : (
                activeBreakdown.map((item) => {
                  const ItemIcon = item.Icon || FiLayers;
                  const isHovered = hoveredCategory === item.name;
                  return (
                    <div
                      key={item.name}
                      onMouseEnter={() => setHoveredCategory(item.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '14px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: isHovered ? '#F8FAFC' : 'transparent',
                        border: `1px solid ${isHovered ? '#E2E8F0' : '#F1F5F9'}`,
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <span
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: `${item.color}18`,
                            color: item.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <ItemIcon size={16} />
                        </span>
                        <span
                          style={{
                            color: '#0F172A',
                            fontWeight: 600,
                            fontSize: '14px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {item.name}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            color: item.color,
                            background: `${item.color}14`,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontWeight: 700,
                            flexShrink: 0
                          }}
                        >
                          {item.percentage}%
                        </span>
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '14.5px',
                          color: '#0F172A',
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                          marginLeft: '12px'
                        }}
                      >
                        Rp {Number(item.amount).toLocaleString('id-ID')}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TAB CONTENT 1: OUTFLOW (PENGELUARAN) */}
      {activeTab === 'outflow' && (
        <div>
          {/* SEARCH, FILTER & SORTING BAR */}
          <AdminSearchFilterBar
            searchValue={expenseSearch}
            onSearchChange={(val) => {
              setExpenseSearch(val);
              setExpensePage(1);
            }}
            searchPlaceholder="Cari judul pengeluaran, PIC, atau catatan..."
            ariaLabel="Urutkan Kegiatan"
            title="Urutkan Kegiatan"
            style={{ marginBottom: '20px' }}
            sections={[
              {
                label: 'Cakupan (Kuartal / Batch / Keseluruhan)',
                value: selectedPeriod,
                onChange: (val) => {
                  setSelectedPeriod(val);
                  setExpensePage(1);
                  setInflowPage(1);
                },
                options: periodScopeOptions
              },
              {
                label: 'Kategori Pengeluaran',
                value: expenseCategoryFilter,
                onChange: (val) => {
                  setExpenseCategoryFilter(val);
                  setExpensePage(1);
                },
                options: [
                  { value: 'all', label: 'Semua Kategori' },
                  ...expenseCategories.map(c => ({ value: c, label: c }))
                ]
              },
              {
                label: 'Urutkan',
                value: expenseSortOrder,
                closeOnSelect: true,
                onChange: (val) => {
                  setExpenseSortOrder(val);
                  setExpensePage(1);
                },
                options: [
                  { value: 'date_desc', label: 'Tanggal Terbaru' },
                  { value: 'date_asc', label: 'Tanggal Terlama' },
                  { value: 'amount_desc', label: 'Nominal Terbesar' },
                  { value: 'amount_asc', label: 'Nominal Terkecil' },
                  { value: 'title_asc', label: 'Judul (A-Z)' },
                  { value: 'title_desc', label: 'Judul (Z-A)' }
                ]
              }
            ]}
          />

          {/* EXPENSES TABLE */}
          <div className="admin-table-card">
            <div className="admin-mobile-swipe-hint">
              <FiChevronRight size={14} /> Geser tabel ke kanan untuk melihat rincian nota & aksi
            </div>
            <div className="admin-table-responsive">
              <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
                    <th
                      onClick={() => {
                        setExpenseSortOrder(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc');
                        setExpensePage(1);
                      }}
                      style={{ padding: '14px 20px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      title="Klik untuk mengurutkan berdasarkan Tanggal"
                    >
                      Tanggal {expenseSortOrder === 'date_desc' ? '↓' : expenseSortOrder === 'date_asc' ? '↑' : '↕'}
                    </th>
                    <th
                      onClick={() => {
                        setExpenseSortOrder(prev => prev === 'title_asc' ? 'title_desc' : 'title_asc');
                        setExpensePage(1);
                      }}
                      style={{ padding: '14px 20px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      title="Klik untuk mengurutkan berdasarkan Judul Pengeluaran"
                    >
                      Pengeluaran & PIC {expenseSortOrder === 'title_asc' ? '↑' : expenseSortOrder === 'title_desc' ? '↓' : '↕'}
                    </th>
                    <th style={{ padding: '14px 20px' }}>Kategori & Program</th>
                    <th
                      onClick={() => {
                        setExpenseSortOrder(prev => prev === 'amount_desc' ? 'amount_asc' : 'amount_desc');
                        setExpensePage(1);
                      }}
                      style={{ padding: '14px 20px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      title="Klik untuk mengurutkan berdasarkan Nominal"
                    >
                      Nominal (Rp) {expenseSortOrder === 'amount_desc' ? '↓' : expenseSortOrder === 'amount_asc' ? '↑' : '↕'}
                    </th>
                    <th style={{ padding: '14px 20px', textAlign: 'center' }}>Bukti Nota / Struk</th>
                    <th style={{ padding: '14px 20px', textAlign: 'center' }} aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Memuat data pembukuan kas...</td></tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Belum ada catatan pengeluaran kas yang sesuai filter.</td></tr>
                  ) : (
                    paginatedExpenses.map((item, rowIndex) => {
                      const openMenuUpwards = paginatedExpenses.length > 2 && rowIndex >= paginatedExpenses.length - 2;
                      const menuKey = `out-${item.id}`;
                      const isMenuOpen = activeMenuFinanceId === menuKey;
                      return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 20px', whiteSpace: 'nowrap', color: '#64748B', fontSize: '12.5px' }}>
                          {item.date ? new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#0F172A' }}>{item.title}</div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                            PIC: {item.pic || 'Admin'} {item.notes && `• ${item.notes}`}
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span className="ue-pill ue-pill-neutral" style={{ fontSize: '11.5px', fontWeight: 500, marginBottom: '3px' }}>
                            {item.category}
                          </span>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>
                            {item.programTitle || 'Operasional Umum'}
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', fontWeight: 600, fontSize: '13.5px', color: '#DC2626', whiteSpace: 'nowrap' }}>
                          Rp {Number(item.amount).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {item.receiptUrl ? (
                            <button
                              type="button"
                              onClick={() => setReceiptPreview({ url: item.receiptUrl, title: item.title, amount: item.amount })}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                color: '#2563eb',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <FiEye size={12} />
                              Lihat Bukti
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Tanpa Bukti</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div className="finance-action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuFinanceId(isMenuOpen ? null : menuKey);
                              }}
                              className="ue-icon-btn"
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                borderColor: isMenuOpen ? '#233B69' : 'var(--card-border, #E2E8F0)',
                                background: isMenuOpen ? '#233B69' : 'var(--card-bg, #FFFFFF)',
                                color: isMenuOpen ? '#FFFFFF' : 'var(--primary, #233B69)'
                              }}
                              title="Menu Aksi"
                              aria-expanded={isMenuOpen}
                            >
                              <FiMoreVertical size={16} />
                            </button>

                            {isMenuOpen && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  ...(openMenuUpwards
                                    ? { bottom: 'calc(100% + 4px)', top: 'auto' }
                                    : { top: 'calc(100% + 4px)', bottom: 'auto' }),
                                  zIndex: 70,
                                  background: '#FFFFFF',
                                  borderRadius: '10px',
                                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
                                  border: '1px solid #E2E8F0',
                                  padding: '6px',
                                  minWidth: '165px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  textAlign: 'left'
                                }}
                              >
                                {item.receiptUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuFinanceId(null);
                                      setReceiptPreview({ url: item.receiptUrl, title: item.title, amount: item.amount });
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '8px 10px',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#233B69',
                                      fontSize: '12.5px',
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      width: '100%'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <FiEye size={14} />
                                    <span>Lihat Bukti Nota</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFinanceId(null);
                                    handleOpenEditExpense(item);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#0F172A',
                                    fontSize: '12.5px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <FiEdit2 size={14} style={{ color: '#2563EB' }} />
                                  <span>Edit Pengeluaran</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFinanceId(null);
                                    handleDeleteExpense(item);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#DC2626',
                                    fontSize: '12.5px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FEF2F2')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <FiTrash2 size={14} />
                                  <span>Hapus Pengeluaran</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <AdminPagination
              currentPage={expensePage}
              pageSize={expensePageSize}
              totalItems={filteredExpenses.length}
              onPageChange={setExpensePage}
              onPageSizeChange={setExpensePageSize}
              pageSizeOptions={[10, 50, 100]}
            />
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: INFLOW (DANA MASUK) */}
      {activeTab === 'inflow' && (
        <div>
          {/* SEARCH & SORTING BAR */}
          <AdminSearchFilterBar
            searchValue={inflowSearch}
            onSearchChange={(val) => {
              setInflowSearch(val);
              setInflowPage(1);
            }}
            searchPlaceholder="Cari nama relawan, email, program..."
            ariaLabel="Urutkan Kegiatan"
            title="Urutkan Kegiatan"
            style={{ marginBottom: '20px' }}
            sections={[
              {
                label: 'Cakupan (Kuartal / Batch / Keseluruhan)',
                value: selectedPeriod,
                onChange: (val) => {
                  setSelectedPeriod(val);
                  setExpensePage(1);
                  setInflowPage(1);
                },
                options: periodScopeOptions
              },
              {
                label: 'Tipe Penerimaan',
                value: inflowTypeFilter,
                onChange: (val) => {
                  setInflowTypeFilter(val);
                  setInflowPage(1);
                },
                options: [
                  { value: 'all', label: 'Semua Tipe Penerimaan' },
                  { value: 'program', label: 'Pendaftaran Program' },
                  { value: 'donation', label: 'Donasi' }
                ]
              },
              {
                label: 'Urutkan',
                value: inflowSortOrder,
                closeOnSelect: true,
                onChange: (val) => {
                  setInflowSortOrder(val);
                  setInflowPage(1);
                },
                options: [
                  { value: 'date_desc', label: 'Tanggal Terbaru' },
                  { value: 'date_asc', label: 'Tanggal Terlama' },
                  { value: 'amount_desc', label: 'Nominal Terbesar' },
                  { value: 'amount_asc', label: 'Nominal Terkecil' },
                  { value: 'name_asc', label: 'Nama Relawan (A-Z)' },
                  { value: 'name_desc', label: 'Nama Relawan (Z-A)' }
                ]
              }
            ]}
          />

          {/* INFLOW TABLE */}
          <div className="admin-table-card">
            <div className="admin-mobile-swipe-hint">
              <FiChevronRight size={14} /> Geser tabel ke kanan untuk melihat nominal & bukti bayar
            </div>
            <div className="admin-table-responsive">
              <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
                    <th
                      onClick={() => {
                        setInflowSortOrder(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc');
                        setInflowPage(1);
                      }}
                      style={{ padding: '14px 20px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      title="Klik untuk mengurutkan berdasarkan Tanggal"
                    >
                      Tanggal {inflowSortOrder === 'date_desc' ? '↓' : inflowSortOrder === 'date_asc' ? '↑' : '↕'}
                    </th>
                    <th
                      onClick={() => {
                        setInflowSortOrder(prev => prev === 'name_asc' ? 'name_desc' : 'name_asc');
                        setInflowPage(1);
                      }}
                      style={{ padding: '14px 20px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      title="Klik untuk mengurutkan berdasarkan Nama Relawan"
                    >
                      Relawan {inflowSortOrder === 'name_asc' ? '↑' : inflowSortOrder === 'name_desc' ? '↓' : '↕'}
                    </th>
                    <th style={{ padding: '14px 20px' }}>Tipe & Keterangan</th>
                    <th
                      onClick={() => {
                        setInflowSortOrder(prev => prev === 'amount_desc' ? 'amount_asc' : 'amount_desc');
                        setInflowPage(1);
                      }}
                      style={{ padding: '14px 20px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      title="Klik untuk mengurutkan berdasarkan Nominal"
                    >
                      Nominal (Rp) {inflowSortOrder === 'amount_desc' ? '↓' : inflowSortOrder === 'amount_asc' ? '↑' : '↕'}
                    </th>
                    <th style={{ padding: '14px 20px', textAlign: 'center' }}>Bukti Bayar</th>
                    <th style={{ padding: '14px 20px', textAlign: 'center' }} aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Memuat data penerimaan dana...</td></tr>
                  ) : filteredInflows.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Tidak ada data transaksi masuk yang sesuai filter.</td></tr>
                  ) : (
                    paginatedInflows.map((item, rowIndex) => {
                      const openMenuUpwards = paginatedInflows.length > 2 && rowIndex >= paginatedInflows.length - 2;
                      const menuKey = `in-${item.id}`;
                      const isMenuOpen = activeMenuFinanceId === menuKey;
                      return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 20px', whiteSpace: 'nowrap', color: '#64748B', fontSize: '12.5px' }}>
                          {item.date ? new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#0F172A' }}>{item.sourceName}</div>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>{item.sourceContact}</div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 500, background: '#eff6ff', color: '#1d4ed8', marginBottom: '3px' }}>
                            {item.typeLabel}
                          </span>
                          <div style={{ fontSize: '12.5px', color: '#334155', fontWeight: 500 }}>{item.title}</div>
                        </td>
                        <td style={{ padding: '14px 20px', fontWeight: 600, fontSize: '13.5px', color: '#166534', whiteSpace: 'nowrap' }}>
                          Rp {Number(item.amount).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {item.proofUrl ? (
                            <button
                              type="button"
                              onClick={() => setReceiptPreview({ url: item.proofUrl, title: `Bukti Pendaftaran - ${item.sourceName}`, amount: item.amount })}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                color: '#2563eb',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <FiEye size={12} />
                              Lihat Bukti
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Sistem / Gateway</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div className="finance-action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuFinanceId(isMenuOpen ? null : menuKey);
                              }}
                              className="ue-icon-btn"
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                borderColor: isMenuOpen ? '#233B69' : 'var(--card-border, #E2E8F0)',
                                background: isMenuOpen ? '#233B69' : 'var(--card-bg, #FFFFFF)',
                                color: isMenuOpen ? '#FFFFFF' : 'var(--primary, #233B69)'
                              }}
                              title="Menu Aksi"
                              aria-expanded={isMenuOpen}
                            >
                              <FiMoreVertical size={16} />
                            </button>

                            {isMenuOpen && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  ...(openMenuUpwards
                                    ? { bottom: 'calc(100% + 4px)', top: 'auto' }
                                    : { top: 'calc(100% + 4px)', bottom: 'auto' }),
                                  zIndex: 70,
                                  background: '#FFFFFF',
                                  borderRadius: '10px',
                                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
                                  border: '1px solid #E2E8F0',
                                  padding: '6px',
                                  minWidth: '165px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  textAlign: 'left'
                                }}
                              >
                                {item.proofUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuFinanceId(null);
                                      setReceiptPreview({ url: item.proofUrl, title: `Bukti Pendaftaran - ${item.sourceName}`, amount: item.amount });
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '8px 10px',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#233B69',
                                      fontSize: '12.5px',
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      width: '100%'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <FiEye size={14} />
                                    <span>Lihat Bukti Bayar</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFinanceId(null);
                                    handleOpenEditInflow(item);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#0F172A',
                                    fontSize: '12.5px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <FiEdit2 size={14} style={{ color: '#2563EB' }} />
                                  <span>Edit Transaksi</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <AdminPagination
              currentPage={inflowPage}
              pageSize={inflowPageSize}
              totalItems={filteredInflows.length}
              onPageChange={setInflowPage}
              onPageSizeChange={setInflowPageSize}
              pageSizeOptions={[10, 50, 100]}
            />
          </div>
        </div>
      )}

      {/* MODAL: CATAT PENGELUARAN BARU (WAJIB SERTAKAN BUKTI) */}
      {isExpenseModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="admin-modal-container" style={{ maxWidth: '560px' }}>
            <div className="admin-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  {editingExpense ? 'Edit Catatan Pengeluaran Kas' : 'Pencatatan Pengeluaran Kas'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  {editingExpense ? 'Perbarui rincian pos pengeluaran atau tautan bukti nota.' : 'Wajib menyertakan bukti nota / transfer untuk akuntabilitas organisasi.'}
                </p>
              </div>
              <button onClick={() => { setIsExpenseModalOpen(false); setEditingExpense(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '20px' }}>
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="admin-modal-body">
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Judul / Uraian Pengeluaran *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Konsumsi Relawan & Sewa Sound System"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div className="admin-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Kategori Pengeluaran *
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                  >
                    {expenseCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Program Terkait
                  </label>
                  <select
                    value={expenseForm.programId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, programId: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                  >
                    <option value="">Operasional Umum</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Nominal Pengeluaran (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    placeholder="Contoh: 250000"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Tanggal Pengeluaran *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Link / URL Bukti Kwitansi / Struk / Nota (Wajib) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/... atau link foto bukti nota"
                  value={expenseForm.receiptUrl}
                  onChange={(e) => setExpenseForm({ ...expenseForm, receiptUrl: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Sertakan tautan Google Drive / Cloudinary / Imgur bukti transaksi fisik.
                </span>
              </div>

              <div className="admin-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    PIC / Penanggung Jawab
                  </label>
                  <input
                    type="text"
                    placeholder="Nama PIC"
                    value={expenseForm.pic}
                    onChange={(e) => setExpenseForm({ ...expenseForm, pic: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Catatan Tambahan
                  </label>
                  <input
                    type="text"
                    placeholder="Opsional (cth: Toko X)"
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setIsExpenseModalOpen(false); setEditingExpense(null); }}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: isSubmittingExpense ? 0.7 : 1 }}
                >
                  {isSubmittingExpense ? 'Menyimpan...' : editingExpense ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TRANSAKSI PENERIMAAN / DANA MASUK */}
      {isInflowModalOpen && editingInflow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="admin-modal-container" style={{ maxWidth: '520px' }}>
            <div className="admin-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Edit Transaksi Penerimaan Kas</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Perbarui nominal atau verifikasi status pembayaran pendaftaran/donasi.</p>
              </div>
              <button onClick={() => { setIsInflowModalOpen(false); setEditingInflow(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '20px' }}>
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSaveInflow} className="admin-modal-body">
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Keterangan / Program
                </label>
                <input
                  type="text"
                  disabled
                  value={inflowForm.title}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div className="admin-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Nama Pembayar / Relawan *
                  </label>
                  <input
                    type="text"
                    required
                    value={inflowForm.sourceName}
                    onChange={(e) => setInflowForm({ ...inflowForm, sourceName: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Kontak
                  </label>
                  <input
                    type="text"
                    disabled
                    value={inflowForm.sourceContact}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Nominal Dana Masuk (Rp) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="Contoh: 25000"
                  value={inflowForm.amount}
                  onChange={(e) => setInflowForm({ ...inflowForm, amount: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setIsInflowModalOpen(false); setEditingInflow(null); }}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInflow}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: isSubmittingInflow ? 0.7 : 1 }}
                >
                  {isSubmittingInflow ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW BUKTI KWITANSI / NOTA */}
      {receiptPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '640px', width: '100%', padding: '24px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{receiptPreview.title}</h4>
                <div style={{ fontSize: '12px', color: '#166534', fontWeight: 700, marginTop: '2px' }}>
                  Nominal: Rp {Number(receiptPreview.amount).toLocaleString('id-ID')}
                </div>
              </div>
              <button onClick={() => setReceiptPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <FiX size={20} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', textAlign: 'center', minHeight: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {receiptPreview.url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || receiptPreview.url.includes('googleusercontent.com') || receiptPreview.url.includes('cloudinary.com') ? (
                <img
                  src={receiptPreview.url}
                  alt="Bukti Transaksi"
                  style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '8px' }}
                />
              ) : (
                <div>
                  <FiFileText size={48} color="#94a3b8" style={{ marginBottom: '12px' }} />
                  <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569' }}>
                    Tautan bukti dokumen terlampir dalam bentuk berkas eksternal.
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a
                href={receiptPreview.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#2563eb',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                <FiExternalLink size={14} /> Buka Bukti di Tab Baru
              </a>
              <button
                onClick={() => setReceiptPreview(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
