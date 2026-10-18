import React, { useEffect, useState } from 'react';
import { Payment, Room } from '../types/index.ts';
import { formatVND, formatDateVN, generateQrDataUrl } from '../utils/formatters.ts';
import { CheckCircle2, Copy, Download, Printer, X, ShieldAlert } from 'lucide-react';

interface ReceiptModalProps {
  payment: Payment | null;
  room?: Room | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ payment, room, onClose }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (payment) {
      const qrPayload = `TROXANH:${payment.paymentCode}:${payment.amount}:${payment.payerName}`;
      generateQrDataUrl(qrPayload).then((url) => setQrCodeUrl(url));
    }
  }, [payment]);

  if (!payment) return null;

  const handleCopy = () => {
    const text = `PHIẾU THU TIỀN TRỌ\nMã phiếu: ${payment.paymentCode}\nPhòng: ${room ? room.name : payment.roomId}\nNgười nộp: ${payment.payerName}\nSố tiền: ${formatVND(payment.amount)}\nNgày nhận: ${formatDateVN(payment.receivedAt, true)}\nHình thức: ${payment.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}\nNgười lập: ${payment.receivedBy}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-slate-100">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-800 to-teal-700 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-300" />
            <div>
              <h3 className="font-bold text-lg leading-tight">Phiếu Thu Tiền Trọ</h3>
              <p className="text-xs text-emerald-200">Ghi nhận giao dịch thành công</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div id="receipt-printable" className="p-5 space-y-4 text-sm bg-slate-900">
          <div className="text-center pb-2 border-b border-slate-800">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              {payment.paymentCode}
            </span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {formatVND(payment.amount)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatDateVN(payment.receivedAt, true)}
            </p>
          </div>

          {/* Details Table */}
          <div className="space-y-2.5 bg-slate-850 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Phòng:</span>
              <span className="font-semibold text-white">{room ? room.name : payment.roomId || 'Chờ đối soát'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Người nộp tiền:</span>
              <span className="font-semibold text-white">{payment.payerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hình thức thanh toán:</span>
              <span className="font-medium text-emerald-300">
                {payment.method === 'transfer' ? 'Chuyển khoản ngân hàng' : 'Tiền mặt'}
              </span>
            </div>
            {payment.bankTransactionRef && (
              <div className="flex justify-between">
                <span className="text-slate-400">Mã giao dịch NH:</span>
                <span className="font-mono text-xs text-slate-300">{payment.bankTransactionRef}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Người ghi nhận:</span>
              <span className="text-slate-300">{payment.receivedBy}</span>
            </div>
            {payment.notes && (
              <div className="flex justify-between">
                <span className="text-slate-400">Ghi chú:</span>
                <span className="text-slate-300 italic">{payment.notes}</span>
              </div>
            )}
          </div>

          {/* Allocations breakdown */}
          {payment.allocations && payment.allocations.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-400">Phân bổ tiền thanh toán:</div>
              <div className="bg-slate-850 rounded-lg p-2.5 border border-slate-800 space-y-1 text-xs">
                {payment.allocations.map((alloc, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-slate-300">Hóa đơn kỳ {alloc.period}:</span>
                    <span className="font-semibold text-emerald-400">{formatVND(alloc.amount)}</span>
                  </div>
                ))}
                {payment.unallocatedAmount > 0 && (
                  <div className="flex justify-between text-amber-400 border-t border-slate-750 pt-1">
                    <span>Số tiền dư (chuyển trả trước):</span>
                    <span className="font-semibold">{formatVND(payment.unallocatedAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QR & Verification */}
          <div className="flex items-center justify-between p-3 bg-slate-850 rounded-xl border border-slate-800">
            <div className="pr-3">
              <p className="text-xs font-medium text-slate-300">Mã tra cứu phiếu thu</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Quét mã để xác minh thông tin đối soát thu tiền thực tế
              </p>
            </div>
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Phiếu thu" className="w-16 h-16 rounded-md bg-white p-1" />
            ) : null}
          </div>

          {/* Legal disclaimer notice */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-[11px] leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              <strong>Lưu ý:</strong> Đây là biên nhận thu tiền nội bộ của khu trọ, không phải hóa đơn điện tử giá trị gia tăng theo quy định thuế.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-750 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Đã sao chép!' : 'Sao chép'}
          </button>
          <button
            onClick={handlePrint}
            className="py-2.5 px-4 rounded-xl bg-slate-750 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            In
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center transition-colors shadow-sm"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
};
