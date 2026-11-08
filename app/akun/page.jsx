'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  FiAward, 
  FiHelpCircle, FiLogOut, FiChevronRight, 
  FiHeart, FiShield, FiPhone, FiAlertCircle,
  FiStar, FiDownload, FiEdit3, FiX,
  FiMail, FiArrowRight, FiArrowLeft,
  FiImage
} from 'react-icons/fi';
import { useAuth } from '../../src/context/AuthContext';
import { db, auth, googleProvider } from '../../src/lib/firebase';
import { 
  signInWithPopup, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  updatePassword,
  linkWithPopup
} from 'firebase/auth';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { calculateTotalContributionHours } from '../../src/lib/dateUtils';

const containerVariants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const itemVariants = {
  hidden: { y: 0, opacity: 1 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 120 } }
};

export default function Account() {
  const router = useRouter();

  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'activities', 'settings'
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [myPrograms, setMyPrograms] = useState([]);
  const [isAppsLoading, setIsAppsLoading] = useState(true);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [isCaptchaLoaded, setIsCaptchaLoaded] = useState(false);
  const [isCaptchaError, setIsCaptchaError] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isCancelingApp, setIsCancelingApp] = useState(false);
  const recaptchaContainerRef = useRef(null);
  const recaptchaWidgetIdRef = useRef(null);

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LdRrKstAAAAAOY7Q-6APy6Qn6H68awofdP_V2je';

  // Explicit reCAPTCHA render for Single Page App lifecycle
  useEffect(() => {
    if (user) return;

    let isMounted = true;

    const renderWidget = () => {
      if (!isMounted) return;
      if (typeof window !== 'undefined' && window.grecaptcha && window.grecaptcha.render && recaptchaContainerRef.current) {
        if (recaptchaContainerRef.current.hasChildNodes()) {
          setIsCaptchaLoaded(true);
          try {
            const existingToken = recaptchaWidgetIdRef.current !== null 
              ? window.grecaptcha.getResponse(recaptchaWidgetIdRef.current) 
              : window.grecaptcha.getResponse();
            if (existingToken && isMounted) {
              setCaptchaToken(existingToken);
            }
          } catch {
            // ignore
          }
          return;
        }
        try {
          const widgetId = window.grecaptcha.render(recaptchaContainerRef.current, {
            sitekey: recaptchaSiteKey,
            callback: (token) => {
              if (isMounted) {
                setCaptchaToken(token);
                setAuthError('');
              }
            },
            'expired-callback': () => {
              if (isMounted) {
                setCaptchaToken('');
              }
            },
            'error-callback': () => {
              console.warn('reCAPTCHA encounter error');
              if (isMounted) {
                setIsCaptchaError(true);
              }
            }
          });
          recaptchaWidgetIdRef.current = widgetId;
          setIsCaptchaLoaded(true);
        } catch (err) {
          console.warn("reCAPTCHA render error:", err);
          if (isMounted) {
            setIsCaptchaError(true);
          }
        }
      }
    };

    if (typeof window !== 'undefined') {
      if (window.grecaptcha && window.grecaptcha.render) {
        renderWidget();
      } else {
        let script = document.getElementById('recaptcha-script');
        if (!script) {
          script = document.createElement('script');
          script.id = 'recaptcha-script';
          script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
          script.async = true;
          script.defer = true;
          script.onerror = () => {
            if (isMounted) setIsCaptchaError(true);
          };
          document.head.appendChild(script);
        }

        let pollCount = 0;
        const pollTimer = setInterval(() => {
          pollCount++;
          if (window.grecaptcha && window.grecaptcha.render && recaptchaContainerRef.current) {
            renderWidget();
            clearInterval(pollTimer);
          } else if (pollCount > 20) {
            // Fallback jika diblokir ekstensi adblocker / koneksi lambat setelah 6 detik
            if (isMounted) setIsCaptchaError(true);
            clearInterval(pollTimer);
          }
        }, 300);

        return () => {
          isMounted = false;
          clearInterval(pollTimer);
        };
      }
    }

    return () => {
      isMounted = false;
    };
  }, [user, recaptchaSiteKey]);

  const resetCaptcha = () => {
    setCaptchaToken('');
    if (typeof window !== 'undefined' && window.grecaptcha && window.grecaptcha.reset) {
      try {
        if (recaptchaWidgetIdRef.current !== null) {
          window.grecaptcha.reset(recaptchaWidgetIdRef.current);
        } else {
          window.grecaptcha.reset();
        }
      } catch {
        // Ignore reset error
      }
    }
  };

  // Cancel Registration State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelingApp, setCancelingApp] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Profile Edit & Mandatory Check State
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editGender, setEditGender] = useState('Laki-laki');
  const [editBirthYear, setEditBirthYear] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFeePreference, setEditFeePreference] = useState(0);
  const [feeSliderTouched, setFeeSliderTouched] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [userProfileData, setUserProfileData] = useState(null);
  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Fetch User Document from Firestore & Check Completeness
  useEffect(() => {
    if (!user || loading) return;

    const fetchUserProfile = async () => {
      setIsProfileLoading(true);
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        let data = {};
        if (userDocSnap.exists()) {
          data = userDocSnap.data();
        } else {
          // If doc doesn't exist, create initial record
          data = {
            name: user.displayName || '',
            email: user.email || '',
            photoURL: user.photoURL || '',
            role: 'user',
            createdAt: new Date().toISOString()
          };
          await setDoc(userDocRef, data, { merge: true });
        }
        setUserProfileData(data);

        const currentName = data.name || user.displayName || '';
        const currentNickname = data.nickname || '';
        const currentGender = data.gender || '';
        const currentBirthYear = data.birthYear || data.birth_year || '';
        const currentPhone = data.phone || '';
        const currentFeePref = Number(data.commitmentFeePreference ?? data.feePreference ?? 0);
        const currentAgreedTerms = Boolean(data.agreedTerms || data.profileCompleted);

        setEditName(currentName);
        setEditNickname(currentNickname);
        setEditGender(currentGender || 'Laki-laki');
        setEditBirthYear(currentBirthYear ? String(currentBirthYear) : '');
        setEditPhone(currentPhone ? currentPhone.replace(/^62/, '').replace(/^0/, '') : '');
        setEditFeePreference(currentFeePref);
        // If user already has a saved fee preference, treat slider as touched
        setFeeSliderTouched(Boolean(data.commitmentFeePreference !== undefined || data.feePreference !== undefined));
        setAgreedTerms(currentAgreedTerms);

        // Profile is complete ONLY if name, nickname, gender, birthYear, phone, and terms agreement are satisfied
        const hasValidName = Boolean(currentName && currentName.trim().length > 0);
        const hasValidNickname = Boolean(currentNickname && currentNickname.trim().length > 0);
        const hasValidGender = Boolean(currentGender && (currentGender === 'Laki-laki' || currentGender === 'Perempuan'));
        const hasValidBirthYear = Boolean(currentBirthYear && Number(currentBirthYear) >= 1940 && Number(currentBirthYear) <= new Date().getFullYear());
        const hasValidPhone = Boolean(currentPhone && currentPhone.trim().length > 0);
        const hasAgreedTerms = currentAgreedTerms;
        const isComplete = hasValidName && hasValidNickname && hasValidGender && hasValidBirthYear && hasValidPhone && hasAgreedTerms;

        setIsProfileComplete(isComplete);
      } catch (err) {
        console.error("Error fetching user profile:", err);
      } finally {
        setIsProfileLoading(false);
      }
    };

    fetchUserProfile();
  }, [user, loading]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (isUpdatingProfile) return;

    const cleanName = editName.trim();
    const nicknameWords = editNickname.trim().split(/\s+/).filter(Boolean);
    const cleanNickname = nicknameWords.slice(0, 2).join(' ');
    const cleanBirthYear = editBirthYear ? parseInt(editBirthYear, 10) : null;
    const currentYear = new Date().getFullYear();
    const rawPhone = editPhone.trim().replace(/^0+/, '').replace(/^\+?62/, '');

    if (!cleanName) {
      alert("Harap masukkan Nama Lengkap Anda.");
      return;
    }
    if (!cleanNickname) {
      alert("Harap masukkan Nama Panggilan Anda (maksimal 2 kata).");
      return;
    }
    if (!editGender) {
      alert("Harap pilih Jenis Kelamin Anda.");
      return;
    }
    if (!cleanBirthYear || isNaN(cleanBirthYear) || cleanBirthYear < 1940 || cleanBirthYear > currentYear) {
      alert(`Harap masukkan Tahun Kelahiran yang valid (antara 1940 - ${currentYear}).`);
      return;
    }
    if (!rawPhone || rawPhone.length < 7) {
      alert("Harap masukkan Nomor WhatsApp aktif yang valid.");
      return;
    }
    if (!agreedTerms) {
      alert("Harap setujui Persetujuan Syarat & Ketentuan yang berlaku.");
      return;
    }
    if (!feeSliderTouched) {
      alert("Harap geser slider Preferensi Commitment Fee minimal satu kali sebelum menyimpan.");
      document.getElementById('feePreference')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const fullPhone = '62' + rawPhone;
    setIsUpdatingProfile(true);

    try {
      // 1. Update Firebase Auth displayName
      await updateProfile(auth.currentUser, {
        displayName: cleanName
      });

      // 2. Update Firestore users collection
      const updateData = { 
        name: cleanName,
        nickname: cleanNickname,
        gender: editGender,
        birthYear: Number(cleanBirthYear),
        phone: fullPhone,
        commitmentFeePreference: Number(editFeePreference),
        email: user.email || '',
        agreedTerms: true,
        profileCompleted: true,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', user.uid), updateData, { merge: true });

      // 3. Synchronize userName, userNickname, userGender, userBirthYear, userPhone, and userEmail in all application documents for this user
      const appsQuery = query(collection(db, 'applications'), where('userId', '==', user.uid));
      const appsSnapshot = await getDocs(appsQuery);
      const appUpdatePromises = appsSnapshot.docs.map(appDoc =>
        updateDoc(doc(db, 'applications', appDoc.id), { 
          userName: cleanName,
          userNickname: cleanNickname,
          userGender: editGender,
          userBirthYear: Number(cleanBirthYear),
          userPhone: fullPhone,
          userEmail: user.email || ''
        })
      );
      await Promise.all(appUpdatePromises);

      setUserProfileData(prev => ({ ...prev, ...updateData }));
      setIsProfileComplete(true);
      setShowEditProfile(false);
      alert("Profil Anda berhasil diperbarui dan disinkronisasikan ke seluruh pendaftaran relawan!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Gagal memperbarui profil: " + error.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // ── KEAMANAN & MULTI-AUTH STATE & HANDLERS ──
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [secNewPassword, setSecNewPassword] = useState('');
  const [secConfirmPassword, setSecConfirmPassword] = useState('');
  const [secPhone, setSecPhone] = useState('');
  const [secLoading, setSecLoading] = useState(false);
  const [secMessage, setSecMessage] = useState({ type: '', text: '' });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showPhoneForm, setShowPhoneForm] = useState(false);

  const openSecurityModal = () => {
    setSecPhone(userProfileData?.phone ? userProfileData.phone.replace(/^62/, '').replace(/^0/, '') : '');
    setSecNewPassword('');
    setSecConfirmPassword('');
    setSecMessage({ type: '', text: '' });
    setShowPasswordForm(false);
    setShowPhoneForm(false);
    setShowSecurityModal(true);
  };

  const handleLinkGoogle = async () => {
    setSecLoading(true);
    setSecMessage({ type: '', text: '' });
    try {
      if (!auth.currentUser) return;
      await linkWithPopup(auth.currentUser, googleProvider);
      setSecMessage({ type: 'success', text: 'Akun Google berhasil dihubungkan ke akun Anda!' });
    } catch (err) {
      console.error('Error linking google:', err);
      if (err.code === 'auth/credential-already-in-use') {
        setSecMessage({ type: 'error', text: 'Akun Google ini sudah terhubung dengan akun lain.' });
      } else if (err.code === 'auth/popup-closed-by-user') {
        setSecMessage({ type: 'error', text: 'Jendela popup Google ditutup.' });
      } else {
        setSecMessage({ type: 'error', text: 'Gagal menghubungkan Google: ' + err.message });
      }
    } finally {
      setSecLoading(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (!secNewPassword || secNewPassword.length < 6) {
      setSecMessage({ type: 'error', text: 'Kata sandi minimal 6 karakter.' });
      return;
    }
    if (secNewPassword !== secConfirmPassword) {
      setSecMessage({ type: 'error', text: 'Konfirmasi kata sandi tidak cocok.' });
      return;
    }
    setSecLoading(true);
    setSecMessage({ type: '', text: '' });
    try {
      if (!auth.currentUser) return;
      await updatePassword(auth.currentUser, secNewPassword);
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          hasCustomPassword: true,
          passwordUpdatedAt: new Date().toISOString()
        });
      }
      setSecMessage({ type: 'success', text: 'Kata sandi berhasil disimpan dan dapat digunakan untuk masuk!' });
      setSecNewPassword('');
      setSecConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      console.error('Error updating password:', err);
      if (err.code === 'auth/requires-recent-login') {
        setSecMessage({ type: 'error', text: 'Demi keamanan, silakan keluar dan masuk kembali sebelum menyetel kata sandi.' });
      } else {
        setSecMessage({ type: 'error', text: 'Gagal mengatur sandi: ' + err.message });
      }
    } finally {
      setSecLoading(false);
    }
  };

  const handleUpdateSecPhone = async (e) => {
    e.preventDefault();
    const raw = secPhone.trim().replace(/^0+/, '').replace(/^\+?62/, '');
    if (!raw || raw.length < 7) {
      setSecMessage({ type: 'error', text: 'Harap masukkan nomor WhatsApp / HP yang valid.' });
      return;
    }
    const fullPhone = '62' + raw;
    setSecLoading(true);
    setSecMessage({ type: '', text: '' });
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          phone: fullPhone,
          updatedAt: new Date().toISOString()
        });
        setUserProfileData(prev => ({ ...prev, phone: fullPhone }));
        setEditPhone(raw);
        setSecMessage({ type: 'success', text: 'Nomor WhatsApp / HP berhasil disimpan!' });
        setShowPhoneForm(false);
      }
    } catch (err) {
      console.error('Error updating phone:', err);
      setSecMessage({ type: 'error', text: 'Gagal memperbarui nomor HP.' });
    } finally {
      setSecLoading(false);
    }
  };

  // ── PROGRESSIVE CLAIM CERTIFICATE STORY STATE ──
  const [showClaimStory, setShowClaimStory] = useState(false);
  const [showStoryHint, setShowStoryHint] = useState(false);
  const [storyApp, setStoryApp] = useState(null);
  const [storySlide, setStorySlide] = useState(1); // 1: Apresiasi, 2: Rekap Kontribusi, 3: Ulasan & Reward, 4: Reward
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyRating, setStoryRating] = useState(5);
  const [storyHoverRating, setStoryHoverRating] = useState(0);
  const [storyKesan, setStoryKesan] = useState('');
  const [storyPesan, setStoryPesan] = useState('');
  const [storyAllowPublic, setStoryAllowPublic] = useState(true);
  const [isSubmittingStoryFeedback, setIsSubmittingStoryFeedback] = useState(false);
  const [isStoryFeedbackDone, setIsStoryFeedbackDone] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const [countAktivitas, setCountAktivitas] = useState(0);
  const [countJam, setCountJam] = useState(0);
  const [countTerbantu, setCountTerbantu] = useState(0);

  const handleOpenClaimCertificateStory = (app) => {
    setStoryApp(app);
    // Jika user sudah pernah submit ulasan, langsung masuk ke Slide 4 (Reward Sertifikat & Drive)
    if (app.feedbackSubmitted) {
      setStorySlide(4);
      setShowStoryHint(false);
    } else {
      setStorySlide(1);
      setShowStoryHint(true); // Tampilkan dim & blur overlay panduan navigasi awal
    }
    setStoryProgress(0);
    setStoryRating(app.rating || 5);
    setStoryHoverRating(0);
    setStoryKesan(app.kesan || '');
    setStoryPesan(app.pesan || '');
    setStoryAllowPublic(app.allowPublicTestimonial !== false);
    setIsStoryFeedbackDone(Boolean(app.feedbackSubmitted));
    setShowClaimStory(true);
  };

  // Auto-slide 8 detik per slide & progress bar
  useEffect(() => {
    if (!showClaimStory || showStoryHint) {
      setStoryProgress(0);
      return;
    }

    // Pause timer on slide 3 (form ulasan) - bar tetap 0% jika belum submit
    if (storySlide === 3) {
      setStoryProgress(isStoryFeedbackDone ? 100 : 0);
      return;
    }

    setStoryProgress(0);
    const intervalTime = 50; // ms
    const totalDuration = 8000; // 8 detik
    const step = (intervalTime / totalDuration) * 100;

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev + step >= 100) {
          clearInterval(timer);
          // Auto advance slide
          if (storySlide === 1) {
            setStorySlide(2);
          } else if (storySlide === 2) {
            setStorySlide(isStoryFeedbackDone ? 4 : 3);
          } else if (storySlide === 4) {
            setShowClaimStory(false);
          }
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [showClaimStory, storySlide, isStoryFeedbackDone, showStoryHint]);

  // Listener keyboard Escape untuk menutup story
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showClaimStory) {
        setShowClaimStory(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showClaimStory]);

  const handlePrevSlide = (e) => {
    e?.stopPropagation?.();
    if (storySlide === 2) {
      setStorySlide(1);
    } else if (storySlide === 3) {
      setStorySlide(2);
    } else if (storySlide === 4) {
      setStorySlide(isStoryFeedbackDone ? 2 : 3);
    }
  };

  const handleNextSlide = (e) => {
    e?.stopPropagation?.();
    if (storySlide === 1) {
      setStorySlide(2);
    } else if (storySlide === 2) {
      setStorySlide(isStoryFeedbackDone ? 4 : 3);
    } else if (storySlide === 3) {
      if (isStoryFeedbackDone) {
        setStorySlide(4);
      }
    } else if (storySlide === 4) {
      setShowClaimStory(false);
    }
  };

  // Count-up trigger when reaching slide 2
  useEffect(() => {
    if (showClaimStory && storySlide === 2) {
      const targetAktivitas = myPrograms.filter(p => p.status !== 'Dibatalkan' && p.status !== 'Dikeluarkan').length;
      const targetJam = calculateTotalContributionHours(myPrograms);
      const targetTerbantu = myPrograms
        .filter(p => p.status !== 'Dibatalkan' && p.status !== 'Dikeluarkan')
        .reduce((acc, p) => acc + (Number(p.beneficiariesCount || p.beneficiaries) || 0), 0);

      setCountAktivitas(0);
      setCountJam(0);
      setCountTerbantu(0);

      let animFrameId;
      const delayTimeout = setTimeout(() => {
        const duration = 1200;
        const startTime = performance.now();

        const animate = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3);

          setCountAktivitas(Math.floor(easeOut * targetAktivitas));
          setCountJam(Math.floor(easeOut * targetJam));
          setCountTerbantu(Math.floor(easeOut * targetTerbantu));

          if (progress < 1) {
            animFrameId = requestAnimationFrame(animate);
          } else {
            setCountAktivitas(targetAktivitas);
            setCountJam(targetJam);
            setCountTerbantu(targetTerbantu);
          }
        };

        animFrameId = requestAnimationFrame(animate);
      }, 1200);

      return () => {
        clearTimeout(delayTimeout);
        if (animFrameId) cancelAnimationFrame(animFrameId);
      };
    }
  }, [showClaimStory, storySlide, myPrograms]);

  const handleSubmitStoryFeedback = async (e) => {
    e.preventDefault();
    if (!storyApp || isSubmittingStoryFeedback) return;

    const cleanKesan = storyKesan.trim();
    const cleanPesan = storyPesan.trim();

    if (!storyRating || storyRating < 1 || storyRating > 5) {
      alert("Harap berikan penilaian bintang antara 1 sampai 5.");
      return;
    }
    if (!cleanKesan) {
      alert("Harap isi pembelajaran yang dipetik selama mengikuti kegiatan.");
      return;
    }
    if (!cleanPesan) {
      alert("Harap isi pesan atau saran Anda untuk tim Untuk Esok.");
      return;
    }

    setIsSubmittingStoryFeedback(true);
    try {
      const payload = {
        feedbackSubmitted: true,
        rating: Number(storyRating),
        kesan: cleanKesan,
        pesan: cleanPesan,
        allowPublicTestimonial: Boolean(storyAllowPublic),
        feedbackSubmittedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'applications', storyApp.id), payload);

      setMyPrograms(prev => prev.map(p => p.id === storyApp.id ? { ...p, ...payload } : p));
      setStoryApp(prev => ({ ...prev, ...payload }));
      setIsStoryFeedbackDone(true);
      // Pindah langsung ke Slide 4 (Reward Sertifikat & Dokumentasi)
      setStorySlide(4);
    } catch (err) {
      console.error("Error submitting story feedback:", err);
      alert("Gagal menyimpan ulasan: " + err.message);
    } finally {
      setIsSubmittingStoryFeedback(false);
    }
  };

  const exportClaimCertificatePng = async (_appData) => {
    setIsGeneratingPng(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');

      // Transparent base for Instagram Story sticker
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Load & Draw UE logo near top with padding from top boundary
      const loadLogo = () => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = '/logo_UE.webp';
      });
      const logoImg = await loadLogo();
      if (logoImg) {
        const logoSize = 140;
        const logoX = (canvas.width - logoSize) / 2;
        const logoY = 130; // Padding dari batas atas
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      }

      const scale = 1080 / 380; // ~2.842

      // Helper to draw ribbon paths
      const drawRibbon = (pathD, strokeColor, strokeWidth) => {
        ctx.save();
        const p = new Path2D(pathD);
        ctx.scale(scale, scale);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(p);
        ctx.restore();
      };

      // Draw Blue Ribbons
      drawRibbon(
        "M 310 90 C 310 50, 335 30, 350 70 C 365 110, 370 150, 385 85 C 395 50, 415 60, 415 110 C 415 150, 430 160, 430 130",
        "#3b82f6",
        20
      );
      drawRibbon(
        "M 60 220 C 35 210, -10 225, -15 255 C -20 290, 5 315, 20 275 C 32 240, 55 235, 85 225",
        "#3b82f6",
        20
      );
      drawRibbon(
        "M 15 440 L 22 485 C 28 520, 50 525, 65 495 C 80 465, 90 465, 105 510 C 125 570, 175 605, 210 530 C 230 490, 245 500, 260 520",
        "#3b82f6",
        22
      );

      // Pill drawing helper
      const drawPill = (x, y, w, h, fill, numberText, labelText) => {
        ctx.save();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(x * scale, y * scale, w * scale, h * scale, (h / 2) * scale);
        ctx.fill();

        // Number
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${58 * scale}px 'Poppins', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(numberText), (x + w / 2) * scale, (y + 44) * scale);

        // Label
        ctx.font = `700 ${15 * scale}px 'Poppins', sans-serif`;
        ctx.fillText(String(labelText), (x + w / 2) * scale, (y + 80) * scale);
        ctx.restore();
      };

      // Draw Pill 1 (Aktivitas Diikuti)
      const totalAktivitas = myPrograms.filter(p => p.status !== 'Dibatalkan' && p.status !== 'Dikeluarkan').length;
      drawPill(35, 125, 310, 108, '#f79e38', totalAktivitas, 'Aktivitas Diikuti');

      // Draw Pill 2 (Jam Kontribusi)
      const totalJam = calculateTotalContributionHours(myPrograms);
      drawPill(35, 245, 310, 108, '#004d99', totalJam, 'Jam Kontribusi');

      // Draw Pill 3 (Orang Terbantu)
      const totalTerbantu = myPrograms
        .filter(p => p.status !== 'Dibatalkan' && p.status !== 'Dikeluarkan')
        .reduce((acc, p) => acc + (Number(p.beneficiariesCount || p.beneficiaries) || 0), 0);
      drawPill(35, 365, 310, 108, '#f79e38', totalTerbantu.toLocaleString('id-ID'), 'Orang Terbantu');

      // Helper for Asterisk Sticker
      const drawAsteriskSticker = (cx, cy, r) => {
        ctx.save();
        ctx.translate(cx * scale, cy * scale);
        ctx.fillStyle = '#f79e38';
        ctx.beginPath();
        ctx.arc(0, 0, r * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5 * scale;
        ctx.stroke();

        // 8 Petals
        ctx.lineWidth = 4.5 * scale;
        ctx.strokeStyle = '#ffffff';
        ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * 45 * Math.PI) / 180);
          ctx.beginPath();
          ctx.moveTo(0, -14 * scale);
          ctx.lineTo(0, 14 * scale);
          ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      // Draw Stickers
      drawAsteriskSticker(48, 126, 24);
      drawAsteriskSticker(314, 366, 24);

      const volunteerName = userProfileData?.name || user?.displayName || 'Relawan';

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Dampak-Relawan-${volunteerName.replace(/\s+/g, '-')}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      console.error("Gagal export gambar:", err);
      alert("Gagal mengunduh gambar dampak.");
    } finally {
      setIsGeneratingPng(false);
    }
  };
  
  // Fetch applied programs
  useEffect(() => {
    if (!user) {
      setMyPrograms([]);
      setIsAppsLoading(false);
      return;
    }
    
    setIsAppsLoading(true);
    const q = query(collection(db, 'applications'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const progs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortByNewest = (items) => {
        return [...items].sort((a, b) => {
          const timeA = new Date(a.appliedAt || a.createdAt || a.programDate || 0).getTime();
          const timeB = new Date(b.appliedAt || b.createdAt || b.programDate || 0).getTime();
          return timeB - timeA;
        });
      };

      try {
        const enrichedProgs = await Promise.all(progs.map(async (p) => {
          if (p.programId) {
            try {
              const pDoc = await getDoc(doc(db, 'programs', p.programId));
              if (pDoc.exists()) {
                const pData = pDoc.data();
                return {
                  ...p,
                  documentationDriveUrl: p.documentationDriveUrl || pData.documentationDriveUrl || '',
                  beneficiariesCount: Number(pData.beneficiariesCount ?? pData.beneficiaries ?? 0)
                };
              }
            } catch (e) {
              console.warn("Could not enrich program doc:", e);
            }
          }
          return {
            ...p,
            beneficiariesCount: Number(p.beneficiariesCount ?? p.beneficiaries ?? 0)
          };
        }));
        setMyPrograms(sortByNewest(enrichedProgs));
        setIsAppsLoading(false);
      } catch {
        setMyPrograms(sortByNewest(progs));
        setIsAppsLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    if (isSubmittingAuth) return;
    const isLocal = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local')
    );
    
    let token = captchaToken;
    if (!token && typeof window !== 'undefined' && window.grecaptcha) {
      try {
        token = recaptchaWidgetIdRef.current !== null 
          ? window.grecaptcha.getResponse(recaptchaWidgetIdRef.current) 
          : window.grecaptcha.getResponse();
        if (token) setCaptchaToken(token);
      } catch {
        // ignore
      }
    }

    if (isCaptchaLoaded && !isCaptchaError && !token && !isLocal) {
      setAuthError('Harap centang verifikasi reCAPTCHA terlebih dahulu sebelum masuk.');
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Simpan profil Google ke koleksi users tanpa menimpa role admin yang sudah ada
      await setDoc(doc(db, 'users', result.user.uid), {
        name: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        lastLoginAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error("Login failed:", error);
      resetCaptcha();
      alert("Gagal login dengan Google.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (isSubmittingAuth) return;
    setAuthError('');

    const isLocal = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local')
    );

    let token = captchaToken;
    if (!token && typeof window !== 'undefined' && window.grecaptcha) {
      try {
        token = recaptchaWidgetIdRef.current !== null 
          ? window.grecaptcha.getResponse(recaptchaWidgetIdRef.current) 
          : window.grecaptcha.getResponse();
        if (token) setCaptchaToken(token);
      } catch {
        // ignore
      }
    }

    if (isCaptchaLoaded && !isCaptchaError && !token && !isLocal) {
      setAuthError('Harap centang verifikasi reCAPTCHA terlebih dahulu sebelum melanjutkan.');
      return;
    }

    setIsSubmittingAuth(true);
    try {
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          role: 'user',
          createdAt: new Date().toISOString()
        });
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', result.user.uid), {
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (error) {
      console.error("Auth error:", error);
      resetCaptcha();
      if (error.code === 'auth/email-already-in-use') setAuthError('Email ini sudah terdaftar.');
      else if (error.code === 'auth/invalid-credential') setAuthError('Email atau kata sandi salah.');
      else if (error.code === 'auth/weak-password') setAuthError('Kata sandi terlalu lemah (minimal 6 karakter).');
      else setAuthError(error.message);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowLogoutModal(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleCancelApplication = async (e) => {
    e.preventDefault();
    if (isCancelingApp) return;
    if (!cancelingApp) return;

    setIsCancelingApp(true);
    try {
      await updateDoc(doc(db, 'applications', cancelingApp.id), {
        status: 'Dibatalkan',
        cancelReason: cancelReason,
        canceledAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'programs', cancelingApp.programId), {
        volunteersJoined: increment(-1)
      });

      setCancelModalOpen(false);
      setCancelingApp(null);
      setCancelReason('');
      alert('Pendaftaran Anda telah berhasil dibatalkan.');
    } catch (error) {
      console.error("Error canceling application:", error);
      alert('Terjadi kesalahan saat membatalkan pendaftaran.');
    } finally {
      setIsCancelingApp(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="home-content">
      {/* ── TOP FIXED ANCHORED HEADER ── */}
      <div 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          zIndex: 1000,
          background: 'var(--bg)',
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px', 
          padding: '0 24px',
          borderBottom: '1px solid var(--card-border)',
          boxShadow: 'none'
        }}
      >

        <h1 style={{ 
          fontSize: '20px', 
          fontWeight: 700, 
          fontFamily: 'var(--font-poppins)', 
          color: 'var(--text)',
          margin: 0 
        }}>
          Akun Saya
        </h1>
      </div>

      <div className="news-page-container" style={{ paddingTop: '80px', paddingBottom: '120px' }}>
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          
          {/* LOADING STATE */}
          {(loading || (user && (isProfileLoading || isAppsLoading))) ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p>Memuat profil...</p>
            </div>
          ) : !user ? (
            <motion.div variants={itemVariants} style={{ 
              maxWidth: '400px', 
              margin: '0 auto', 
              padding: '32px', 
              textAlign: 'center',
              background: 'var(--card-bg)',
              borderRadius: '24px',
              border: '1px solid var(--card-border)',
              boxShadow: 'none'
            }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>
                {isRegistering ? 'Daftar Akun' : 'Masuk Akun'}
              </h2>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '24px' }}>
                {isRegistering ? 'Buat akun baru untuk mulai berkontribusi.' : 'Masuk untuk melihat aktivitas relawan Anda.'}
              </p>

              {authError && (
                <div style={{ background: '#fef2f2', color: '#ef4444', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                  {authError}
                </div>
              )}

              <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <input 
                  type="email" 
                  placeholder="Alamat Email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                  required
                />
                <input 
                  type="password" 
                  placeholder="Kata Sandi" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                  required
                  minLength="6"
                />

                {/* Google reCAPTCHA Widget */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0', minHeight: '78px' }}>
                  <div ref={recaptchaContainerRef} />
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmittingAuth}
                  className="btn-primary" 
                  style={{ 
                    padding: '14px', 
                    borderRadius: '12px', 
                    fontWeight: 700, 
                    fontSize: '15px', 
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    width: '100%',
                    opacity: isSubmittingAuth ? 0.7 : 1,
                    cursor: isSubmittingAuth ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingAuth ? 'Memproses...' : (isRegistering ? 'Daftar dengan Email' : 'Masuk')}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0', opacity: 0.3 }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--text)' }}></div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>ATAU</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--text)' }}></div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  onClick={handleLogin}
                  disabled={isSubmittingAuth}
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text)', padding: '14px', borderRadius: '12px', fontWeight: 600, cursor: isSubmittingAuth ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '14px', opacity: isSubmittingAuth ? 0.7 : 1 }}
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
                  {isSubmittingAuth ? 'Memproses Masuk...' : 'Lanjutkan dengan Google'}
                </button>
              </div>

              <p style={{ marginTop: '32px', fontSize: '14px', opacity: 0.8 }}>
                {isRegistering ? 'Sudah punya akun? ' : 'Belum punya akun? '}
                <button 
                  onClick={() => { 
                    setIsRegistering(!isRegistering); 
                    setAuthError(''); 
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
                >
                  {isRegistering ? 'Masuk di sini' : 'Daftar di sini'}
                </button>
              </p>
            </motion.div>
          ) : (
            <>
              {/* ── PROFILE HEADER CARD ── */}
              <motion.div variants={itemVariants} className="account-profile-card" style={{
                background: (!isProfileLoading && !isProfileComplete && !showEditProfile) ? '#ffffff' : 'var(--card-bg)',
                border: (!isProfileLoading && !isProfileComplete && !showEditProfile) ? '1px solid #e2e8f0' : '1px solid var(--card-border)',
                borderRadius: '24px',
                padding: '22px 20px',
                marginBottom: '16px',
                boxShadow: (!isProfileLoading && !isProfileComplete && !showEditProfile) ? '0 0 0 2px var(--primary), 0 25px 60px rgba(0,0,0,0.6)' : 'none',
                position: 'relative',
                zIndex: (!isProfileLoading && !isProfileComplete && !showEditProfile) ? 1002 : 'auto',
                transition: 'all 0.3s ease'
              }}>
                {/* Top row: avatar with corner edit button + name/email/phone */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                  {/* Avatar with overlapping circular edit button */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div className="account-profile-avatar" style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '26px',
                      fontFamily: 'var(--font-poppins)',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                      overflow: 'hidden'
                    }}>
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={userProfileData?.nickname || userProfileData?.name || user.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        getInitials(userProfileData?.nickname || userProfileData?.name || user.displayName || user.email)
                      )}
                    </div>

                    {/* Circular Pen Button overlapping bottom-right corner */}
                    <motion.button
                      animate={(!isProfileLoading && !isProfileComplete && !showEditProfile) ? {
                        scale: [1, 1.2, 1],
                        boxShadow: [
                          '0 0 0 0px rgba(37, 99, 235, 0.8)',
                          '0 0 0 10px rgba(37, 99, 235, 0)',
                          '0 0 0 0px rgba(37, 99, 235, 0.8)'
                        ]
                      } : {}}
                      transition={(!isProfileLoading && !isProfileComplete && !showEditProfile) ? {
                        repeat: Infinity,
                        duration: 1.5,
                        ease: 'easeInOut'
                      } : {}}
                      onClick={() => setShowEditProfile(true)}
                      aria-label="Edit Profil"
                      title="Edit Profil"
                      style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        color: '#ffffff',
                        border: '2.5px solid #ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        zIndex: 1003
                      }}
                    >
                      <FiEdit3 size={13} color="#ffffff" />
                    </motion.button>
                  </div>

                  {/* Nickname as main name + email + phone */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 className="account-profile-name" style={{ fontSize: '18px', fontWeight: 800, color: (!isProfileLoading && !isProfileComplete && !showEditProfile) ? '#0f172a' : 'var(--text-bold)', margin: '0 0 3px 0', fontFamily: 'var(--font-poppins)', lineHeight: 1.3, wordBreak: 'break-word' }}>
                      {userProfileData?.nickname || userProfileData?.name || user.displayName || 'Relawan'}
                    </h2>
                    <p style={{ fontSize: '12.5px', color: (!isProfileLoading && !isProfileComplete && !showEditProfile) ? '#64748b' : 'inherit', opacity: (!isProfileLoading && !isProfileComplete && !showEditProfile) ? 1 : 0.7, margin: '0 0 6px 0', wordBreak: 'break-all' }}>{user.email}</p>
                    {isProfileLoading ? (
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0, opacity: 0.6 }}>
                        Memuat data...
                      </p>
                    ) : userProfileData?.phone ? (
                      <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0, fontWeight: 500 }}>
                        +{userProfileData.phone}
                      </p>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#dc2626', background: '#fee2e2', padding: '3px 9px', borderRadius: '6px', fontWeight: 700 }}>
                        <FiAlertCircle size={12} /> WhatsApp Belum Diisi
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* ── FREEZE & DIM ONBOARDING SPOTLIGHT OVERLAY ── */}
              <AnimatePresence>
                {!isProfileLoading && !isProfileComplete && !showEditProfile && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 1000,
                      background: 'rgba(15, 23, 42, 0.8)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      pointerEvents: 'all'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </AnimatePresence>

              {/* ── INCOMPLETE PROFILE ALERT BANNER ── */}
              {!isProfileLoading && !isProfileComplete && (
                <motion.div variants={itemVariants} style={{
                  background: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ color: '#dc2626', display: 'flex', alignItems: 'center', fontSize: '22px' }}>
                      <FiAlertCircle />
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', color: '#991b1b', fontSize: '14px', fontWeight: 800 }}>
                        Profil Anda Belum Lengkap
                      </h4>
                      <p style={{ margin: 0, color: '#b91c1c', fontSize: '12px', lineHeight: 1.4 }}>
                        Lengkapi data profil Anda untuk kemudahan pendaftaran dan penerbitan sertifikat resmi.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEditProfile(true)}
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      boxShadow: 'none'
                    }}
                  >
                    Lengkapi Sekarang
                  </button>
                </motion.div>
              )}

              {/* ── STATS OVERVIEW CARDS ── */}
              <motion.div variants={itemVariants} className="account-stats-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '28px'
              }}>
                <div className="account-stats-card" style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '16px',
                  padding: '16px 12px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', margin: '0 0 4px 0' }}>
                    {myPrograms.filter(p => p.status !== 'Dibatalkan').length}
                  </h3>
                  <p style={{ fontSize: '11px', opacity: 0.6, margin: 0, fontWeight: 600 }}>Aktivitas Diikuti</p>
                </div>

                <div className="account-stats-card" style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '16px',
                  padding: '16px 12px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent)', margin: '0 0 4px 0' }}>
                    {calculateTotalContributionHours(myPrograms)}
                  </h3>
                  <p style={{ fontSize: '11px', opacity: 0.6, margin: 0, fontWeight: 600 }}>Jam Kontribusi</p>
                </div>

                <div className="account-stats-card" style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '16px',
                  padding: '16px 12px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', margin: '0 0 4px 0' }}>
                    {myPrograms
                      .filter(p => p.status !== 'Dibatalkan' && p.status !== 'Dikeluarkan')
                      .reduce((acc, p) => acc + (Number(p.beneficiariesCount || p.beneficiaries) || 0), 0)
                      .toLocaleString('id-ID')}
                  </h3>
                  <p style={{ fontSize: '11px', opacity: 0.6, margin: 0, fontWeight: 600 }}>Orang Terbantu</p>
                </div>
              </motion.div>

              {/* ── MENU GROUP: AKTIVITAS & RELAWAN ── */}
              <motion.div variants={itemVariants} style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, opacity: 0.5, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Aktivitas & Relawan
                </p>
                <div style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '20px',
                  overflow: 'hidden'
                }}>
                  <div 
                    onClick={() => setActiveTab(activeTab === 'activities' ? 'profile' : 'activities')}
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiHeart size={18} fill="#eab308" color="#eab308" />
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-bold)' }}>Aktivitas Relawan Saya</span>
                    </div>
                    <FiChevronRight size={18} style={{ opacity: 0.5, transform: activeTab === 'activities' ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                </div>
              </motion.div>

              {/* ── EXPANDABLE CONTENT SECTION (ACTIVITIES) ── */}
              <AnimatePresence>
                {activeTab === 'activities' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ marginBottom: '28px' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                      {myPrograms.filter(p => p.status !== 'Dibatalkan').length === 0 ? (
                        <p style={{ fontSize: '14px', opacity: 0.6 }}>Belum ada aktivitas aktif yang Anda ikuti.</p>
                      ) : (
                        myPrograms
                          .filter(p => p.status !== 'Dibatalkan')
                          .sort((a, b) => {
                            const timeA = new Date(a.appliedAt || a.createdAt || a.programDate || 0).getTime();
                            const timeB = new Date(b.appliedAt || b.createdAt || b.programDate || 0).getTime();
                            return timeB - timeA;
                          })
                          .map(prog => {
                          const isFinished = prog.status === 'Selesai' || (prog.programDate && new Date(prog.programDate) < new Date(new Date().setHours(0,0,0,0)));

                          return (
                            <div 
                              key={prog.id} 
                              onClick={() => {
                                if (isFinished) {
                                  handleOpenClaimCertificateStory(prog);
                                } else {
                                  router.push(`/kegiatan/${prog.programId}/invoice`);
                                }
                              }}
                              style={{
                                background: 'var(--card-bg)',
                                border: '1px solid var(--card-border)',
                                borderRadius: '16px',
                                padding: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                cursor: 'pointer',
                                transition: 'transform 0.2s, box-shadow 0.2s'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                              <img src={prog.programImageUrl} alt={prog.programTitle} style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover' }} />
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: isFinished ? '#16a34a' : 'var(--primary)', textTransform: 'uppercase' }}>
                                  {isFinished ? 'Selesai' : prog.status}
                                </span>
                                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '2px 0 4px 0' }}>{prog.programTitle}</h4>
                                <p style={{ fontSize: '12px', opacity: 0.6, margin: 0 }}>{prog.programDate} • {prog.programLocation}</p>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {prog.status === 'Terdaftar' && !isFinished && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCancelingApp(prog);
                                      setCancelModalOpen(true);
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      background: '#fef2f2',
                                      color: '#ef4444',
                                      border: '1px solid #fecaca',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Batalkan
                                  </button>
                                )}
                                <FiChevronRight size={20} color="var(--primary)" style={{ opacity: 0.5 }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* RIWAYAT PEMBATALAN */}
                    {myPrograms.filter(p => p.status === 'Dibatalkan').length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          Riwayat Pembatalan Pendaftaran
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {myPrograms.filter(p => p.status === 'Dibatalkan').map(prog => (
                            <div 
                              key={prog.id} 
                              onClick={() => router.push(`/kegiatan/${prog.programId}`)}
                              style={{
                                background: 'var(--card-bg)',
                                border: '1px border-dashed #fca5a5',
                                borderRadius: '16px',
                                padding: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                opacity: 0.85,
                                cursor: 'pointer'
                              }}
                            >
                              <img src={prog.programImageUrl} alt={prog.programTitle} style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', filter: 'grayscale(60%)' }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Dibatalkan</span>
                                  {prog.canceledAt && (
                                    <span style={{ fontSize: '11px', opacity: 0.5 }}>{new Date(prog.canceledAt).toLocaleDateString('id-ID')}</span>
                                  )}
                                </div>
                                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '4px 0' }}>{prog.programTitle}</h4>
                                {prog.cancelReason && (
                                  <p style={{ fontSize: '12px', color: '#ef4444', margin: '2px 0 0 0', fontStyle: 'italic' }}>Alasan: {prog.cancelReason}</p>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/kegiatan/${prog.programId}`);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  background: 'var(--primary)',
                                  color: 'white',
                                  border: 'none',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Daftar Lagi
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── MENU GROUP: PENGATURAN & BANTUAN ── */}
              <motion.div variants={itemVariants} style={{ marginBottom: '28px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, opacity: 0.5, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Pengaturan & Bantuan
                </p>
                <div style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '20px',
                  overflow: 'hidden'
                }}>
                  <div 
                    onClick={openSecurityModal}
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--card-border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiShield size={18} />
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-bold)' }}>Keamanan & Sandi</span>
                    </div>
                    <FiChevronRight size={18} style={{ opacity: 0.5 }} />
                  </div>

                  <div style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiHelpCircle size={18} />
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-bold)' }}>Pusat Bantuan & FAQ</span>
                    </div>
                    <FiChevronRight size={18} style={{ opacity: 0.5 }} />
                  </div>
                </div>
              </motion.div>

              {/* ── LOGOUT BUTTON (PEDULY STYLE) ── */}
              <motion.div variants={itemVariants}>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '16px',
                    border: '1px solid #fee2e2',
                    background: '#fff1f2',
                    color: '#e11d48',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontFamily: 'var(--font-poppins)'
                  }}
                >
                  <FiLogOut size={18} /> Keluar dari Akun
                </button>
              </motion.div>

              {/* Edit Profile Fullscreen View */}
              <AnimatePresence>
                {showEditProfile && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      width: '100vw',
                      height: '100dvh',
                      background: '#f8fafc',
                      zIndex: 1200,
                      display: 'flex',
                      flexDirection: 'column',
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch'
                    }}
                  >
                    {/* Sticky Top Header */}
                    <div style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 30,
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      borderBottom: '1px solid #e2e8f0',
                      padding: '12px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                    }}>
                      <div style={{ width: '40px', display: 'flex', alignItems: 'center' }}>
                        {isProfileComplete && (
                          <button
                            type="button"
                            onClick={() => setShowEditProfile(false)}
                            aria-label="Kembali"
                            style={{
                              background: '#f1f5f9',
                              border: 'none',
                              width: '38px',
                              height: '38px',
                              borderRadius: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#334155',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <FiArrowLeft size={19} />
                          </button>
                        )}
                      </div>

                      <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
                        <h1 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a', fontFamily: 'var(--font-poppins)' }}>
                          {isProfileComplete ? 'Perbarui Profil Anda' : 'Lengkapi Profil Anda'}
                        </h1>
                      </div>

                      <div style={{ width: '40px' }} />
                    </div>

                    {/* Content Container */}
                    <div style={{
                      maxWidth: '560px',
                      width: '100%',
                      margin: '0 auto',
                      padding: '24px 16px 80px 16px',
                      boxSizing: 'border-box'
                    }}>
                      {/* Info Banner */}
                      <div style={{
                        background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                        border: '1px solid #bfdbfe',
                        borderRadius: '16px',
                        padding: '14px 16px',
                        marginBottom: '20px',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start'
                      }}>
                        <FiShield size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ color: '#334155', fontSize: '12.5px', lineHeight: '1.55' }}>
                          Data profil ini digunakan untuk <strong>kebutuhan pembuatan sertifikat</strong>, <strong>kemudahan komunikasi</strong>, dan <strong>analisis statistik</strong> kegiatan kerelawanan Anda di Untuk Esok.
                        </div>
                      </div>

                      {/* Form Card */}
                      <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        padding: '24px 20px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                      }}>
                        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                          {/* Nama Lengkap */}
                          <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                              Nama Lengkap Asli <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input 
                              type="text" 
                              placeholder="Nama Lengkap Asli (sesuai identitas)" 
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              style={{ width: '100%', padding: '13px 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontWeight: 500, fontFamily: 'var(--font-poppins)' }}
                              required
                            />
                            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                              Akan tercetak di sertifikat resmi kegiatan
                            </span>
                          </div>

                          {/* Nama Panggilan */}
                          <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                              Nama Panggilan <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input 
                              type="text" 
                              placeholder="Nama Panggilan (maksimal 2 kata)" 
                              value={editNickname}
                              onChange={(e) => {
                                const val = e.target.value;
                                const words = val.trim().split(/\s+/);
                                if (words.length > 2) {
                                  setEditNickname(words.slice(0, 2).join(' '));
                                } else {
                                  setEditNickname(val);
                                }
                              }}
                              style={{ width: '100%', padding: '13px 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontWeight: 500, fontFamily: 'var(--font-poppins)' }}
                              required
                            />
                            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                              Digunakan untuk sapaan dan kartu ID relawan (boleh maksimal 2 kata)
                            </span>
                          </div>

                          {/* Jenis Kelamin (Gender Switch) */}
                          <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                              Jenis Kelamin <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{
                              display: 'flex',
                              background: '#f1f5f9',
                              borderRadius: '12px',
                              padding: '4px',
                              border: '1.5px solid #cbd5e1',
                              gap: '4px'
                            }}>
                              <button
                                type="button"
                                onClick={() => setEditGender('Laki-laki')}
                                style={{
                                  flex: 1,
                                  padding: '11px 14px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: editGender === 'Laki-laki' ? 'var(--primary)' : 'transparent',
                                  color: editGender === 'Laki-laki' ? '#ffffff' : '#64748b',
                                  fontWeight: editGender === 'Laki-laki' ? 700 : 600,
                                  fontSize: '13.5px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontFamily: 'var(--font-poppins)'
                                }}
                              >
                                Laki-laki
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditGender('Perempuan')}
                                style={{
                                  flex: 1,
                                  padding: '11px 14px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: editGender === 'Perempuan' ? 'var(--primary)' : 'transparent',
                                  color: editGender === 'Perempuan' ? '#ffffff' : '#64748b',
                                  fontWeight: editGender === 'Perempuan' ? 700 : 600,
                                  fontSize: '13.5px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontFamily: 'var(--font-poppins)'
                                }}
                              >
                                Perempuan
                              </button>
                            </div>
                          </div>

                          {/* Tahun Kelahiran */}
                          <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                              Tahun Kelahiran <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              min="1940"
                              max={new Date().getFullYear()}
                              placeholder={`Contoh: ${new Date().getFullYear() - 22}`} 
                              value={editBirthYear}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setEditBirthYear(val);
                              }}
                              style={{ width: '100%', padding: '13px 14px', borderRadius: '12px', border: '1.5px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontWeight: 500, fontFamily: 'var(--font-poppins)' }}
                              required
                            />
                            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                              Digunakan untuk analisis demografi dan penyesuaian peran kegiatan
                            </span>
                          </div>

                          {/* Nomor WhatsApp */}
                          <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                              Nomor WhatsApp Aktif <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ display: 'flex', borderRadius: '12px', border: '1.5px solid #cbd5e1', overflow: 'hidden', background: '#f8fafc' }}>
                              <div style={{ padding: '13px 14px', background: '#f1f5f9', borderRight: '1.5px solid #cbd5e1', fontSize: '14px', fontWeight: 800, color: '#334155', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                +62
                              </div>
                              <input 
                                type="tel" 
                                placeholder="81234567890" 
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value.replace(/^0+/, '').replace(/^\+?62/, ''))}
                                style={{ flex: 1, padding: '13px 14px', border: 'none', background: 'transparent', color: '#0f172a', fontSize: '14px', outline: 'none', minWidth: 0, fontWeight: 500, fontFamily: 'var(--font-poppins)' }}
                                required
                                minLength={7}
                              />
                            </div>
                            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                              Untuk koordinasi briefing dan grup WhatsApp kegiatan
                            </span>
                          </div>

                          {/* Preferensi Commitment Fee (Slider Rp 0K - 150K kelipatan 10K) */}
                          <div style={{ textAlign: 'left' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label htmlFor="feePreference" style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', margin: 0 }}>
                                  Preferensi Commitment Fee
                                </label>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                                  Rp {editFeePreference.toLocaleString('id-ID')}
                                </span>
                              </div>

                            <div style={{ position: 'relative', margin: '12px 0 6px 0' }}>
                              <input 
                                type="range"
                                id="feePreference"
                                min="0"
                                max="150000"
                                step="10000"
                                value={editFeePreference}
                                onChange={(e) => {
                                  setEditFeePreference(Number(e.target.value));
                                  setFeeSliderTouched(true);
                                }}
                                style={{
                                  width: '100%',
                                  accentColor: 'var(--primary)',
                                  cursor: 'pointer',
                                  margin: 0,
                                  display: 'block'
                                }}
                              />
                              {/* Titik opacity penanda Rp 60K (40%) */}
                              <div 
                                style={{
                                  position: 'absolute',
                                  left: '40%',
                                  top: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  background: 'var(--primary)',
                                  opacity: 0.35,
                                  pointerEvents: 'none'
                                }} 
                              />
                            </div>

                            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '6px' }}>
                              <span>Rp 0K</span>
                              <span 
                                onClick={() => setEditFeePreference(60000)}
                                style={{
                                  position: 'absolute',
                                  left: '40%',
                                  transform: 'translateX(-50%)',
                                  fontSize: '10.5px',
                                  color: 'var(--primary)',
                                  opacity: 0.85,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                                title="Pilih Rp 60K (Rata-rata)"
                              >
                                rata-rata orang memilih
                              </span>
                              <span>Rp 150K</span>
                            </div>
                            {!feeSliderTouched && (
                              <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ⚠️ Geser slider ini minimal sekali sebelum menyimpan
                              </p>
                            )}
                          </div>

                          {/* Persetujuan Syarat & Ketentuan */}
                          <div style={{ textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '4px', padding: '0 2px' }}>
                            <input 
                              type="checkbox" 
                              id="agreeTerms" 
                              checked={agreedTerms}
                              onChange={(e) => setAgreedTerms(e.target.checked)}
                              style={{ marginTop: '3px', width: '17px', height: '17px', accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                              required
                            />
                            <label htmlFor="agreeTerms" style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.5', cursor: 'pointer' }}>
                              Saya mengetahui & menyetujui{' '}
                              <a 
                                href="https://docs.google.com/document/d/1M9Hcz-cGnKskSCSPEMi962ZM3i7pXs053U7_Dw-tM-c/edit?usp=sharing" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ color: '#334155', fontWeight: 700, textDecoration: 'none' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Persetujuan Syarat & Ketentuan
                              </a>{' '}
                              yang berlaku.
                            </label>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            {isProfileComplete && (
                              <button 
                                type="button"
                                disabled={isUpdatingProfile}
                                onClick={() => setShowEditProfile(false)}
                                style={{ 
                                  flex: 1, 
                                  padding: '14px', 
                                  borderRadius: '12px', 
                                  border: '1.5px solid #cbd5e1', 
                                  background: '#ffffff', 
                                  fontWeight: 600, 
                                  cursor: isUpdatingProfile ? 'not-allowed' : 'pointer', 
                                  color: '#334155', 
                                  opacity: isUpdatingProfile ? 0.6 : 1,
                                  fontFamily: 'var(--font-poppins)',
                                  fontSize: '14px'
                                }}
                              >
                                Batal
                              </button>
                            )}
                            <button 
                              type="submit"
                              disabled={isUpdatingProfile}
                              style={{ 
                                flex: 2, 
                                padding: '14px', 
                                borderRadius: '12px', 
                                border: 'none', 
                                background: 'var(--primary)', 
                                color: 'white', 
                                fontWeight: 700, 
                                cursor: isUpdatingProfile ? 'not-allowed' : 'pointer', 
                                opacity: isUpdatingProfile ? 0.7 : 1,
                                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                                fontFamily: 'var(--font-poppins)',
                                fontSize: '14px'
                              }}
                            >
                              {isUpdatingProfile ? 'Menyimpan...' : (isProfileComplete ? 'Simpan Perubahan' : 'Simpan & Lengkapi Profil')}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── SECURITY & MULTI-AUTH MODAL ── */}
              <AnimatePresence>
                {showSecurityModal && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                      zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '20px', backdropFilter: 'blur(4px)'
                    }}
                    onClick={(e) => {
                      if (e.target === e.currentTarget && !secLoading) {
                        setShowSecurityModal(false);
                      }
                    }}
                  >
                    <motion.div 
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.95 }}
                      style={{
                        background: 'white',
                        borderRadius: '24px',
                        padding: '26px 22px',
                        maxWidth: '460px',
                        width: '100%',
                        textAlign: 'left',
                        boxShadow: 'none',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                      }}
                    >
                      {/* Modal Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eff6ff', color: 'var(--primary)', padding: '3px 10px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, marginBottom: '6px' }}>
                            <FiShield size={13} /> KEAMANAN & AKSES MULTI-LOGIN
                          </div>
                          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a', fontFamily: 'var(--font-poppins)' }}>
                            Metode Masuk & Sandi
                          </h2>
                          <p style={{ margin: '3px 0 0 0', color: '#64748b', fontSize: '12.5px' }}>
                            Hubungkan Google, Email, dan WhatsApp agar 1 akun dapat diakses dengan 3+ cara.
                          </p>
                        </div>
                        <button 
                          onClick={() => setShowSecurityModal(false)}
                          style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                        >
                          <FiX size={18} />
                        </button>
                      </div>

                      {/* Alert Message */}
                      {secMessage.text && (
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          marginBottom: '14px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          background: secMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
                          color: secMessage.type === 'success' ? '#166534' : '#991b1b',
                          border: `1px solid ${secMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                        }}>
                          {secMessage.text}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* 1. AKUN GOOGLE */}
                        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffffff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: '#003d79' }}>
                                G
                              </div>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Akun Google</div>
                                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                  {user?.providerData?.some(p => p.providerId === 'google.com') 
                                    ? (user?.email || 'Google Terhubung')
                                    : 'Belum terhubung ke Google SSO'}
                                </div>
                              </div>
                            </div>
                            {user?.providerData?.some(p => p.providerId === 'google.com') ? (
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '4px 10px', borderRadius: '20px', border: '1px solid #bbf7d0' }}>
                                Terhubung
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={secLoading}
                                onClick={handleLinkGoogle}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: 'var(--primary)',
                                  color: 'white',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: secLoading ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Hubungkan
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 2. EMAIL & KATA SANDI */}
                        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffffff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003d79' }}>
                                <FiMail size={18} />
                              </div>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Email & Kata Sandi</div>
                                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                  {user?.email || userProfileData?.email || 'Belum ada email'}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowPasswordForm(!showPasswordForm);
                                  setShowPhoneForm(false);
                                }}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#003d79',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                {showPasswordForm ? 'Tutup' : 'Set Sandi'}
                              </button>
                            </div>
                          </div>

                          {/* Inline Set Password Form */}
                          {showPasswordForm && (
                            <form onSubmit={handleSetPassword} style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                                Setel / Ubah Kata Sandi Akun
                              </label>
                              <input 
                                type="password" 
                                placeholder="Kata Sandi Baru (min. 6 karakter)" 
                                value={secNewPassword}
                                onChange={(e) => setSecNewPassword(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                required
                                minLength={6}
                              />
                              <input 
                                type="password" 
                                placeholder="Konfirmasi Kata Sandi Baru" 
                                value={secConfirmPassword}
                                onChange={(e) => setSecConfirmPassword(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                required
                                minLength={6}
                              />
                              <button
                                type="submit"
                                disabled={secLoading}
                                style={{
                                  padding: '10px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: 'var(--primary)',
                                  color: 'white',
                                  fontSize: '12.5px',
                                  fontWeight: 700,
                                  cursor: secLoading ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {secLoading ? 'Menyimpan...' : 'Simpan Kata Sandi'}
                              </button>
                            </form>
                          )}
                        </div>

                        {/* 3. NOMOR WHATSAPP / HP */}
                        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffffff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>
                                <FiPhone size={18} />
                              </div>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Nomor WhatsApp / HP</div>
                                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                  {userProfileData?.phone ? `+${userProfileData.phone}` : 'Belum ditambahkan'}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowPhoneForm(!showPhoneForm);
                                setShowPasswordForm(false);
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#003d79',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              {showPhoneForm ? 'Tutup' : 'Ubah No HP'}
                            </button>
                          </div>

                          {/* Inline Edit Phone Form */}
                          {showPhoneForm && (
                            <form onSubmit={handleUpdateSecPhone} style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                                Nomor WhatsApp Aktif
                              </label>
                              <div style={{ display: 'flex', borderRadius: '8px', border: '1.5px solid #cbd5e1', overflow: 'hidden', background: '#ffffff' }}>
                                <div style={{ padding: '10px 12px', background: '#f1f5f9', borderRight: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 800, color: '#334155' }}>
                                  +62
                                </div>
                                <input 
                                  type="tel" 
                                  placeholder="81234567890" 
                                  value={secPhone}
                                  onChange={(e) => setSecPhone(e.target.value.replace(/^0+/, '').replace(/^\+?62/, ''))}
                                  style={{ flex: 1, padding: '10px 12px', border: 'none', background: 'transparent', color: '#0f172a', fontSize: '13px', outline: 'none' }}
                                  required
                                  minLength={7}
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={secLoading}
                                style={{
                                  padding: '10px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: '#166534',
                                  color: 'white',
                                  fontSize: '12.5px',
                                  fontWeight: 700,
                                  cursor: secLoading ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {secLoading ? 'Menyimpan...' : 'Simpan Nomor HP'}
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── PROGRESSIVE CLAIM CERTIFICATE STORY MODAL (FULL PAGE WHITE) ── */}
              <AnimatePresence>
                {showClaimStory && storyApp && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      background: '#ffffff',
                      zIndex: 2000,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      color: '#0f172a',
                      fontFamily: 'inherit'
                    }}
                  >
                    <div style={{
                      maxWidth: '480px',
                      width: '100%',
                      margin: '0 auto',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative'
                    }}>
                      {/* Top 4 Story Segment Bars */}
                      <div style={{
                        padding: '16px 20px 10px 20px',
                        display: 'flex',
                        gap: '8px',
                        zIndex: 30,
                        position: 'relative'
                      }}>
                        {[1, 2, 3, 4].map((s) => {
                          let width = '0%';
                          if (storySlide > s) {
                            width = '100%';
                          } else if (storySlide === s) {
                            if (s === 3) {
                              width = isStoryFeedbackDone ? '100%' : '0%';
                            } else {
                              width = `${storyProgress}%`;
                            }
                          }

                          return (
                            <div
                              key={s}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isStoryFeedbackDone || storySlide >= s) {
                                  setStorySlide(s);
                                }
                              }}
                              style={{
                                flex: 1,
                                height: '4px',
                                borderRadius: '4px',
                                background: '#e2e8f0',
                                overflow: 'hidden',
                                cursor: 'pointer'
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width,
                                  background: '#0f172a',
                                  transition: storySlide === s ? 'none' : 'width 0.2s ease'
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Initial Dim & Blur Navigation Tutorial Overlay */}
                      <AnimatePresence>
                        {showStoryHint && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            onClick={() => setShowStoryHint(false)}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              zIndex: 50,
                              background: 'rgba(15, 23, 42, 0.75)',
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '50px 24px 40px 24px',
                              color: '#ffffff',
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                          >
                            {/* Center Left/Right Tap Hints */}
                            <div style={{
                              display: 'flex',
                              width: '100%',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0 8px',
                              margin: 'auto 0'
                            }}>
                              {/* Left Side Hint */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '10px',
                                width: '45%',
                                textAlign: 'center'
                              }}>
                                <div style={{
                                  width: '54px',
                                  height: '54px',
                                  borderRadius: '50%',
                                  background: 'rgba(255, 255, 255, 0.12)',
                                  border: '1.5px dashed rgba(255, 255, 255, 0.5)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <FiArrowLeft size={24} color="#ffffff" />
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                                  Ketuk Kiri
                                </span>
                                <span style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.3' }}>
                                  Kembali ke slide sebelumnya
                                </span>
                              </div>

                              {/* Divider line */}
                              <div style={{
                                width: '1px',
                                height: '70px',
                                background: 'rgba(255, 255, 255, 0.2)'
                              }} />

                              {/* Right Side Hint */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '10px',
                                width: '45%',
                                textAlign: 'center'
                              }}>
                                <div style={{
                                  width: '54px',
                                  height: '54px',
                                  borderRadius: '50%',
                                  background: 'rgba(255, 255, 255, 0.12)',
                                  border: '1.5px dashed rgba(255, 255, 255, 0.5)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <FiArrowRight size={24} color="#ffffff" />
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                                  Ketuk Kanan
                                </span>
                                <span style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.3' }}>
                                  Lanjut ke slide berikutnya
                                </span>
                              </div>
                            </div>

                            {/* Bottom Start Action Button */}
                            <div style={{
                              textAlign: 'center',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <div style={{
                                padding: '12px 32px',
                                borderRadius: '9999px',
                                background: '#ffffff',
                                color: '#0f172a',
                                fontSize: '14px',
                                fontWeight: 800,
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                              }}>
                                Mulai
                              </div>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                (ketuk di mana saja untuk memulai)
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Tap left to previous slide (25% width, full height) - Hanya aktif di slide non-form */}
                      {storySlide !== 3 && (
                        <div
                          onClick={handlePrevSlide}
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '25%',
                            zIndex: 10,
                            cursor: 'pointer'
                          }}
                          aria-label="Kembali"
                        />
                      )}

                      {/* Tap right to next slide (25% width, full height) - Hanya aktif di slide non-form */}
                      {storySlide !== 3 && (
                        <div
                          onClick={handleNextSlide}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '25%',
                            zIndex: 10,
                            cursor: 'pointer'
                          }}
                          aria-label="Berikutnya"
                        />
                      )}

                      {/* Story Main Content Slides */}
                      <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px 24px 32px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        position: 'relative',
                        zIndex: 20,
                        pointerEvents: storySlide === 3 || storySlide === 4 ? 'auto' : 'none'
                      }}>
                        <AnimatePresence mode="wait">
                          {/* ── SLIDE 1: APRESIASI PARTISIPASI ── */}
                          {storySlide === 1 && (
                            <motion.div
                              key="slide-1"
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.25 }}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                justifyContent: 'center'
                              }}
                            >
                              <div style={{ textAlign: 'center' }}>
                                <div style={{
                                  width: '100%',
                                  height: '220px',
                                  borderRadius: '24px',
                                  overflow: 'hidden',
                                  position: 'relative',
                                  marginBottom: '24px',
                                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)'
                                }}>
                                  <img
                                    src={storyApp.programImageUrl}
                                    alt={storyApp.programTitle}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(0deg, rgba(15, 23, 42, 0.8) 0%, transparent 60%)',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    padding: '16px'
                                  }}>
                                    <span style={{ fontSize: '12px', color: '#ffffff', fontWeight: 600 }}>
                                      {storyApp.programDate} • {storyApp.programLocation}
                                    </span>
                                  </div>
                                </div>

                                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', marginBottom: '12px', lineHeight: '1.3' }}>
                                  Terima Kasih, {userProfileData?.name || user?.displayName || 'Sahabat Relawan'}!
                                </h2>

                                <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0' }}>
                                  Kehadiran, waktu, dan energi tulus yang Anda dedikasikan pada aksi <strong>{storyApp.programTitle}</strong> telah menghadirkan senyum dan harapan nyata bagi mereka yang membutuhkan.
                                </p>
                              </div>
                            </motion.div>
                          )}

                          {/* ── SLIDE 2: STATISTIK TERKINI (IDENTIK DENGAN POSTER DAMPAK) ── */}
                          {storySlide === 2 && (
                            <motion.div
                              key="slide-2"
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.25 }}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                justifyContent: 'center',
                                alignItems: 'center',
                                position: 'relative',
                                width: '100%'
                              }}
                            >
                              <div style={{ position: 'relative', width: '100%', maxWidth: '340px', margin: '0 auto' }}>
                                <svg
                                  viewBox="0 0 380 620"
                                  style={{ width: '100%', height: 'auto', maxHeight: '68vh', display: 'block', margin: '0 auto', overflow: 'visible' }}
                                >
                                  {/* Logo UE di dekat atas dengan padding */}
                                  <motion.image
                                    href="/logo_UE.webp"
                                    x="166"
                                    y="46"
                                    width="48"
                                    height="48"
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.15 }}
                                  />

                                  {/* Ribbon 1: Top-Right (Ular Biru Muncul Meluncur) */}
                                  <motion.path
                                    d="M 310 90 C 310 50, 335 30, 350 70 C 365 110, 370 150, 385 85 C 395 50, 415 60, 415 110 C 415 150, 430 160, 430 130"
                                    fill="none"
                                    stroke="#3b82f6"
                                    strokeWidth="20"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1 }}
                                    transition={{ duration: 0.9, ease: "easeInOut", delay: 0.1 }}
                                  />

                                  {/* Ribbon 2: Left Middle (Ular Biru Muncul Meluncur) */}
                                  <motion.path
                                    d="M 60 220 C 35 210, -10 225, -15 255 C -20 290, 5 315, 20 275 C 32 240, 55 235, 85 225"
                                    fill="none"
                                    stroke="#3b82f6"
                                    strokeWidth="20"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1 }}
                                    transition={{ duration: 0.85, ease: "easeInOut", delay: 0.25 }}
                                  />

                                  {/* Ribbon 3: Bottom Zigzag Wave (Ular Biru Muncul Meluncur) */}
                                  <motion.path
                                    d="M 15 440 L 22 485 C 28 520, 50 525, 65 495 C 80 465, 90 465, 105 510 C 125 570, 175 605, 210 530 C 230 490, 245 500, 260 520"
                                    fill="none"
                                    stroke="#3b82f6"
                                    strokeWidth="22"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1 }}
                                    transition={{ duration: 1.05, ease: "easeInOut", delay: 0.35 }}
                                  />

                                  {/* ── PILL 1: AKTIVITAS DIIKUTI ── */}
                                  <motion.g
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.65 }}
                                    style={{ transformOrigin: "190px 179px" }}
                                  >
                                    <rect
                                      x="35"
                                      y="125"
                                      width="310"
                                      height="108"
                                      rx="54"
                                      ry="54"
                                      fill="#f79e38"
                                    />

                                    {/* Sticker 1: Asterisk Flower (Top-Left Pill 1) */}
                                    <g transform="translate(48, 126)">
                                      <circle cx="0" cy="0" r="24" fill="#f79e38" stroke="#ffffff" strokeWidth="2.5" />
                                      <g stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round">
                                        <line x1="0" y1="-14" x2="0" y2="14" />
                                        <line x1="-14" y1="0" x2="14" y2="0" />
                                        <line x1="-10" y1="-10" x2="10" y2="10" />
                                        <line x1="-10" y1="10" x2="10" y2="-10" />
                                      </g>
                                      <circle cx="0" cy="0" r="3.5" fill="#ffffff" />
                                    </g>

                                    {/* Angka & Label Pill 1 */}
                                    <text
                                      x="190"
                                      y="182"
                                      textAnchor="middle"
                                      fill="#ffffff"
                                      fontSize="58"
                                      fontWeight="900"
                                      fontFamily="'Poppins', sans-serif"
                                    >
                                      {countAktivitas}
                                    </text>
                                    <text
                                      x="190"
                                      y="208"
                                      textAnchor="middle"
                                      fill="#ffffff"
                                      fontSize="15"
                                      fontWeight="700"
                                      fontFamily="'Poppins', sans-serif"
                                    >
                                      Aktivitas Diikuti
                                    </text>
                                  </motion.g>

                                  {/* ── PILL 2: JAM KONTRIBUSI ── */}
                                  <motion.g
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.85 }}
                                    style={{ transformOrigin: "190px 299px" }}
                                  >
                                    <rect
                                      x="35"
                                      y="245"
                                      width="310"
                                      height="108"
                                      rx="54"
                                      ry="54"
                                      fill="#004d99"
                                    />

                                    {/* Angka & Label Pill 2 */}
                                    <text
                                      x="190"
                                      y="302"
                                      textAnchor="middle"
                                      fill="#ffffff"
                                      fontSize="58"
                                      fontWeight="900"
                                      fontFamily="'Poppins', sans-serif"
                                    >
                                      {countJam}
                                    </text>
                                    <text
                                      x="190"
                                      y="328"
                                      textAnchor="middle"
                                      fill="#ffffff"
                                      fontSize="15"
                                      fontWeight="700"
                                      fontFamily="'Poppins', sans-serif"
                                    >
                                      Jam Kontribusi
                                    </text>
                                  </motion.g>

                                  {/* ── PILL 3: ORANG TERBANTU ── */}
                                  <motion.g
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", stiffness: 350, damping: 22, delay: 1.05 }}
                                    style={{ transformOrigin: "190px 419px" }}
                                  >
                                    <rect
                                      x="35"
                                      y="365"
                                      width="310"
                                      height="108"
                                      rx="54"
                                      ry="54"
                                      fill="#f79e38"
                                    />

                                    {/* Sticker 3: Asterisk Flower (Top-Right Pill 3) */}
                                    <g transform="translate(314, 366)">
                                      <circle cx="0" cy="0" r="24" fill="#f79e38" stroke="#ffffff" strokeWidth="2.5" />
                                      <g stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round">
                                        <line x1="0" y1="-14" x2="0" y2="14" />
                                        <line x1="-14" y1="0" x2="14" y2="0" />
                                        <line x1="-10" y1="-10" x2="10" y2="10" />
                                        <line x1="-10" y1="10" x2="10" y2="-10" />
                                      </g>
                                      <circle cx="0" cy="0" r="3.5" fill="#ffffff" />
                                    </g>

                                    {/* Angka & Label Pill 3 */}
                                    <text
                                      x="190"
                                      y="422"
                                      textAnchor="middle"
                                      fill="#ffffff"
                                      fontSize="58"
                                      fontWeight="900"
                                      fontFamily="'Poppins', sans-serif"
                                    >
                                      {countTerbantu.toLocaleString('id-ID')}
                                    </text>
                                    <text
                                      x="190"
                                      y="448"
                                      textAnchor="middle"
                                      fill="#ffffff"
                                      fontSize="15"
                                      fontWeight="700"
                                      fontFamily="'Poppins', sans-serif"
                                    >
                                      Orang Terbantu
                                    </text>
                                  </motion.g>
                                </svg>

                                {/* Tombol Simpan Gambar PNG */}
                                <motion.div
                                  initial={{ opacity: 0, y: 12 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 1.75, duration: 0.35 }}
                                  style={{ textAlign: 'center', marginTop: '12px', pointerEvents: 'auto' }}
                                >
                                  <button
                                    type="button"
                                    disabled={isGeneratingPng}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      exportClaimCertificatePng(storyApp);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: isGeneratingPng ? 'not-allowed' : 'pointer',
                                      padding: '6px 14px'
                                    }}
                                  >
                                    <div style={{
                                      width: '46px',
                                      height: '46px',
                                      borderRadius: '50%',
                                      background: '#f8fafc',
                                      border: '1.5px solid #e2e8f0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#0f172a',
                                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                                      transition: 'all 0.2s'
                                    }}>
                                      <FiDownload size={20} />
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                                      {isGeneratingPng ? 'Menyimpan...' : 'Simpan'}
                                    </span>
                                  </button>
                                </motion.div>
                              </div>
                            </motion.div>
                          )}

                          {/* ── SLIDE 3: FORM ULASAN ANDA ── */}
                          {storySlide === 3 && (
                            <motion.div
                              key="slide-3"
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.25 }}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                justifyContent: 'center',
                                alignItems: 'center',
                                pointerEvents: 'auto'
                              }}
                            >
                              <form
                                onSubmit={handleSubmitStoryFeedback}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  width: '100%',
                                  justifyContent: 'center',
                                  margin: 'auto 0',
                                  pointerEvents: 'auto'
                                }}
                              >
                                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                  <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                                    Ulasan & Refleksi Anda
                                  </h3>
                                </div>

                                {/* Star Rating */}
                                <div style={{
                                  background: '#f8fafc',
                                  border: '1.5px solid #e2e8f0',
                                  borderRadius: '16px',
                                  padding: '12px',
                                  textAlign: 'center',
                                  marginBottom: '12px'
                                }}>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>
                                    Beri Penilaian Kegiatan:
                                  </span>
                                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        key={star}
                                        type="button"
                                        onClick={() => setStoryRating(star)}
                                        onMouseEnter={() => setStoryHoverRating(star)}
                                        onMouseLeave={() => setStoryHoverRating(0)}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          cursor: 'pointer',
                                          padding: '2px',
                                          transform: (storyHoverRating || storyRating) >= star ? 'scale(1.15)' : 'scale(1)',
                                          transition: 'transform 0.15s'
                                        }}
                                      >
                                        <FiStar
                                          size={28}
                                          fill={(storyHoverRating || storyRating) >= star ? '#f59e0b' : 'transparent'}
                                          color={(storyHoverRating || storyRating) >= star ? '#f59e0b' : '#cbd5e1'}
                                        />
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Kesan */}
                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                                    Pembelajaran yang dipetik <span style={{ color: '#ef4444' }}>*</span>
                                  </label>
                                  <textarea
                                    required
                                    rows={3}
                                    value={storyKesan}
                                    onChange={(e) => setStoryKesan(e.target.value)}
                                    placeholder="Pelajaran atau nilai berharga yang Anda peroleh..."
                                    style={{
                                      width: '100%',
                                      padding: '10px 12px',
                                      borderRadius: '12px',
                                      border: '1.5px solid #e2e8f0',
                                      background: '#f8fafc',
                                      color: '#0f172a',
                                      fontSize: '13px',
                                      outline: 'none',
                                      resize: 'vertical',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>

                                {/* Pesan */}
                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                                    Pesan & Saran untuk Tim Untuk Esok <span style={{ color: '#ef4444' }}>*</span>
                                  </label>
                                  <textarea
                                    required
                                    rows={3}
                                    value={storyPesan}
                                    onChange={(e) => setStoryPesan(e.target.value)}
                                    placeholder="Saran perbaikan atau pesan semangat..."
                                    style={{
                                      width: '100%',
                                      padding: '10px 12px',
                                      borderRadius: '12px',
                                      border: '1.5px solid #e2e8f0',
                                      background: '#f8fafc',
                                      color: '#0f172a',
                                      fontSize: '13px',
                                      outline: 'none',
                                      resize: 'vertical',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>

                                {/* Checkbox */}
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#64748b', marginBottom: '18px', lineHeight: '1.5' }}>
                                  <input
                                    type="checkbox"
                                    checked={storyAllowPublic}
                                    onChange={(e) => setStoryAllowPublic(e.target.checked)}
                                    style={{ marginTop: '2px', cursor: 'pointer' }}
                                  />
                                  <span>Saya bersedia untuk mempublikasikan dokumentasi, ulasan, hal hal yang berkaitan dengan diri saya dalam kegiatan {storyApp.programTitle}</span>
                                </label>

                                {/* Submit button */}
                                <div>
                                  <button
                                    type="submit"
                                    disabled={isSubmittingStoryFeedback}
                                    style={{
                                      width: '100%',
                                      padding: '14px',
                                      borderRadius: '12px',
                                      border: 'none',
                                      background: '#16a34a',
                                      color: '#ffffff',
                                      fontSize: '14px',
                                      fontWeight: 700,
                                      cursor: isSubmittingStoryFeedback ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    {isSubmittingStoryFeedback ? 'Menyimpan...' : 'Konfirmasi'}
                                  </button>
                                </div>
                              </form>
                            </motion.div>
                          )}

                          {/* ── SLIDE 4: REWARD (TETAPLAH BERDAMPAK & 2 TOMBOL SVG BESAR) ── */}
                          {storySlide === 4 && (
                            <motion.div
                              key="slide-4"
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.25 }}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                justifyContent: 'center'
                              }}
                            >
                              <div style={{ textAlign: 'center' }}>
                                <h2 style={{
                                  fontSize: '26px',
                                  fontWeight: 900,
                                  color: '#0f172a',
                                  lineHeight: '1.3',
                                  margin: '0 0 36px 0'
                                }}>
                                  Tetaplah berdampak untuk sekitarmu!
                                </h2>

                                {/* 2 Tombol dengan SVG Besar */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', pointerEvents: 'auto' }}>
                                  {/* Tombol 1: Sertifikat Digital */}
                                  {storyApp?.noCertificate ? (
                                    <div
                                      style={{
                                        background: '#f8fafc',
                                        border: '2px dashed #cbd5e1',
                                        borderRadius: '20px',
                                        padding: '20px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        color: '#64748b'
                                      }}
                                    >
                                      <div style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '16px',
                                        background: 'rgba(148, 163, 184, 0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#64748b',
                                        flexShrink: 0
                                      }}>
                                        <FiAward size={34} />
                                      </div>
                                      <div style={{ textAlign: 'left', flex: 1 }}>
                                        <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 3px 0', color: '#334155' }}>
                                          Sertifikat Tidak Tersedia
                                        </h4>
                                        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                                          Kegiatan Batch 1-3 tidak menerbitkan e-sertifikat resmi
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <a
                                      href={storyApp.certificateUrl || `/verify/${storyApp.credentialId || storyApp.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        background: '#f8fafc',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '20px',
                                        padding: '20px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        textDecoration: 'none',
                                        color: '#0f172a',
                                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      <div style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '16px',
                                        background: 'rgba(245, 158, 11, 0.12)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#d97706',
                                        flexShrink: 0
                                      }}>
                                        <FiAward size={34} />
                                      </div>
                                      <div style={{ textAlign: 'left', flex: 1 }}>
                                        <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 3px 0', color: '#0f172a' }}>
                                          Sertifikat Digital
                                        </h4>
                                        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                                          Lihat & Verifikasi Resmi
                                        </p>
                                      </div>
                                      <div style={{ color: '#94a3b8' }}>
                                        <FiChevronRight size={20} />
                                      </div>
                                    </a>
                                  )}

                                  {/* Tombol 2: Dokumentasi Foto / Drive */}
                                  {storyApp.documentationDriveUrl ? (
                                    <a
                                      href={storyApp.documentationDriveUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        background: '#f8fafc',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '20px',
                                        padding: '20px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        textDecoration: 'none',
                                        color: '#0f172a',
                                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      <div style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '16px',
                                        background: 'rgba(2, 132, 199, 0.12)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#0284c7',
                                        flexShrink: 0
                                      }}>
                                        <FiImage size={34} />
                                      </div>
                                      <div style={{ textAlign: 'left', flex: 1 }}>
                                        <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 3px 0', color: '#0f172a' }}>
                                          Dokumentasi Foto
                                        </h4>
                                        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                                          Buka Google Drive
                                        </p>
                                      </div>
                                      <div style={{ color: '#94a3b8' }}>
                                        <FiChevronRight size={20} />
                                      </div>
                                    </a>
                                  ) : (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        background: '#f8fafc',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '20px',
                                        padding: '20px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        color: '#0f172a',
                                        opacity: 0.65
                                      }}
                                    >
                                      <div style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '16px',
                                        background: '#e2e8f0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#64748b',
                                        flexShrink: 0
                                      }}>
                                        <FiImage size={34} />
                                      </div>
                                      <div style={{ textAlign: 'left', flex: 1 }}>
                                        <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 3px 0', color: '#0f172a' }}>
                                          Dokumentasi Foto
                                        </h4>
                                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>
                                          Sedang diunggah panitia
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Logout Confirmation Modal */}
              <AnimatePresence>
                {showLogoutModal && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
                      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                      zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '20px'
                    }}
                  >
                    <motion.div 
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.95 }}
                      style={{
                        background: '#ffffff',
                        color: '#0f172a',
                        borderRadius: '24px',
                        padding: '24px',
                        maxWidth: '360px',
                        width: '100%',
                        textAlign: 'center',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                      }}
                    >
                      <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>Keluar dari akun?</h2>
                      <p style={{ fontSize: '13.5px', color: '#475569', marginBottom: '24px', lineHeight: 1.5 }}>Anda harus login kembali untuk melihat riwayat kegiatan anda.</p>
                      
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          onClick={() => setShowLogoutModal(false)}
                          style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Batal
                        </button>
                        <button 
                          onClick={handleLogout}
                          style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#ef4444', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Ya, Keluar
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cancel Registration Modal */}
              {cancelModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <motion.div 
                    initial={{ y: '100%' }} animate={{ y: 0 }}
                    style={{ width: '100%', maxWidth: '480px', background: 'var(--bg)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '32px' }}
                  >
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Batalkan Pendaftaran</h2>
                    <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '24px' }}>
                      Anda akan membatalkan partisipasi di <strong>{cancelingApp?.programTitle}</strong>. Mohon sertakan alasan agar panitia mengetahuinya.
                    </p>
                    <form onSubmit={handleCancelApplication}>
                      <textarea
                        required
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Misal: Saya ada jadwal mendadak..."
                        rows={4}
                        style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', outline: 'none', marginBottom: '24px', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          type="button"
                          disabled={isCancelingApp}
                          onClick={() => { setCancelModalOpen(false); setCancelReason(''); }}
                          style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'transparent', fontWeight: 600, cursor: isCancelingApp ? 'not-allowed' : 'pointer', opacity: isCancelingApp ? 0.6 : 1 }}
                        >
                          Batal
                        </button>
                        <button 
                          type="submit"
                          disabled={isCancelingApp}
                          style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 600, cursor: isCancelingApp ? 'not-allowed' : 'pointer', opacity: isCancelingApp ? 0.7 : 1 }}
                        >
                          {isCancelingApp ? 'Membatalkan...' : 'Kirim & Batalkan'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </>
          )}

        </motion.div>
      </div>
    </div>
  );
}
