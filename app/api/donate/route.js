import { NextResponse } from 'next/server';
export const runtime = 'edge';
export async function POST(request) {
  try {
    const { name, email, amount } = await request.json();

    if (!name || !email || !amount) {
      return NextResponse.json(
        { error: 'Name, email, and amount are required' },
        { status: 400 }
      );
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-yUtR8Gq315pMh0qW2r0E1yTq';
    // Base64 encode Server Key
    const authHeader = `Basic ${Buffer.from(serverKey + ':').toString('base64')}`;

    const midtransPayload = {
      transaction_details: {
        order_id: `DONATE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        gross_amount: Number(amount),
      },
      customer_details: {
        first_name: name,
        email: email,
      },
      credit_card: {
        secure: true,
      },
    };

    const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(midtransPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Midtrans API error:', data);
      return NextResponse.json(
        { error: data.error_messages ? data.error_messages.join(', ') : 'Midtrans payment creation failed' },
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
