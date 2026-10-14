import React, { useState, useEffect } from 'react';
import { Room, Invoice, Payment, HouseProfile, MaintenanceTicket } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVND, formatDateVN, generateQrDataUrl, buildVietQRString } from '../utils/formatters.ts';
import {
  QrCode,
  Copy,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Clock,
  Send,
  Download,
  Info,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface TenantPortalViewProps {
  room: Room;
  profile: HouseProfile;
  invoices: Invoice[];
  payments: Payment[];
  onOpenMaintenanceModal: () => void;
}

export const TenantPortalView: React.FC<TenantPortalViewProps> = ({
  room,
  profile,
  invoices,
  payments,
  onOpenMaintenanceModal,
}) => {
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [proofTxnCode, setProofTxnCode] = useState<string>('');
  const [proofSubmitted, setProofSubmitted] = useState<boolean>(false);
  const [proofLoading, setProofLoading] = useState<boolean>(false);

  useEffect(() => {
    // Find latest active invoice (unpaid or partial, else latest)
    const pending = invoices.find((i) => i.remainingBalance > 0);
    const target = pending || invoices[0] || null;
    setActiveInvoice(target);

    if (target && target.remainingBalance > 0) {
      const memo = `${room.code} TIEN NHA T${target.periodMonth.slice(5)}`;
      const vietQrUrl = buildVietQRString({
        bankId: profile.bankAccount.bankId,
        accountNumber: profile.bankAccount.accountNumber,
        amount: target.remainingBalance,
        memo,
      });

      generateQrDataUrl(
        `00020101021238580010A00000072701280006${profile.bankAccount.bankId}01${profile.bankAccount.accountNumber}530370454${target.remainingBalance}5802VN`
      ).then((dataUrl) => {
        // Fallback to VietQR image if generated
        setQrCodeUrl(vietQrUrl || dataUrl);
      });
    }
  }, [invoices, room, profile]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSendPaymentSlip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofTxnCode.trim()) return;
    setProofLoading(true);
    setTimeout(() => {
      setProofLoading(false);
      setProofSubmitted(true);
    }, 600);
  };

  const memo = activeInvoice ? `${room.code} TIEN NHA T${activeInvoice.periodMonth.slice(5)}` : `${room.code} TIEN NHA`;

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-20">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 p-5 rounded-2xl border border-emerald-700/50 shadow-xl text-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Cổng Người Thuê
            </span>
            <h1 className="text-xl font-black mt-1 text-white">
              {room.name} ({room.code})
            </h1>
            <p className="text-xs text-emerald-200 mt-0.5">
              Khu Trọ: {profile.name}
            </p>
          </div>
          <button
            onClick={onOpenMaintenanceModal}
            className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors"
          >
            <Wrench className="w-4 h-4" />
            <span>Báo hư hỏng</span>
          </button>
        </div>
      </div>

      {/* Main Payment Status Card */}
      {activeInvoice ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          {/* Status Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-850/60">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-400">Bảng tiền tháng:</span>
                <div className="text-base font-bold text-white">
                  Kỳ {activeInvoice.periodMonth} ({activeInvoice.invoiceCode})
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Hạn nộp:{' '}
                    <strong className="text-amber-300">
                      {formatDateVN(activeInvoice.extendedDueDate || activeInvoice.dueDate)}
                    </strong>
                  </span>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  activeInvoice.remainingBalance <= 0
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-amber-950 text-amber-300 border border-amber-700'
                }`}
              >
                {activeInvoice.remainingBalance <= 0 ? 'Đã nộp đủ' : 'Chưa nộp đủ'}
              </span>
            </div>

            {/* Total Balance Hero */}
            <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block">Số tiền còn phải thanh toán:</span>
              <div className="text-3xl font-black text-emerald-400 mt-1">
                {formatVND(activeInvoice.remainingBalance)}
              </div>
              {activeInvoice.remainingBalance > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  Vui lòng chuyển khoản trước ngày 10 hoặc liên hệ chủ trọ nếu có thắc mắc
                </p>
              )}
            </div>
          </div>

          {/* Breakdown Items ("Vì sao") */}
          <div className="p-4 sm:p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Chi tiết các khoản tính tiền:
            </h3>

            <div className="space-y-2 text-xs">
              {activeInvoice.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                  <span className="text-slate-300">{item.name}</span>
                  <span className="font-semibold text-white">{formatVND(item.amount)}</span>
                </div>
              ))}

              {activeInvoice.previousDebt > 0 && (
                <div className="flex justify-between items-center py-1.5 text-amber-400 border-b border-slate-800">
                  <span>Nợ các tháng trước mang sang:</span>
                  <span className="font-bold">+{formatVND(activeInvoice.previousDebt)}</span>
                </div>
              )}

              {activeInvoice.appliedAdvance > 0 && (
                <div className="flex justify-between items-center py-1.5 text-teal-400 border-b border-slate-800">
                  <span>Tiền trả trước đã trừ vào hóa đơn:</span>
                  <span className="font-bold">-{formatVND(activeInvoice.appliedAdvance)}</span>
                </div>
              )}

              {activeInvoice.paidAmount > 0 && (
                <div className="flex justify-between items-center py-1.5 text-emerald-400 border-b border-slate-800">
                  <span>Đã thanh toán trước đó:</span>
                  <span className="font-bold">-{formatVND(activeInvoice.paidAmount)}</span>
                </div>
              )}
            </div>

            {/* QR Payment Box */}
            {activeInvoice.remainingBalance > 0 && (
              <div className="pt-3 space-y-3">
                <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <QrCode className="w-4 h-4" />
                    <span>Mã VietQR chuyển khoản nhanh:</span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900 p-3 rounded-xl border border-slate-800">
                    {/* QR Code image */}
                    <div className="bg-white p-2 rounded-xl shrink-0 shadow-md">
                      <img
                        src={qrCodeUrl}
                        alt="VietQR"
                        className="w-40 h-40 object-contain rounded"
                        onError={(e) => {
                          // Fallback to standard placeholder if external image fails
                          (e.target as any).src = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(memo);
                        }}
                      />
                    </div>

                    {/* Bank Details & Copy helpers */}
                    <div className="space-y-2 text-xs w-full">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Ngân hàng:</span>
                        <div className="font-semibold text-white">{profile.bankAccount.bankName}</div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-slate-400">Số tài khoản:</span>
                          <button
                            onClick={() => copyToClipboard(profile.bankAccount.accountNumber, 'acc')}
                            className="text-emerald-400 hover:text-emerald-300 text-[11px] flex items-center gap-1 font-semibold"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedField === 'acc' ? 'Đã chép!' : 'Chép STK'}
                          </button>
                        </div>
                        <div className="font-mono text-sm font-bold text-emerald-300">
                          {profile.bankAccount.accountNumber}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 block">Chủ tài khoản:</span>
                        <div className="font-bold text-white uppercase">{profile.bankAccount.accountHolder}</div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-slate-400">Nội dung chuyển:</span>
                          <button
                            onClick={() => copyToClipboard(memo, 'memo')}
                            className="text-emerald-400 hover:text-emerald-300 text-[11px] flex items-center gap-1 font-semibold"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedField === 'memo' ? 'Đã chép!' : 'Chép nội dung'}
                          </button>
                        </div>
                        <div className="font-mono text-xs font-semibold text-slate-200 bg-slate-800 p-1.5 rounded border border-slate-700">
                          {memo}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Transfer Confirmation */}
                <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-200">
                    Đã chuyển khoản xong? Gửi xác nhận cho chủ trọ:
                  </h4>
                  {proofSubmitted ? (
                    <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-700 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Đã gửi thông tin chuyển khoản! Chủ trọ sẽ kiểm tra tài khoản thực tế và cập nhật phiếu thu cho bạn.
                      </span>
                    </div>
                  ) : (
                    <form onSubmit={handleSendPaymentSlip} className="flex gap-2">
                      <input
                        type="text"
                        value={proofTxnCode}
                        onChange={(e) => setProofTxnCode(e.target.value)}
                        placeholder="Nhập mã giao dịch NH hoặc 4 số cuối STK"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={proofLoading || !proofTxnCode.trim()}
                        className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi</span>
                      </button>
                    </form>
                  )}
                  <p className="text-[11px] text-slate-400 italic">
                    * Lưu ý: Gửi mã giao dịch sẽ tạo trạng thái Chờ chủ trọ đối soát, hóa đơn sẽ cập nhật sau khi chủ trọ xác nhận tiền vào tài khoản.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400">
          Chưa có bảng tiền nào được lập cho phòng này.
        </div>
      )}

      {/* Payment History */}
      <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Lịch sử các lần đã nộp tiền:
        </h3>
        {payments.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Chưa có phiếu thu nào được ghi nhận.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-slate-850 border border-slate-800 flex justify-between items-center text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{p.paymentCode}</div>
                  <div className="text-[11px] text-slate-400">
                    {formatDateVN(p.receivedAt, true)} • {p.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-400 text-sm">{formatVND(p.amount)}</div>
                  <span className="text-[10px] text-slate-400">Người thu: {p.receivedBy}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
