'use client';
export const runtime = 'edge';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  FiArrowLeft, FiCheck, FiDownload, FiMessageCircle, 
  FiUpload, FiTag, FiMapPin
} from 'react-icons/fi';
import { db } from '../../../../src/lib/firebase';
import { doc, getDoc, getDocs, collection, query, where, addDoc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../../../../src/context/AuthContext';
import { getCachedProgramDetail, clearCache } from '../../../../src/lib/dataService';
import { formatDateDDMMYYYY } from '../../../../src/lib/dateUtils';
import Image from 'next/image';

const getValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return 'https://picsum.photos/seed/fallback/800/600';
  const trimmed = url.trim();
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      return 'https://picsum.photos/seed/fallback/800/600';
    }
  }
  return 'https://picsum.photos/seed/fallback/800/600';
};

// Available Referral / Promo Codes
const PROMO_CODES = {
  'UNTUKESOK2026': {
    code: 'UNTUKESOK2026',
    discount: 25000,
    title: 'Diskon Spesial Untuk Esok'
  },
  'RELASIESOK': {
    code: 'RELASIESOK',
    discount: 10000,
    title: 'Diskon Relasi Esok'
  },
  'VOLUNTEER2026': {
    code: 'VOLUNTEER2026',
    discount: 15000,
    title: 'Diskon Komunitas Relawan'
  }
};

// Helper to calculate exact admin/service fee (Cost-Passing ke Peserta)
function calculatePaymentFee(method, price) {
  const numPrice = Number(price) || 0;
  if (numPrice <= 0) return 0;

  switch (method) {
    case 'qris':
      // QRIS: 0.7% (sudah termasuk PPN)
      return Math.round(numPrice * 0.007);
    case 'bca_va':
    case 'echannel':
    case 'bni_va':
    case 'bri_va':
    case 'bank_transfer':
      // Bank VA: Rp 4.000 + PPN 11% (Rp 440) = Rp 4.440
      return 4000 + Math.round(4000 * 0.11);
    case 'credit_card':
      // Kartu Kredit: 2.9% + Rp 2.000 (+ PPN 11% dari fee transaksi)
      const baseFee = (numPrice * 0.029) + 2000;
      return Math.round(baseFee * 1.11);
    case 'all':
    default:
      // Default QRIS 0.7%
      return Math.round(numPrice * 0.007);
  }
}

// Payment Option Cards with Visual Brand Badges
const paymentMethodCards = [
  {
    id: 'qris',
    title: 'E-Wallet & QRIS',
    feeNote: 'Biaya Layanan: 0,7%',
    badges: [
      { name: 'BCA', bg: '#003d79', color: '#ffffff', text: 'BCA' },
      { name: 'GoPay', bg: '#00aed6', color: '#ffffff', text: 'gopay' },
      { name: 'ShopeePay', bg: '#ee4d2d', color: '#ffffff', text: 'SPay' },
      { name: 'QRIS', bg: '#1f2937', color: '#ffffff', text: 'QRIS' }
    ]
  },
  {
    id: 'credit_card',
    title: 'Credit/Debit Card',
    feeNote: 'Biaya Layanan: 2,9% + Rp 2.220',
    badges: [
      { name: 'Mastercard', bg: '#eb001b', color: '#ffffff', text: 'MC' },
      { name: 'VISA', bg: '#1a1f71', color: '#ffffff', text: 'VISA' },
      { name: 'JCB', bg: '#003399', color: '#ffffff', text: 'JCB' },
      { name: 'GPN', bg: '#b91c1c', color: '#ffffff', text: 'GPN' }
    ]
  },
  {
    id: 'bca_va',
    title: 'BCA Virtual Account',
    feeNote: 'Biaya Layanan: Rp 4.440 (inc. PPN)',
    badges: [
      { name: 'BCA', bg: '#003d79', color: '#ffffff', text: 'BCA' },
      { name: 'm-BCA', bg: '#005baa', color: '#ffffff', text: 'm-BCA' },
      { name: 'myBCA', bg: '#0284c7', color: '#ffffff', text: 'myBCA' },
      { name: 'VA', bg: '#1e3a8a', color: '#ffffff', text: 'VA' }
    ]
  },
  {
    id: 'echannel',
    title: 'Bank VA Lainnya',
    feeNote: 'Biaya Layanan: Rp 4.440 (inc. PPN)',
    badges: [
      { name: 'Mandiri', bg: '#003366', color: '#f59e0b', text: 'Mandiri' },
      { name: 'BRI', bg: '#00529c', color: '#ffffff', text: 'BRI' },
      { name: 'BNI', bg: '#ea580c', color: '#ffffff', text: 'BNI' },
      { name: 'ATM', bg: '#334155', color: '#ffffff', text: 'ATM' }
    ]
  }
];

const DEFAULT_INVITED_TEMPLATE_URL = 'https://drive.google.com/uc?export=download&id=1yQfWclvk-RElicJN-Bx8_heQhFXpZ8iy';

