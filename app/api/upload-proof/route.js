import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Compute SHA-1 hex hash using standard Web Crypto API (Edge compatible)
async function sha1Hex(str) {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Parse Cloudinary credentials from environment variables only (No hardcoded secrets)
function getCloudinaryConfig() {
  const envUrl = process.env.CLOUDINARY_URL || '';
  let apiKey = process.env.CLOUDINARY_API_KEY || '';
  let apiSecret = process.env.CLOUDINARY_API_SECRET || '';
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';

  if (envUrl.startsWith('cloudinary://')) {
    try {
      const withoutScheme = envUrl.replace('cloudinary://', '');
      const [credentials, host] = withoutScheme.split('@');
      if (credentials && host) {
        const [key, secret] = credentials.split(':');
        if (key && key !== '<your_api_key>') apiKey = key;
        if (secret && secret !== '<your_api_secret>') apiSecret = secret;
        if (host) cloudName = host.split('/')[0];
      }
    } catch (err) {
      console.warn('Error parsing CLOUDINARY_URL:', err);
    }
  }

  return { apiKey, apiSecret, cloudName };
}

export async function POST(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const { imageBase64, userName, appliedAt, type = 'bukti_transfer' } = await request.json();

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Berkas gambar tidak ditemukan atau format tidak valid.' },
        { status: 400 }
      );
    }

    const { apiKey, apiSecret, cloudName } = getCloudinaryConfig();

    // Format file name / public_id: [folder]/[nama_akun]_[waktu]
    const sanitizedName = (userName || 'relawan')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 40);

    const dateObj = appliedAt ? new Date(appliedAt) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeFormatted = `${dateObj.getFullYear()}${pad(dateObj.getMonth() + 1)}${pad(dateObj.getDate())}_${pad(dateObj.getHours())}${pad(dateObj.getMinutes())}${pad(dateObj.getSeconds())}`;

    const validFolder = ['bukti_transfer', 'bukti_story', 'bukti_follow'].includes(type) ? type : 'bukti_transfer';
    const publicId = `${validFolder}/${sanitizedName}_${timeFormatted}`;
    const timestamp = Math.floor(Date.now() / 1000);

    if (!cloudName) {
      clearTimeout(timeoutId);
      return NextResponse.json({
        success: true,
        secure_url: imageBase64,
        public_id: publicId,
        note: 'Fallback to direct storage (Cloudinary cloudName not configured)'
      });
    }

    // Prepare FormData payload for Cloudinary REST API
    const formData = new FormData();
    formData.append('file', imageBase64);
    formData.append('public_id', publicId);
    formData.append('timestamp', String(timestamp));

    // If API key and secret are configured, sign the request
    if (apiKey && apiSecret && apiKey !== '<your_api_key>' && apiSecret !== '<your_api_secret>') {
      const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const signature = await sha1Hex(stringToSign);
      formData.append('api_key', apiKey);
      formData.append('signature', signature);
    } else {
      // Fallback to unsigned preset if secret is not set yet
      formData.append('upload_preset', 'ml_default');
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      console.warn('Cloudinary upload warning:', data);
      
      // If upload failed due to unsigned preset or missing API keys, return the original base64
      // so user flow is never blocked and payment proof is still preserved in database!
      return NextResponse.json({
        success: true,
        secure_url: imageBase64,
        public_id: publicId,
        note: 'Fallback to direct storage'
      });
    }

    return NextResponse.json({
      success: true,
      secure_url: data.secure_url,
      public_id: data.public_id,
    });
  } catch (error) {
    console.error('Upload proof error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengunggah berkas.' },
      { status: 500 }
    );
  }
}
