import QRCode from 'qrcode';

export function formatVND(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 đ';
  return `${Math.round(amount).toLocaleString('vi-VN')} đ`;
}

export function formatDateVN(dateStr: string | undefined | null, includeTime = false): string {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    if (!includeTime) {
      return `${day}/${month}/${year}`;
    }
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR:', err);
    return '';
  }
}

export function buildVietQRString(params: {
  bankId: string;
  accountNumber: string;
  amount?: number;
  memo?: string;
}): string {
  // Return standard VietQR quick link URL or payload
  const baseUrl = `https://img.vietqr.io/image/${params.bankId}-${params.accountNumber}-compact.png`;
  const searchParams = new URLSearchParams();
  if (params.amount && params.amount > 0) {
    searchParams.set('amount', Math.round(params.amount).toString());
  }
  if (params.memo) {
    searchParams.set('addInfo', params.memo);
  }
  const query = searchParams.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

export function exportCsvFile(filename: string, headers: string[], rows: (string | number)[][]) {
  // UTF-8 BOM \uFEFF ensures Vietnamese characters render properly in Microsoft Excel
  const bom = '\uFEFF';
  const csvContent =
    bom +
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',') +
    '\n' +
    rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface ZaloMessageParams {
  houseName: string;
  roomCode: string;
  roomName: string;
  payerName: string;
  periodMonth: string;
  electricStart: number; // Chỉ số điện tháng đã qua
  electricEnd: number;   // Chỉ số điện tháng hiện tại
  electricRate: number;  // e.g. 5000 đ
  waterStart: number;    // Chỉ số nước tháng đã qua
  waterEnd: number;      // Chỉ số nước tháng hiện tại
  waterRate: number;     // e.g. 4000 đ
  baseRent: number;      // Tiền phòng gốc (điều chỉnh được)
  otherFees?: number;    // Rác + Wifi
  previousDebt?: number;
  appliedAdvance?: number;
  totalDue: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferMemo: string;
  dueDate: string;
}

export function buildZaloMessage(p: ZaloMessageParams): string {
  const electricUsage = p.electricEnd >= p.electricStart ? p.electricEnd - p.electricStart : p.electricEnd;
  const electricTotal = electricUsage * p.electricRate;

  const waterUsage = p.waterEnd >= p.waterStart ? p.waterEnd - p.waterStart : p.waterEnd;
  const waterTotal = waterUsage * p.waterRate;

  const monthStr = p.periodMonth.slice(5);

  return `[HÓA ĐƠN TIỀN NHÀ] BẢNG TÍNH TIỀN THÁNG ${monthStr}
Phòng: ${p.roomCode} - ${p.payerName}
----------------------------------------
⚡ TIỀN ĐIỆN (Đơn giá: ${formatVND(p.electricRate)}/kWh):
• Chỉ số điện tháng đã qua (số cũ): ${p.electricStart} kWh
• Chỉ số điện tháng hiện tại (số mới): ${p.electricEnd} kWh
=> Điện sử dụng: ${electricUsage} kWh x ${formatVND(p.electricRate)} = ${formatVND(electricTotal)}

💧 TIỀN NƯỚC (Đơn giá: ${formatVND(p.waterRate)}/m3):
• Chỉ số nước tháng đã qua (số cũ): ${p.waterStart} m3
• Chỉ số nước tháng hiện tại (số mới): ${p.waterEnd} m3
=> Nước sử dụng: ${waterUsage} m3 x ${formatVND(p.waterRate)} = ${formatVND(waterTotal)}

🏠 TIỀN PHÒNG GỐC: ${formatVND(p.baseRent)}${p.otherFees && p.otherFees > 0 ? `\n🧹 PHÍ DỊCH VỤ (Wifi + Rác): ${formatVND(p.otherFees)}` : ''}${p.previousDebt && p.previousDebt > 0 ? `\n⚠️ NỢ CŨ MANG SANG: ${formatVND(p.previousDebt)}` : ''}${p.appliedAdvance && p.appliedAdvance > 0 ? `\n💳 TRẢ TRƯỚC BÙ TRỪ: -${formatVND(p.appliedAdvance)}` : ''}

=> TỔNG CỘNG THÀNH TIỀN: ${formatVND(p.totalDue)}
(Công thức: Tiền điện [${electricUsage}x${p.electricRate}] + Tiền nước [${waterUsage}x${p.waterRate}] + Tiền phòng)
----------------------------------------
🏦 THÔNG TIN CHUYỂN KHOẢN:
• Ngân hàng: ${p.bankName}
• Số tài khoản: ${p.accountNumber}
• Chủ tài khoản: ${p.accountHolder.toUpperCase()}
• Nội dung chuyển: ${p.transferMemo}

Hạn thanh toán: ngày 10/${monthStr}. Trân trọng cảm ơn!`;
}
