/**
 * Shared Payment & Promo Code Utilities (Frontend + Backend Single Source of Truth)
 */

export const PROMO_CODES = {
  UNTUKESOK2026: {
    code: 'UNTUKESOK2026',
    discount: 25000,
    title: 'Diskon Spesial Untuk Esok'
  },
  RELASIESOK: {
    code: 'RELASIESOK',
    discount: 10000,
    title: 'Diskon Relasi Esok'
  },
  VOLUNTEER2026: {
    code: 'VOLUNTEER2026',
    discount: 15000,
    title: 'Diskon Komunitas Relawan'
  }
};

/**
 * Calculates exact payment gateway service fee (cost-passing to participant)
 * @param {string} method - Payment method identifier
 * @param {number} price - Net price after discount
 * @returns {number} Service fee in IDR
 */
export function calculatePaymentFee(method, price) {
  const numPrice = Number(price) || 0;
  if (numPrice <= 0) return 0;

  switch (method) {
    case 'qris':
      // QRIS: 0.7% (inclusive of tax)
      return Math.round(numPrice * 0.007);
    case 'bca_va':
    case 'echannel':
    case 'bni_va':
    case 'bri_va':
    case 'bank_transfer':
    case 'cstore':
    case 'indomaret':
    case 'alfamart':
      // Bank VA / Retail: Rp 4.000 + PPN 11% (Rp 440) = Rp 4.440
      return 4000 + Math.round(4000 * 0.11);
    case 'credit_card': {
      // Credit Card: 2.9% + Rp 2.000 (+ PPN 11% of transaction fee)
      const baseCardFee = numPrice * 0.029 + 2000;
      return Math.round(baseCardFee * 1.11);
    }
    case 'all':
    default:
      return Math.round(numPrice * 0.007);
  }
}

/**
 * Extracts normalized nominal payment amount from an application document
 * @param {object} app - Application record
 * @returns {number} Nominal in IDR
 */
export function getAppAmount(app) {
  if (!app) return 0;
  if (app.amount !== undefined && app.amount !== null && !isNaN(Number(app.amount))) {
    return Number(app.amount);
  }
  if (app.ticketPrice !== undefined && app.ticketPrice !== null && !isNaN(Number(app.ticketPrice))) {
    return Number(app.ticketPrice);
  }
  return app.isPaid ? 25000 : 0;
}