export default function InvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [program, setProgram] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Multi-step state (Step 1: Persyaratan Relawan / Bukti Upload, Step 2: Pembayaran Midtrans)
  const [currentStep, setCurrentStep] = useState(1);

  // Quest Proof States
  const [storyProof, setStoryProof] = useState(null);
  const [storyProofPreview, setStoryProofPreview] = useState(null);
  const [igProof, setIgProof] = useState(null);
  const [igProofPreview, setIgProofPreview] = useState(null);

  // Referral / Promo Code States
  const [referralInput, setReferralInput] = useState('');
  const [appliedReferral, setAppliedReferral] = useState(null);
  const [referralError, setReferralError] = useState('');
  const [referralSuccessMsg, setReferralSuccessMsg] = useState('');

  // Payment States
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('qris');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [existingCancelAppId, setExistingCancelAppId] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);

  // Preload Midtrans Snap Script
  const loadSnapScript = () => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.snap) {
        resolve(true);
        return;
      }
      const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '';
      const isProd = process.env.NODE_ENV === 'production' && !clientKey.startsWith('SB-');
      const script = document.createElement('script');
      script.src = isProd
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js';
      script.setAttribute('data-client-key', clientKey);
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    loadSnapScript();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!id) return;
      try {
        const progData = await getCachedProgramDetail(id);

        if (isMounted && progData) {
          setProgram(progData);
        }

        // Check user application status if logged in
        if (user && isMounted) {
          try {
            const actualProgId = progData ? progData.id : id;
            const q = query(
              collection(db, 'applications'),
              where('userId', '==', user.uid),
              where('programId', '==', actualProgId)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty && isMounted) {
              const activeApp = querySnapshot.docs.find(d => d.data().status !== 'Dibatalkan');
              if (activeApp) {
                const appData = activeApp.data();
                setIsVerified(true);
                setStoryProof({ name: 'Terverifikasi' });
                setIgProof({ name: 'Terverifikasi' });
                setPaymentDetails({
                  orderId: appData.orderId || `PROG-${activeApp.id.substring(0, 8).toUpperCase()}`,
                  paidAt: appData.paidAt || appData.appliedAt,
                  amount: appData.amount || 0,
                  adminFee: appData.adminFee || 0,
                  ticketPrice: appData.ticketPrice || appData.amount || 0,
                  discountAmount: appData.discountAmount || 0,
                  promoCode: appData.promoCode || '',
                  isPaid: appData.isPaid || false,
                  paymentMethod: appData.paymentMethod || 'Midtrans Gateway'
                });
              } else {
                setExistingCancelAppId(querySnapshot.docs[0].id);
              }
            }
          } catch (appErr) {
            console.warn("Error checking user application:", appErr);
          }
        }
      } catch (error) {
        console.error("Error fetching program data:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [id, user]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (storyProofPreview && storyProofPreview.startsWith('blob:')) {
        URL.revokeObjectURL(storyProofPreview);
      }
      if (igProofPreview && igProofPreview.startsWith('blob:')) {
        URL.revokeObjectURL(igProofPreview);
      }
    };
  }, [storyProofPreview, igProofPreview]);

  const isProgramFree = !program?.isPaid || Number(program?.price || 0) <= 0;
  const ticketPrice = isProgramFree ? 0 : Number(program?.price || 0);
  const isPaidProgram = !isProgramFree;

  // Referral discount calculation
  const discountAmount = (isPaidProgram && appliedReferral) ? Math.min(appliedReferral.discount, ticketPrice) : 0;
  const discountedPrice = Math.max(0, ticketPrice - discountAmount);

  const currentAdminFee = useMemo(() => {
    if (!isPaidProgram || discountedPrice <= 0) return 0;
    return calculatePaymentFee(selectedPaymentMethod, discountedPrice);
  }, [isPaidProgram, selectedPaymentMethod, discountedPrice]);

  const totalPayment = discountedPrice + currentAdminFee;

  // Handle Apply Referral Code
  const handleApplyReferral = (e) => {
    e?.preventDefault?.();
    setReferralError('');
    setReferralSuccessMsg('');
    const cleanCode = referralInput.trim().toUpperCase();

    if (!cleanCode) {
      setReferralError('Silakan masukkan kode referal.');
      return;
    }

    const matched = PROMO_CODES[cleanCode];
    if (matched) {
      setAppliedReferral(matched);
      setReferralSuccessMsg(`Kode referal ${matched.code} berhasil digunakan!`);
      setReferralError('');
    } else {
      setReferralError('Kode referal tidak valid atau sudah kedaluwarsa.');
    }
  };

  // Handle Remove Referral Code
  const handleRemoveReferral = () => {
    setAppliedReferral(null);
    setReferralInput('');
    setReferralError('');
    setReferralSuccessMsg('');
  };

  // Helper to convert File to compressed base64
  const fileToBase64 = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(event.target.result);
      };
      reader.onerror = () => resolve('');
    });
  };

  // Upload single image to Cloudinary via server API
  const uploadImageToServer = async (file, userName, appliedAt, type) => {
    if (!file || !(file instanceof File)) return '';
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch('/api/upload-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          userName,
          appliedAt,
          type
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.secure_url) {
          return data.secure_url;
        }
      }
      return '';
    } catch (err) {
      console.error(`Error uploading ${type}:`, err);
      return '';
    }
  };

  // Record Application in Firestore
  const recordApplication = async (paymentMeta = null) => {
    let userName = user.displayName || 'Relawan';
    let userPhone = '';
    let userEmail = user.email || '';

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.name) userName = userData.name;
        if (userData.phone) userPhone = userData.phone;
        if (userData.email) userEmail = userData.email;
      }
    } catch (err) {
      console.warn("Failed to fetch user profile", err);
    }

    const selectedOpt = paymentMethodCards.find(o => o.id === selectedPaymentMethod);
    const methodLabel = isPaidProgram ? (selectedOpt?.title || paymentMeta?.paymentMethod || 'Midtrans Gateway') : 'Gratis';
    const finalAmount = isPaidProgram ? (paymentMeta?.totalAmount || totalPayment) : 0;
    const finalAdminFee = isPaidProgram ? (paymentMeta?.adminFee ?? currentAdminFee) : 0;
    const nowIso = new Date().toISOString();
    const targetProgId = program?.id || id;

    const appPayload = {
      userId: user.uid,
      userName: userName,
      userPhone: userPhone,
      userEmail: userEmail,
      programId: targetProgId,
      programTitle: program.title,
      programImageUrl: program.imageUrl,
      programDate: program.date,
      programLocation: program.location,
      status: 'Terdaftar',
      isPaid: isPaidProgram,
      ticketPrice: ticketPrice,
      discountAmount: discountAmount,
      promoCode: appliedReferral ? appliedReferral.code : '',
      adminFee: finalAdminFee,
      amount: finalAmount,
      paymentStatus: isPaidProgram ? 'PAID' : 'FREE',
      paymentMethod: methodLabel,
      orderId: paymentMeta?.orderId || (isPaidProgram ? `PROG-${Date.now()}` : `FREE-${Date.now()}`),
      paidAt: nowIso,
      appliedAt: nowIso,
      storyProofUrl: paymentMeta?.storyProofUrl || '',
      igProofUrl: paymentMeta?.igProofUrl || ''
    };

    // Double-submit prevention
    const qCheck = query(
      collection(db, 'applications'),
      where('userId', '==', user.uid),
      where('programId', '==', targetProgId)
    );
    const existingAppsSnap = await getDocs(qCheck);
    const alreadyActive = existingAppsSnap.docs.find(d => d.data().status !== 'Dibatalkan');
    if (alreadyActive && !existingCancelAppId) {
      const appData = alreadyActive.data();
      setPaymentDetails({
        orderId: appData.orderId || `PROG-${alreadyActive.id.substring(0, 8).toUpperCase()}`,
        paidAt: appData.paidAt || appData.appliedAt,
        amount: appData.amount || 0,
        ticketPrice: appData.ticketPrice || appData.amount || 0,
        discountAmount: appData.discountAmount || 0,
        promoCode: appData.promoCode || '',
        adminFee: appData.adminFee || 0,
        isPaid: appData.isPaid || false,
        paymentMethod: appData.paymentMethod || methodLabel
      });
      setIsVerified(true);
      return;
    }

    if (existingCancelAppId) {
      await updateDoc(doc(db, 'applications', existingCancelAppId), {
        ...appPayload,
        cancelReason: '',
        canceledAt: ''
      });
    } else {
      await addDoc(collection(db, 'applications'), appPayload);
    }

    // Increment volunteersJoined count in programs collection
    await updateDoc(doc(db, 'programs', targetProgId), {
      volunteersJoined: increment(1)
    });
    clearCache('programs');

    setProgram(prev => ({ ...prev, volunteersJoined: (prev?.volunteersJoined || 0) + 1 }));
    setPaymentDetails({
      orderId: appPayload.orderId,
      paidAt: appPayload.paidAt,
      amount: finalAmount,
      ticketPrice: ticketPrice,
      discountAmount: discountAmount,
      promoCode: appliedReferral ? appliedReferral.code : '',
      adminFee: finalAdminFee,
      isPaid: isPaidProgram,
      paymentMethod: methodLabel
    });
    setIsVerified(true);
  };

  // Handle Free Program Registration Verification
  const handleVerifyFree = async () => {
    if (isVerifying) return;

    if (!user) {
      alert("Silakan masuk (login) ke akun Anda terlebih dahulu untuk memverifikasi pendaftaran.");
      router.push('/akun');
      return;
    }

    if (!storyProof || !igProof) {
      alert("Harap selesaikan kedua persyaratan pendaftaran di bawah terlebih dahulu!");
      return;
    }

    setIsVerifying(true);
    const targetProgId = program?.id || id;

    // Re-check quota from Firestore to prevent race conditions
    try {
      const freshProgDoc = await getDoc(doc(db, 'programs', targetProgId));
      if (freshProgDoc.exists()) {
        const freshData = freshProgDoc.data();
        if (freshData.volunteersJoined >= freshData.volunteersTarget) {
          setProgram(prev => ({ ...prev, volunteersJoined: freshData.volunteersJoined, volunteersTarget: freshData.volunteersTarget }));
          alert("Maaf, kuota pendaftaran untuk kegiatan ini sudah penuh. Pendaftaran ditutup.");
          setIsVerifying(false);
          return;
        }
      }
    } catch (quotaCheckErr) {
      console.warn("Error re-checking quota:", quotaCheckErr);
    }

    try {
      let storyProofUrl = '';
      let igProofUrl = '';

      if (storyProof && storyProof instanceof File) {
        storyProofUrl = await uploadImageToServer(storyProof, user.displayName || 'relawan', new Date().toISOString(), 'bukti_story');
      }
      if (igProof && igProof instanceof File) {
        igProofUrl = await uploadImageToServer(igProof, user.displayName || 'relawan', new Date().toISOString(), 'bukti_follow');
      }

      await recordApplication({
        storyProofUrl,
        igProofUrl
      });
    } catch (error) {
      console.error("Gagal melakukan verifikasi:", error);
      alert("Terjadi kesalahan saat memverifikasi pendaftaran. Silakan coba lagi.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Proceed to Payment Step (Step 1 -> Step 2)
  const handleProceedToPayment = () => {
    if (!user) {
      alert("Silakan masuk (login) ke akun Anda terlebih dahulu.");
      router.push('/akun');
      return;
    }

    if (!storyProof) {
      alert("Harap unggah bukti screenshot bahwa Anda telah mengunggah 'You're invited to' di Story IG & tag @untukesok.");
      return;
    }

    if (!igProof) {
      alert("Harap unggah bukti screenshot bahwa Anda telah follow Instagram @untukesok.");
      return;
    }

    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle Midtrans Online Payment (Step 2)
  const handlePayMidtrans = async () => {
    if (isVerifying) return;

    if (!user) {
      alert("Silakan masuk (login) ke akun Anda terlebih dahulu untuk melanjutkan pembayaran.");
      router.push('/akun');
      return;
    }

    setIsVerifying(true);
    try {
      // If 100% discounted (free via referral)
      if (discountedPrice <= 0) {
        let storyProofUrl = '';
        let igProofUrl = '';
        try {
          if (storyProof && storyProof instanceof File) {
            storyProofUrl = await uploadImageToServer(storyProof, user.displayName || 'relawan', new Date().toISOString(), 'bukti_story');
          }
          if (igProof && igProof instanceof File) {
            igProofUrl = await uploadImageToServer(igProof, user.displayName || 'relawan', new Date().toISOString(), 'bukti_follow');
          }
        } catch (upErr) {
          console.warn("Upload proof error:", upErr);
        }

        await recordApplication({
          orderId: `FREE-${Date.now()}`,
          adminFee: 0,
          totalAmount: 0,
          storyProofUrl,
          igProofUrl
        });
        setIsVerifying(false);
        return;
      }

      await loadSnapScript();

      let userName = user.displayName || 'Peserta';
      let userPhone = '';
      let userEmail = user.email || '';

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.name) userName = userData.name;
          if (userData.phone) userPhone = userData.phone;
          if (userData.email) userEmail = userData.email;
        }
      } catch (err) {
        console.warn("User fetch profile error:", err);
      }

      const response = await fetch('/api/payment/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: program?.id || id,
          programTitle: program.title,
          price: discountedPrice,
          userEmail: userEmail,
          userName: userName,
          userPhone: userPhone,
          userId: user.uid,
          paymentMethod: selectedPaymentMethod,
          promoCode: appliedReferral ? appliedReferral.code : ''
        })
      });

      const data = await response.json();

      if (!response.ok || !data.token) {
        alert(data.error || 'Gagal membuat sesi pembayaran Midtrans. Silakan coba lagi.');
        setIsVerifying(false);
        return;
      }

      if (typeof window !== 'undefined' && window.snap) {
        window.snap.pay(data.token, {
          onSuccess: async function (result) {
            console.log('Midtrans payment success:', result);

            // Upload proof images to cloud
            let storyProofUrl = '';
            let igProofUrl = '';
            try {
              if (storyProof && storyProof instanceof File) {
                storyProofUrl = await uploadImageToServer(storyProof, userName, new Date().toISOString(), 'bukti_story');
              }
              if (igProof && igProof instanceof File) {
                igProofUrl = await uploadImageToServer(igProof, userName, new Date().toISOString(), 'bukti_follow');
              }
            } catch (upErr) {
              console.warn("Upload proof during payment error:", upErr);
            }

            await recordApplication({
              orderId: data.orderId || result.order_id,
              adminFee: data.adminFee,
              totalAmount: data.totalAmount,
              storyProofUrl,
              igProofUrl
            });
            setIsVerifying(false);
          },
          onPending: function (result) {
            console.log('Midtrans payment pending:', result);
            alert('Pembayaran Anda sedang diproses. Silakan selesaikan pembayaran sesuai instruksi.');
            setIsVerifying(false);
          },
          onError: function (result) {
            console.error('Midtrans payment error:', result);
            alert('Terjadi kesalahan pembayaran. Silakan coba lagi.');
            setIsVerifying(false);
          },
          onClose: function () {
            setIsVerifying(false);
          }
        });
      } else {
        alert("Modul pembayaran Midtrans sedang dimuat. Harap muat ulang halaman.");
        setIsVerifying(false);
      }
    } catch (err) {
      console.error("Payment initiation error:", err);
      alert("Terjadi kesalahan saat memproses pembayaran.");
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="home-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ fontSize: '13.5px', color: '#64748b' }}>Memuat status pendaftaran...</p>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="home-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-bold)' }}>Kegiatan tidak ditemukan.</p>
        <button onClick={() => router.push('/')} style={{ marginTop: '14px', padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '13px', cursor: 'pointer' }}>
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const isQuestCompleted = Boolean(storyProof) && Boolean(igProof);
  const waLink = program.whatsappGroupLink || 'https://chat.whatsapp.com/';
  const isFull = program.volunteersJoined >= program.volunteersTarget;

  return (
    <div className="home-content" style={{ paddingBottom: isVerified ? '40px' : '120px', background: isVerified ? '#ffffff' : undefined, minHeight: '100vh' }}>
      {/* TOP NAVBAR */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '60px', zIndex: 1000,
        background: isVerified ? '#ffffff' : 'var(--bg)', display: 'flex', alignItems: 'center', padding: '0 24px',
        borderBottom: '1px solid var(--card-border)', boxShadow: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => {
              if (currentStep === 2) {
                setCurrentStep(1);
              } else {
                router.push(`/kegiatan/${id}`);
              }
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', padding: '4px' }}
            aria-label="Kembali"
          >
            <FiArrowLeft size={19} />
          </button>
          <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-poppins)', color: 'var(--text)' }}>
            {isVerified 
              ? 'Konfirmasi Pendaftaran' 
              : currentStep === 2 
                ? 'Commitment Fee' 
                : 'Pendaftaran'}
          </span>
        </div>
      </div>

      <div style={{
        marginTop: isVerified ? '60px' : '80px',
        padding: !isVerified ? '0 20px 140px' : '0 16px',
        maxWidth: '520px',
        margin: isVerified ? '60px auto 0' : '80px auto 0'
      }}>
        
        {/* ========================================================================= */}
        {/* ── PAYMENT SUCCESSFUL / CONFIRMATION FULLSCREEN VIEW ── */}
        {/* ========================================================================= */}
        {isVerified ? (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '0px',
              border: 'none',
              boxShadow: 'none',
              position: 'relative',
              textAlign: 'center',
              paddingTop: '16px'
            }}
          >
            {/* Top Honeycomb / Organic Mesh Background */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '180px',
              background: 'radial-gradient(ellipse at top, #f0fdf4 0%, #f8fafc 65%, #ffffff 100%)',
              zIndex: 0
            }}>
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.25 }}>
                <defs>
                  <pattern id="hex-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path d="M14 0 L28 8 L28 24 L14 32 L0 24 L0 8 Z" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hex-grid)" />
              </svg>
            </div>

            <div style={{ position: 'relative', zIndex: 1, padding: '24px 0 24px' }}>
              {/* Layered Blue Success Icon Badge */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <div style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  background: 'rgba(30, 58, 95, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(30, 58, 95, 0.16)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: '#1e3a5f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'none'
                    }}>
                      <FiCheck size={22} color="#ffffff" strokeWidth={3.5} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Subtitle */}
              <h2 style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#1e3a5f',
                margin: '0 0 12px 0',
                textAlign: 'center',
                letterSpacing: '0.4px'
              }}>
                PENDAFTARAN BERHASIL!
              </h2>
              <p style={{
                fontSize: '12px',
                color: '#64748b',
                margin: '0 auto 18px',
                maxWidth: '340px',
                lineHeight: 1.5
              }}>
                Terima kasih telah mendaftar. Bukti berkas dan pembayaran telah diterima dan slot partisipasimu telah berhasil diamankan.
              </p>

              {/* Order Summary Ticket Stub */}
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                marginBottom: '18px',
                textAlign: 'left'
              }}>
                <div style={{ padding: '14px 18px 10px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#1b4332', margin: 0 }}>
                    Ringkasan Pendaftaran
                  </h3>
                </div>

                {/* Perforated Divider */}
                <div style={{
                  position: 'relative',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '-8px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#f9fafb',
                    borderRight: '1px solid #e5e7eb'
                  }} />
                  <div style={{
                    width: '100%',
                    height: '1px',
                    borderTop: '1.5px dashed #cbd5e1'
                  }} />
                  <div style={{
                    position: 'absolute',
                    right: '-8px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#f9fafb',
                    borderLeft: '1px solid #e5e7eb'
                  }} />
                </div>

                {/* Receipt Rows */}
                <div style={{ padding: '10px 18px 14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6b7280' }}>Order ID</span>
                    <span style={{ fontWeight: 700, color: '#1b4332', fontFamily: 'monospace' }}>
                      #{paymentDetails?.orderId || `FREE-${Date.now()}`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6b7280' }}>Program</span>
                    <span style={{ fontWeight: 700, color: '#1b4332', maxWidth: '200px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {program.title ? `1 Peserta (${program.title})` : '1 Peserta'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6b7280' }}>Tanggal Kegiatan</span>
                    <span style={{ fontWeight: 600, color: '#1b4332' }}>
                      {program.date ? (typeof program.date === 'string' ? program.date : formatDateDDMMYYYY(program.date)) : '-'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ color: '#6b7280' }}>Peserta</span>
                    <span style={{ fontWeight: 700, color: '#1b4332', maxWidth: '200px', textAlign: 'right' }}>
                      {user?.displayName || user?.name || user?.email || 'Relawan'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6b7280' }}>Metode Pembayaran</span>
                    <span style={{ fontWeight: 700, color: '#1b4332' }}>
                      {isPaidProgram ? (paymentDetails?.paymentMethod || 'Midtrans Gateway') : 'Pendaftaran Gratis'}
                    </span>
                  </div>

                  {isPaidProgram && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6b7280' }}>
                        <span>Commitment Fee</span>
                        <span style={{ fontWeight: 600, color: '#374151' }}>
                          Rp {Number(paymentDetails?.ticketPrice || ticketPrice).toLocaleString('id-ID')}
                        </span>
                      </div>
                      {(paymentDetails?.discountAmount > 0 || discountAmount > 0) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#16a34a' }}>
                          <span>Potongan Referal</span>
                          <span style={{ fontWeight: 600 }}>
                            -Rp {Number(paymentDetails?.discountAmount || discountAmount).toLocaleString('id-ID')}
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6b7280' }}>
                        <span>Biaya Layanan</span>
                        <span style={{ fontWeight: 600, color: '#374151' }}>
                          Rp {Number(paymentDetails?.adminFee || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Total Amount Row (No Pill Container) */}
                  <div style={{
                    marginTop: '6px',
                    paddingTop: '8px',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 800, color: '#1b4332', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      TOTAL
                    </span>
                    <span style={{ fontWeight: 800, color: '#1b4332', fontSize: '13.5px' }}>
                      {isPaidProgram && (paymentDetails?.amount ?? totalPayment) >= 0 ? `Rp ${Number(paymentDetails?.amount ?? totalPayment).toLocaleString('id-ID')}` : 'Rp 0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '14px 20px',
                    background: '#1b4332',
                    color: '#ffffff',
                    borderRadius: '999px',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    letterSpacing: '0.6px',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    boxShadow: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                >
                  <FiMessageCircle size={16} />
                  GABUNG GRUP WHATSAPP
                </a>

                <button
                  onClick={() => router.push('/akun')}
                  style={{
                    width: '100%',
                    padding: '13px 20px',
                    background: '#ffffff',
                    color: '#1b4332',
                    border: '1.5px solid #1b4332',
                    borderRadius: '999px',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    letterSpacing: '0.6px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  LIHAT AKUN & TIKET SAYA
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* ── INVOICE FLOW (STEP 1: PERSYARATAN, STEP 2: PEMBAYARAN) ── */
          /* ========================================================================= */
          <div>
            {/* PROGRAM DETAILS SUMMARY CARD */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1.5px solid var(--card-border)',
                borderRadius: '20px',
                padding: '16px 18px',
                marginBottom: '18px',
                boxShadow: 'none'
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: currentStep === 2 ? '12px' : 0 }}>
                <div style={{
                  position: 'relative',
                  width: '64px',
                  height: '64px',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '1px solid var(--card-border)'
                }}>
                  <Image
                    src={getValidImageUrl(program?.imageUrl)}
                    alt={program?.title || 'Program'}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700, color: 'var(--primary)', marginBottom: '2px' }}>
                    {program.category || "Umum"}
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {program.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    <FiMapPin size={11} color="var(--primary)" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {program.location || "Lokasi menyusul"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pricing Breakdown (Only shown in Step 2 or if free) */}
              {currentStep === 2 && (
                <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '11.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Commitment Fee</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-bold)' }}>
                      {isPaidProgram ? `Rp ${ticketPrice.toLocaleString('id-ID')}` : 'Rp 0'}
                    </span>
                  </div>

                  {discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiTag size={12} /> Potongan Referal ({appliedReferral?.code})
                      </span>
                      <span style={{ fontWeight: 700 }}>-Rp {discountAmount.toLocaleString('id-ID')}</span>
                    </div>
                  )}

                  {isPaidProgram && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Biaya Layanan</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-bold)' }}>
                        Rp {currentAdminFee.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800, marginTop: '2px', paddingTop: '8px', borderTop: '1px solid var(--card-border)', color: 'var(--text-bold)' }}>
                    <span>Total Pembayaran</span>
                    <span style={{ color: 'var(--primary)' }}>
                      {isPaidProgram ? `Rp ${totalPayment.toLocaleString('id-ID')}` : 'Rp 0'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── TAHAP 1: PERSYARATAN RELAWAN (QUEST UPLOAD) ── */}
            {currentStep === 1 && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}
              >
                {/* Step 1: Upload 'You're invited to' */}
                <div style={{
                  background: 'var(--card-bg)',
                  border: '1.5px solid var(--card-border)',
                  borderRadius: '20px',
                  padding: '18px',
                  boxShadow: 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: storyProof ? '#22c55e' : 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
                      {storyProof ? <FiCheck size={13} /> : '1'}
                    </div>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--text-bold)' }}>
                      Upload &apos;You&apos;re invited to&apos;
                    </h4>
                  </div>
                  <p style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '12px', lineHeight: 1.5 }}>
                    Unduh template di bawah, tambahkan namamu, lalu unggah ke Instagram Story pribadimu dan tag <strong style={{ color: 'var(--text-bold)' }}>@untukesok</strong>.
                  </p>
                  
                  {/* Download Template Link */}
                  <div style={{ marginBottom: '12px' }}>
                    <a
                      href={program.twibbonUrl || DEFAULT_INVITED_TEMPLATE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        background: '#f1f5f9',
                        color: '#334155',
                        borderRadius: '10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        textDecoration: 'none'
                      }}
                    >
                      <FiDownload size={13} /> Unduh Template &apos;You&apos;re invited to&apos;
                    </a>
                  </div>

                  {/* Upload Story Proof Box */}
                  <div>
                    <label style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px dashed #cbd5e1',
                      borderRadius: '12px',
                      padding: '14px',
                      cursor: 'pointer',
                      background: storyProof ? '#f0fdf4' : '#fafafa',
                      transition: 'all 0.2s'
                    }}>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setStoryProof(file);
                            setStoryProofPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      <FiUpload size={18} color={storyProof ? '#166534' : '#64748b'} style={{ marginBottom: '4px' }} />
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: storyProof ? '#166534' : '#64748b' }}>
                        {storyProof ? storyProof.name : 'Unggah Bukti Screenshot Story'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Step 2: Follow Instagram @untukesok */}
                <div style={{
                  background: 'var(--card-bg)',
                  border: '1.5px solid var(--card-border)',
                  borderRadius: '20px',
                  padding: '18px',
                  boxShadow: 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: igProof ? '#22c55e' : 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
                      {igProof ? <FiCheck size={13} /> : '2'}
                    </div>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--text-bold)' }}>
                      Follow Instagram @untukesok
                    </h4>
                  </div>
                  <p style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '12px', lineHeight: 1.5 }}>
                    Wajib follow akun Instagram resmi <a href="https://instagram.com/untukesok" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>@untukesok</a> dan unggah bukti tangkapan layar.
                  </p>
                  <div>
                    <label style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px dashed #cbd5e1',
                      borderRadius: '12px',
                      padding: '14px',
                      cursor: 'pointer',
                      background: igProof ? '#f0fdf4' : '#fafafa',
                      transition: 'all 0.2s'
                    }}>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIgProof(file);
                            setIgProofPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      <FiUpload size={18} color={igProof ? '#166534' : '#64748b'} style={{ marginBottom: '4px' }} />
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: igProof ? '#166534' : '#64748b' }}>
                        {igProof ? igProof.name : 'Unggah Bukti Screenshot Follow @untukesok'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAHAP 2: PEMBAYARAN MIDTRANS (FOR PAID PROGRAMS) ── */}
            {currentStep === 2 && isPaidProgram && (
              <div
                style={{
                  marginBottom: '20px'
                }}
              >
                {/* ── FORM KODE REFERAL ── */}
                <div style={{
                  background: 'var(--card-bg)',
                  border: '1.5px solid var(--card-border)',
                  borderRadius: '20px',
                  padding: '14px 16px',
                  marginBottom: '16px',
                  boxShadow: 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-bold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiTag color="var(--primary)" size={14} /> Kode Referal
                    </label>
                    {appliedReferral && (
                      <span style={{ fontSize: '10.5px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        Hemat Rp {discountAmount.toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>

                  {!appliedReferral ? (
                    <form onSubmit={handleApplyReferral} style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Masukkan kode referal"
                        value={referralInput}
                        onChange={(e) => {
                          setReferralInput(e.target.value.toUpperCase());
                          if (referralError) setReferralError('');
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '10px',
                          border: referralError ? '1.5px solid #ef4444' : '1px solid var(--card-border)',
                          background: 'var(--bg)',
                          color: 'var(--text)',
                          fontSize: '12px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          outline: 'none',
                          fontFamily: 'var(--font-poppins)',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          flexShrink: 0,
                          background: 'var(--primary)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '9px 16px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-poppins)',
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box',
                          transition: 'background 0.2s'
                        }}
                      >
                        Terapkan
                      </button>
                    </form>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      padding: '8px 12px',
                      borderRadius: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#16a34a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiCheck size={12} strokeWidth={3} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '12.5px', color: '#166534', letterSpacing: '0.4px' }}>
                            {appliedReferral.code}
                          </div>
                          <div style={{ fontSize: '11px', color: '#15803d' }}>
                            Potongan Rp {discountAmount.toLocaleString('id-ID')} berhasil digunakan
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveReferral}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '4px 6px'
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  )}

                  {referralError && (
                    <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '6px', fontWeight: 600 }}>
                      {referralError}
                    </div>
                  )}
                  {referralSuccessMsg && !appliedReferral && (
                    <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '6px', fontWeight: 600 }}>
                      {referralSuccessMsg}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-bold)' }}>
                    Pilih Metode Pembayaran
                  </label>
                </div>

                {/* 2 x 2 Responsive Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px'
                }}>
                  {paymentMethodCards.map((card) => {
                    const isSelected = selectedPaymentMethod === card.id;
                    const feeForThisCard = calculatePaymentFee(card.id, discountedPrice);
                    return (
                      <div
                        key={card.id}
                        onClick={() => setSelectedPaymentMethod(card.id)}
                        style={{
                          borderRadius: '16px',
                          border: isSelected ? '2px solid var(--primary)' : '1.5px solid #e2e8f0',
                          background: isSelected ? 'rgba(255, 189, 89, 0.12)' : '#ffffff',
                          padding: '12px 8px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: '136px',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          boxShadow: 'none'
                        }}
                      >
                        {/* Selected Checkmark */}
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <FiCheck size={10} strokeWidth={3.5} />
                          </div>
                        )}

                        {/* Badges Cluster */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '5px',
                          marginBottom: '6px',
                          justifyItems: 'center',
                          alignItems: 'center'
                        }}>
                          {card.badges.map((b, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: b.bg,
                                color: b.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: b.text.length > 4 ? '7.5px' : '9px',
                                fontWeight: 800,
                                letterSpacing: '-0.2px',
                                border: '1.5px solid rgba(255,255,255,0.85)',
                                boxShadow: 'none'
                              }}
                            >
                              {b.text}
                            </div>
                          ))}
                        </div>

                        {/* Title Badge */}
                        <div style={{
                          width: '100%',
                          background: isSelected ? 'var(--primary)' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#334155',
                          borderRadius: '8px',
                          padding: '5px 4px',
                          textAlign: 'center',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          lineHeight: 1.2,
                          transition: 'all 0.2s ease'
                        }}>
                          {card.title}
                        </div>

                        {/* Fee note */}
                        <span style={{ fontSize: '9.5px', color: isSelected ? '#d97706' : '#64748b', fontWeight: 600, marginTop: '3px' }}>
                          +Rp {feeForThisCard.toLocaleString('id-ID')}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Subtitle description of active method */}
                <div style={{ marginTop: '12px', padding: '9px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: '10px', fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{paymentMethodCards.find(c => c.id === selectedPaymentMethod)?.feeNote}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-bold)' }}>Total: Rp {totalPayment.toLocaleString('id-ID')}</span>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* ── BOTTOM FIXED ACTION BAR (NEMPEL DI BAWAH) ── */}
      {!isVerified && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--bg)',
          borderTop: '1px solid var(--card-border)',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 1000,
          boxShadow: 'none'
        }}>
          <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {currentStep === 1 && (
              isPaidProgram ? (
                <button
                  onClick={handleProceedToPayment}
                  disabled={!isQuestCompleted || isFull}
                  style={{
                    width: '100%',
                    padding: '13.5px 22px',
                    background: (!isQuestCompleted || isFull) ? '#cbd5e1' : 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '16px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: (!isQuestCompleted || isFull) ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-poppins)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {isFull ? 'Kuota Penuh' : 'Konfirmasi'}
                </button>
              ) : (
                <button
                  onClick={handleVerifyFree}
                  disabled={!isQuestCompleted || isVerifying || isFull}
                  style={{
                    width: '100%',
                    padding: '13.5px 22px',
                    background: (!isQuestCompleted || isFull) ? '#cbd5e1' : 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '16px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: (!isQuestCompleted || isFull) ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-poppins)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {isVerifying ? 'Memverifikasi...' : isFull ? 'Kuota Penuh' : 'Konfirmasi'}
                </button>
              )
            )}

            {currentStep === 2 && isPaidProgram && (
              <button
                onClick={handlePayMidtrans}
                disabled={isVerifying || isFull}
                style={{
                  width: '100%',
                  padding: '13.5px 22px',
                  background: (isVerifying || isFull) ? '#cbd5e1' : 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: (isVerifying || isFull) ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-poppins)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'none',
                  transition: 'all 0.2s'
                }}
              >
                {isVerifying ? 'Menyiapkan Midtrans...' : isFull ? 'Kuota Penuh' : 'Bayar'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
