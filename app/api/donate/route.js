import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const { name, email, amount } = await request.json();

    const donationAmount = Number(amount);
    if (!name || !email || isNaN(donationAmount) || donationAmount < 10000 || donationAmount > 100000000) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Nama, email, dan nominal donasi yang valid (minimal Rp 10.000) diperlukan.' },
        { status: 400 }
      );
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      clearTimeout(timeoutId);
      console.error('MIDTRANS_SERVER_KEY belum dikonfigurasi di server.');
      return NextResponse.json(
        { error: 'Layanan donasi sedang dalam perbaikan sistem. Silakan coba lagi nanti.' },
        { status: 500 }
      );
    }

    const authHeader = `Basic ${Buffer.from(serverKey + ':').toString('base64')}`;

    const midtransPayload = {
      transaction_details: {
        order_id: `DONATE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        gross_amount: donationAmount,
      },
      customer_details: {
        first_name: String(name).replace(/<[^>]*>?/gm, '').trim().substring(0, 50),
        email: String(email).trim(),
      },
      credit_card: {
        secure: true,
      },
    };

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
        { error: data.error_messages ? data.error_messages.join(', ') : 'Gagal memproses sesi donasi Midtrans' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      token: data.token,
      redirect_url: data.redirect_url,
    });
  } catch (error) {
    console.error('Donation API route error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
