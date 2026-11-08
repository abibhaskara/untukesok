/**
 * Helper to export volunteer application data to formatted Excel (.xls) file
 */
export function exportVolunteersToExcel(applications, programName = 'Semua_Program') {
  if (!applications || applications.length === 0) {
    alert("Tidak ada data relawan untuk diekspor.");
    return;
  }

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateStr);
    }
  };

  // Build HTML table for Excel with styling
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Data Relawan</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      <style>
        table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; width: 100%; }
        th { background-color: #047857; color: #ffffff; font-weight: bold; border: 1px solid #065f46; padding: 10px; text-align: left; }
        td { border: 1px solid #d1d5db; padding: 8px 10px; vertical-align: middle; }
        .text-center { text-align: center; }
        .badge-selesai { background-color: #d1fae5; color: #065f46; font-weight: bold; }
        .badge-batal { background-color: #fee2e2; color: #991b1b; font-weight: bold; }
        .badge-terdaftar { background-color: #eff6ff; color: #1e40af; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2 style="color: #047857; margin-bottom: 4px;">Data Relawan Untuk Esok</h2>
      <p style="margin-top: 0; color: #4b5563;">
        <strong>Program:</strong> ${programName} &nbsp;|&nbsp; 
        <strong>Total Relawan:</strong> ${applications.length} &nbsp;|&nbsp; 
        <strong>Waktu Unduh:</strong> ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
      <br/>
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">No.</th>
            <th>Nama Lengkap</th>
            <th>Email</th>
            <th>No. WhatsApp / HP</th>
            <th>Program Relawan</th>
            <th>Tanggal Program</th>
            <th>Status Relawan</th>
            <th>Tipe Pembayaran</th>
            <th>Nominal Bayar</th>
            <th>Kode Promo</th>
            <th>Order ID</th>
            <th>Waktu Pendaftaran</th>
            <th>Nomor Sertifikat</th>
            <th>ID Kredensial</th>
            <th>Rating (1-5)</th>
            <th>Kesan Relawan</th>
            <th>Pesan & Saran</th>
            <th>Link Bukti Transfer</th>
            <th>Link Bukti Upload Story</th>
            <th>Keterangan / Alasan Batal</th>
          </tr>
        </thead>
        <tbody>
  `;

  applications.forEach((app, index) => {
    const isPaidProg = Boolean(app.isPaid || (app.amount && Number(app.amount) > 0));
    const amountStr = (app.amount !== undefined && app.amount !== null && !isNaN(Number(app.amount)))
      ? (Number(app.amount) > 0 ? `Rp ${Number(app.amount).toLocaleString('id-ID')}` : 'Gratis')
      : (isPaidProg ? 'Belum Bayar' : 'Gratis');
    
    let statusClass = 'badge-terdaftar';
    if (app.status === 'Selesai') statusClass = 'badge-selesai';
    else if (app.status === 'Dibatalkan' || app.status === 'Dikeluarkan') statusClass = 'badge-batal';

    const certNumDisplay = app.noCertificate ? 'Tanpa Sertifikat' : (app.certificateNumber || '-');
    const credIdDisplay = app.noCertificate ? '-' : (app.credentialId || '-');

    html += `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td><strong>${app.userName || 'Relawan'}</strong></td>
        <td>${app.userEmail || '-'}</td>
        <td style="mso-number-format:'\\@';">${app.userPhone || '-'}</td>
        <td>${app.programTitle || '-'}</td>
        <td>${app.programDate || '-'}</td>
        <td class="${statusClass}">${app.status || 'Terdaftar'}</td>
        <td>${isPaidProg ? 'Berbayar' : 'Gratis'}</td>
        <td>${amountStr}</td>
        <td>${app.promoCode || '-'}</td>
        <td style="mso-number-format:'\\@';">${app.orderId || '-'}</td>
        <td>${formatDate(app.appliedAt)}</td>
        <td style="mso-number-format:'\\@';">${certNumDisplay}</td>
        <td style="mso-number-format:'\\@';">${credIdDisplay}</td>
        <td class="text-center">${app.rating ? `${app.rating} / 5` : '-'}</td>
        <td>${app.kesan || '-'}</td>
        <td>${app.pesan || '-'}</td>
        <td>${app.paymentProofUrl ? `<a href="${app.paymentProofUrl}">Buka Bukti Transfer</a>` : '-'}</td>
        <td>${app.storyProofUrl ? `<a href="${app.storyProofUrl}">Buka Bukti Upload</a>` : '-'}</td>
        <td>${app.cancelReason || '-'}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const safeTitle = programName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Data_Relawan_${safeTitle}_${dateStr}.xls`;

  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
