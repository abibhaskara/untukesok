import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../../src/lib/firebase';

export const runtime = 'edge';

async function generateSHA512(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request) {
  try {
    const notification = await request.json();
    const { 
      order_id, 
      status_code, 
      gross_amount, 
      signature_key, 
      transaction_status, 
      fraud_status, 
      payment_type 
    } = notification;

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      console.error('MIDTRANS_SERVER_KEY belum dikonfigurasi di server environment.');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // ── SEC-03 FIX: SHA-512 Signature Hash Verification ──
    if (!signature_key || !order_id || !status_code || !gross_amount) {
      return NextResponse.json(
        { error: 'Missing required webhook signature fields' },
        { status: 400 }
      );
    }

    const rawSignature = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const expectedSignature = await generateSHA512(rawSignature);

    if (signature_key !== expectedSignature) {
      console.warn('Peringatan: Upaya spoofing signature webhook Midtrans terdeteksi pada order:', order_id);
      return NextResponse.json(
        { error: 'Invalid signature key' },
        { status: 403 }
      );
    }

    // Determine Transaction Status
    const isSuccess =
      (transaction_status === 'capture' && (fraud_status === 'accept' || !fraud_status)) ||
      transaction_status === 'settlement';

    const isCanceledOrExpired = ['cancel', 'deny', 'expire'].includes(transaction_status);

    // Synchronize transaction state to Firestore applications collection
    try {
      const q = query(collection(db, 'applications'), where('orderId', '==', order_id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await Promise.all(
          snap.docs.map((appDoc) =>
            updateDoc(doc(db, 'applications', appDoc.id), {
              paymentStatus: isSuccess ? 'PAID' : isCanceledOrExpired ? 'EXPIRED' : 'PENDING',
              isPaid: isSuccess,
              paidAt: isSuccess ? new Date().toISOString() : '',
              webhookVerified: true,
              webhookPaymentType: payment_type || ''
            })
          )
        );
      }
    } catch (dbSyncErr) {
      console.warn('Gagal menyinkronkan status webhook ke Firestore:', dbSyncErr);
    }

    return NextResponse.json({
      status: 'OK',
      orderId: order_id,
      transactionStatus: transaction_status,
      isSuccess,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
