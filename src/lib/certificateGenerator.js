/**
 * Untuk Esok — Auto Certificate Generator Engine
 * Renders official certificates onto the clean raw template (public/certificate-template-official.jpg).
 *
 * Typography: Cinzel (official Canva font for Untuk Esok certificate)
 * Elements automated:
 * 1. CERT. NO.: 000/VOL/UE/VIII/2026 (Font: Cinzel)
 * 2. VOLUNTEER NAME (Font: Cinzel Bold with auto font-scaling)
 * 3. Paragraph: "for serving with passion and excellence as a volunteer during [Program] held on [Date]..." (Font: Cinzel with balanced line wrapping)
 * 4. Left Signer: Project Leader Untuk Esok (Font: Cinzel)
 * 5. Center: Dynamic Official Verification QR Code (untukesok.id/verify/[credentialId])
 * 6. Right Signer: Yayasan Mitra Kerja Sama (Font: Cinzel)
 */

const TEMPLATE_WIDTH = 1024;
const TEMPLATE_HEIGHT = 723;
const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function formatCertNumber(order, dateStr) {
  const orderStr = String(order).padStart(3, '0');
  const d = dateStr ? new Date(dateStr) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  return `${orderStr}/VOL/UE/${ROMAN_MONTHS[validDate.getMonth()]}/${validDate.getFullYear()}`;
}

