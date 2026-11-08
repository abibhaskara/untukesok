import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../src/lib/firebase';
import { PROMO_CODES, calculatePaymentFee } from '../../../../src/lib/paymentUtils';

export const runtime = 'edge';

export async function POST(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const { programId, programTitle, price, userEmail, userName, userPhone, paymentMethod, promoCode } = await request.json();

    if (!programId || !userEmail || !userName) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Data pendaftaran dan pembayaran tidak lengkap.' },
        { status: 400 }
      );
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      clearTimeout(timeoutId);
      console.error('MIDTRANS_SERVER_KEY belum dikonfigurasi di server environment.');
      return NextResponse.json(
        { error: 'Layanan pembayaran sedang dalam konfigurasi sistem. Silakan hubungi admin.' },
        { status: 500 }
      );
    }

    // ── SEC-01 FIX: Server-Side Price & Quota Validation ──
    let verifiedPrice = Number(price) || 0;
    let verifiedTitle = programTitle ? String(programTitle).trim() : 'Commitment Fee Kegiatan';

    try {
      const progDocRef = doc(db, 'programs', programId);
      const progSnap = await getDoc(progDocRef);

      if (progSnap.exists()) {
        const progData = progSnap.data();

        // Check Quota
        const joined = Number(progData.volunteersJoined || 0);
        const target = Number(progData.volunteersTarget || 0);
        if (target > 0 && joined >= target) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Maaf, kuota untuk kegiatan ini sudah penuh. Pendaftaran telah ditutup.' },
            { status: 400 }
          );
        }

        // Validate Price from Database to prevent Client-Side Price Tampering
        if (progData.isPaid && Number(progData.price) > 0) {
          verifiedPrice = Number(progData.price);
        } else if (!progData.isPaid) {
          verifiedPrice = 0;
        }

        if (progData.title) {
          verifiedTitle = progData.title;
        }
      }
    } catch (dbErr) {
      console.warn('Pengecekan Firestore database di server dilewati:', dbErr);
    }

    let discountAmount = 0;
    if (promoCode && typeof promoCode === 'string') {
      const cleanCode = promoCode.trim().toUpperCase();
      if (PROMO_CODES[cleanCode]) {
        discountAmount = Math.min(PROMO_CODES[cleanCode].discount, verifiedPrice);
        verifiedPrice = Math.max(0, verifiedPrice - discountAmount);
      }
    }

    if (verifiedPrice <= 0) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Kegiatan ini gratis atau nominal commitment fee tidak valid.' },
        { status: 400 }
      );
    }

    const authHeader = `Basic ${Buffer.from(serverKey + ':').toString('base64')}`;
    const orderId = `PROG-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const adminFee = calculatePaymentFee(paymentMethod, verifiedPrice);
    const totalGrossAmount = verifiedPrice + adminFee;

    const items = [
      {
        id: programId,
        price: verifiedPrice,
        quantity: 1,
        name: verifiedTitle.substring(0, 45),
      }
    ];

    if (adminFee > 0) {
      items.push({
        id: 'admin-fee',
        price: adminFee,
        quantity: 1,
        name: 'Biaya Layanan',
      });
    }

    const midtransPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: totalGrossAmount,
      },
      item_details: items,
      customer_details: {
        first_name: String(userName).substring(0, 50),
        email: String(userEmail).trim(),
        phone: userPhone ? String(userPhone).trim() : '',
      },
      credit_card: {
        secure: true,
      },
    };

    if (paymentMethod && paymentMethod !== 'all') {
      const paymentChannelMap = {
        'qris': ['other_qris', 'gopay', 'shopeepay'],
        'bca_va': ['bca_va'],
        'echannel': ['echannel'],
        'bni_va': ['bni_va'],
        'bri_va': ['bri_va'],
        'gopay': ['gopay'],
        'shopeepay': ['shopeepay'],
        'credit_card': ['credit_card']
      };
      if (paymentChannelMap[paymentMethod]) {
        midtransPayload.enabled_payments = paymentChannelMap[paymentMethod];
      }
    }

    const isProduction = process.env.NODE_ENV === 'production' && !serverKey.startsWith('SB-');
    const midtransSnapUrl = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    const response = await fetch(midtransSnapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(midtransPayload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      console.error('Midtrans API error:', data);
      return NextResponse.json(
        { error: data.error_messages ? data.error_messages.join(', ') : 'Gagal membuat sesi pembayaran Midtrans' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      token: data.token,
      redirect_url: data.redirect_url,
      orderId: orderId,
      adminFee: adminFee,
      totalAmount: totalGrossAmount
    });
  } catch (error) {
    console.error('Program payment error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem saat memproses pembayaran' },
      { status: 500 }
    );
  }
}