export function getMaxCertOrder(applications = [], onlyFinished = false) {
  const nums = applications
    .filter(a => (!onlyFinished || (a.status === 'Selesai' && !a.noCertificate)) && a.certificateNumber)
    .map(a => {
      const m = String(a.certificateNumber).match(/^(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(n => !isNaN(n) && n > 0);
  return nums.length > 0 ? Math.max(...nums) : 0;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function formatEnglishDate(dateInput) {
  if (!dateInput) return '9 August 2026';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return String(dateInput);
  }
}

async function ensureCinzelFontLoaded() {
  if (typeof document === 'undefined') return;
  try {
    if (!document.getElementById('font-cinzel-google')) {
      const link = document.createElement('link');
      link.id = 'font-cinzel-google';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
    if (document.fonts) {
      await Promise.all([
        document.fonts.load('600 12.5px Cinzel'),
        document.fonts.load('700 32px Cinzel'),
        document.fonts.load('500 12.5px Cinzel'),
        document.fonts.ready
      ]);
    }
  } catch (err) {
    console.warn('Cinzel font load warning:', err);
  }
}

/**
 * Main renderer: Draws on top of the clean raw certificate template image.
 */
export async function renderCertificateCanvas(certData = {}, options = {}) {
  await ensureCinzelFontLoaded();

  const canvas = document.createElement('canvas');
  canvas.width = TEMPLATE_WIDTH;
  canvas.height = TEMPLATE_HEIGHT;
  const ctx = canvas.getContext('2d');

  const origin = options.origin || (typeof window !== 'undefined' ? window.location.origin : 'https://untukesok.id');
  const credentialId = certData.credentialId || `CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const verifyUrl = `${origin}/verify/${credentialId}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=0&data=${encodeURIComponent(verifyUrl)}`;

  const templateUrl = options.templateUrl || certData.certificateTemplateUrl || '/certificate-template-official.jpg';

  const [bgImg, qrImg, sigLeftImg, sigRightImg] = await Promise.all([
    loadImage(templateUrl),
    loadImage(qrApiUrl),
    loadImage(certData.signer1SignatureUrl || null),
    loadImage(certData.signer2SignatureUrl || null)
  ]);

  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
  } else {
    // Fallback solid background if image cannot be loaded
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, TEMPLATE_WIDTH - 40, TEMPLATE_HEIGHT - 40);
  }

  // Text rendering settings
  ctx.textAlign = 'center';

  // ─────────────────────────────────────────────────────────────
  // 1. CERT. NO.: 000/VOL/UE/VIII/2026
  // Centered under "OF APPRECIATION"
  // ─────────────────────────────────────────────────────────────
  const certNo = certData.certificateNumber || '001/VOL/UE/XI/2026';
  ctx.fillStyle = '#222222';
  ctx.font = '600 12.5px "Cinzel", Georgia, serif';
  ctx.letterSpacing = '1.8px';
  ctx.fillText(`CERT. NO.: ${certNo}`, 511, 219);

  // ─────────────────────────────────────────────────────────────
  // 2. NAMA VOLUNTEER
  // Centered above the gold underline (gold line is at Y = 420)
  // ─────────────────────────────────────────────────────────────
  const volunteerName = (certData.userName || certData.name || 'NAMA VOLUNTEER').toUpperCase();
  ctx.fillStyle = '#111827';
  let nameSize = 32;
  ctx.font = `700 ${nameSize}px "Cinzel", Georgia, serif`;
  ctx.letterSpacing = '1.5px';
  let nameWidth = ctx.measureText(volunteerName).width;
  while (nameWidth > 580 && nameSize > 18) {
    nameSize -= 2;
    ctx.font = `700 ${nameSize}px "Cinzel", Georgia, serif`;
    nameWidth = ctx.measureText(volunteerName).width;
  }
  ctx.fillText(volunteerName, 511, 396);

  // ─────────────────────────────────────────────────────────────
  // 3. Paragraph: "for serving with passion and excellence..."
  // Clean, balanced typography with Cinzel font
  // ─────────────────────────────────────────────────────────────
  const programName = certData.programTitle || 'Untuk Esok Batch 3';
  const eventDate = formatEnglishDate(certData.programDate || certData.appliedAt);
  const fullText = `for serving with passion and excellence as a volunteer during ${programName} held on ${eventDate}. Your tireless efforts, positive energy, and spirit of teamwork greatly contributed to the resounding success of this initiative.`;

  ctx.fillStyle = '#262626';
  ctx.font = '500 12.5px "Cinzel", Georgia, serif';
  ctx.letterSpacing = '0.5px';

  // Dynamic balanced word wrapping within 640px
  const words = fullText.split(' ');
  const lines = [];
  let currentLine = words[0] || '';
  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + ' ' + words[i];
    if (ctx.measureText(testLine).width <= 640) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  if (currentLine) lines.push(currentLine);

  const startY = 460;
  const lineHeight = 22;
  lines.forEach((line, idx) => {
    ctx.fillText(line, 511, startY + (idx * lineHeight));
  });

  // ─────────────────────────────────────────────────────────────
  // 4. PENANDATANGAN KIRI (Project Leader Untuk Esok)
  // Centered at Left Signature Line (X = 310, Line Y = 606)
  // ─────────────────────────────────────────────────────────────
  const signerLeftName = certData.signer1Name || 'Abi Bhaskara';
  const signerLeftRole = certData.signer1Role || 'Project Leader Untuk Esok';
  const leftX = 310;

  if (sigLeftImg) {
    ctx.drawImage(sigLeftImg, leftX - 45, 555, 90, 44);
  }

  ctx.fillStyle = '#111827';
  ctx.font = '700 12.5px "Cinzel", Poppins, sans-serif';
  ctx.letterSpacing = '0.8px';
  ctx.fillText(signerLeftName, leftX, 624);

  ctx.fillStyle = '#475569';
  ctx.font = '500 10px "Cinzel", Poppins, sans-serif';
  ctx.letterSpacing = '0.4px';
  ctx.fillText(signerLeftRole, leftX, 638);

  // ─────────────────────────────────────────────────────────────
  // 5. QR CODE VERIFIKASI RESMI (Tengah)
  // Sits cleanly above "untukesok.id" (untukesok.id is at Y = 634)
  // ─────────────────────────────────────────────────────────────
  const qrX = 511;
  const qrSize = 52;
  const qrY = 572;

  if (qrImg) {
    ctx.drawImage(qrImg, qrX - qrSize / 2, qrY, qrSize, qrSize);
  } else {
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(qrX - qrSize / 2, qrY, qrSize, qrSize);
  }

  // ─────────────────────────────────────────────────────────────
  // 6. PENANDATANGAN KANAN (Mitra / Partner Kerja Sama)
  // Centered at Right Signature Line (X = 712, Line Y = 606)
  // ─────────────────────────────────────────────────────────────
  const signerRightName = certData.signer2Name || 'Wayan Sudarma';
  const signerRightRole = certData.signer2Role || 'Manager Yayasan / Pihak Mitra';
  const rightX = 712;

  if (sigRightImg) {
    ctx.drawImage(sigRightImg, rightX - 45, 555, 90, 44);
  }

  ctx.fillStyle = '#111827';
  ctx.font = '700 12.5px "Cinzel", Poppins, sans-serif';
  ctx.letterSpacing = '0.8px';
  ctx.fillText(signerRightName, rightX, 624);

  ctx.fillStyle = '#475569';
  ctx.font = '500 10px "Cinzel", Poppins, sans-serif';
  ctx.letterSpacing = '0.4px';
  ctx.fillText(signerRightRole, rightX, 638);

  return canvas;
}

/**
 * Generates Base64 Data URL for instant live preview in React components.
 */
export async function generateCertificatePreviewUrl(certData, options = {}) {
  try {
    const canvas = await renderCertificateCanvas(certData, options);
    return canvas.toDataURL('image/jpeg', 0.94);
  } catch (err) {
    console.error('Error generating certificate preview:', err);
    return null;
  }
}

/**
 * Downloads high-res PNG directly to user's device.
 */
export async function downloadCertificatePng(certData, options = {}) {
  try {
    const canvas = await renderCertificateCanvas(certData, options);
    const cleanName = (certData.userName || certData.name || 'Relawan')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40);
    const filename = `Sertifikat_${cleanName}.png`;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error downloading certificate:', err);
    alert('Gagal mengunduh sertifikat: ' + err.message);
  }
}
