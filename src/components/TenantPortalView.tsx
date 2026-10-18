import React, { useState, useEffect } from 'react';
import { Room, Invoice, Payment, HouseProfile } from '../types/index.ts';
import { formatVND, formatDateVN, generateQrDataUrl, buildVietQRString } from '../utils/formatters.ts';
import {
  QrCode,
  Copy,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Clock,
  Send,
  Zap,
  Droplet,
  FileText,
  BarChart3,
  History,
  ChevronRight,
  TrendingUp,
  TrendingDown,
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
  const [viewMode, setViewMode] = useState<'detail' | 'comparison'>('detail');

  // Room invoices sorted newest first
  const roomInvoices = invoices
    .filter((i) => i.roomId === room.id)
    .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));

  useEffect(() => {
    if (roomInvoices.length > 0 && !activeInvoice) {
      const pending = roomInvoices.find((i) => i.remainingBalance > 0);
      const target = pending || roomInvoices[0];
      setActiveInvoice(target);
    }
  }, [roomInvoices, activeInvoice]);

  useEffect(() => {
    if (activeInvoice && activeInvoice.remainingBalance > 0) {
      const memo = `${room.code} TIEN NHA T${activeInvoice.periodMonth.slice(5)}`;
      const vietQrUrl = buildVietQRString({
        bankId: profile.bankAccount.bankId,
        accountNumber: profile.bankAccount.accountNumber,
        amount: activeInvoice.remainingBalance,
        memo,
      });

      generateQrDataUrl(
        `00020101021238580010A00000072701280006${profile.bankAccount.bankId}01${profile.bankAccount.accountNumber}530370454${activeInvoice.remainingBalance}5802VN`
      ).then((dataUrl) => {
        setQrCodeUrl(vietQrUrl || dataUrl);
      });
    }
  }, [activeInvoice, room, profile]);

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

  // Helper to get utility item metrics from an invoice
  const getItemDetails = (inv: Invoice) => {
    const elecItem = inv.items.find((i) => i.type === 'electricity' || i.name.includes('Điện'));
    const waterItem = inv.items.find((i) => i.type === 'water' || i.name.includes('Nước'));
    const rentItem = inv.items.find((i) => i.type === 'rent' || i.name.includes('Tiền thuê'));

    return {
      electricAmount: elecItem ? elecItem.amount : 0,
      waterAmount: waterItem ? waterItem.amount : 0,
      rentAmount: rentItem ? rentItem.amount : room.currentRent,
    };
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-5 rounded-2xl border border-emerald-700/50 shadow-xl text-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Cổng Người Thuê Phản Ánh & Xem Hóa Đơn
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
            className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Wrench className="w-4 h-4" />
            <span>Báo hư hỏng</span>
          </button>
        </div>
      </div>

      {/* Navigation View Switcher (Chi Tiết Hóa Đơn vs Bảng Đối Chiếu Lịch Sử) */}
      <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800 flex items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-1.5 w-full">
          <button
            onClick={() => setViewMode('detail')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'detail'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Chi Tiết Hóa Đơn</span>
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'comparison'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Bảng Đối Chiếu Lịch Sử</span>
          </button>
        </div>
      </div>

      {/* Month / Period Switcher Dropdown (Visible in Detail mode) */}
      {viewMode === 'detail' && roomInvoices.length > 0 && (
        <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs shadow-md">
          <span className="text-slate-300 font-bold flex items-center gap-1.5 shrink-0">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Chọn kỳ hóa đơn để xem:</span>
          </span>
          <select
            value={activeInvoice?.id || ''}
            onChange={(e) => {
              const selected = roomInvoices.find((i) => i.id === e.target.value);
              if (selected) setActiveInvoice(selected);
            }}
            className="bg-slate-800 text-white font-extrabold border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer text-xs"
          >
            {roomInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                Tháng {inv.periodMonth.slice(5)}/{inv.periodMonth.slice(0, 4)} ({formatVND(inv.currentCycleTotal)}) - {inv.remainingBalance <= 0 ? 'Đã hoàn tất' : 'Còn thiếu'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* VIEW 1: SINGLE INVOICE DETAIL & PAYMENT */}
      {viewMode === 'detail' && (
        <>
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

              {/* Breakdown Items */}
              <div className="p-4 sm:p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Chi tiết các khoản tính tiền kỳ T{activeInvoice.periodMonth.slice(5)}/{activeInvoice.periodMonth.slice(0, 4)}:
                </h3>

                <div className="space-y-2 text-xs">
                  {activeInvoice.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                      <span className="text-slate-300 font-medium">{item.name}</span>
                      <span className="font-bold text-white">{formatVND(item.amount)}</span>
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
                        {qrCodeUrl ? (
                          <div className="bg-white p-2 rounded-xl shrink-0 shadow-md">
                            <img
                              src={qrCodeUrl}
                              alt="VietQR"
                              className="w-40 h-40 object-contain rounded"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : null}

                        {/* Bank Details */}
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
        </>
      )}

      {/* VIEW 2: MONTH-OVER-MONTH HISTORICAL COMPARISON TABLE */}
      {viewMode === 'comparison' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 sm:p-5 space-y-4 shadow-xl text-slate-100">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <span>Bảng Đối Chiếu Tiền Trọ & Điện Nước Các Tháng</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Đối chiếu dễ dàng chi phí phòng, chỉ số điện nước & số tiền nộp qua từng kỳ
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 font-mono font-bold border border-emerald-800">
              {roomInvoices.length} kỳ hóa đơn
            </span>
          </div>

          {roomInvoices.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              Chưa có dữ liệu lịch sử hóa đơn nào.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-850">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-slate-300 font-extrabold border-b border-slate-700">
                  <tr>
                    <th className="p-3">Kỳ Tháng</th>
                    <th className="p-3">🏠 Tiền Phòng</th>
                    <th className="p-3">⚡ Điện</th>
                    <th className="p-3">💧 Nước</th>
                    <th className="p-3">💰 Tổng Tiền</th>
                    <th className="p-3">Trạng Thái</th>
                    <th className="p-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium text-slate-200">
                  {roomInvoices.map((inv) => {
                    const details = getItemDetails(inv);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-800/60 transition-colors">
                        <td className="p-3 font-bold font-mono text-emerald-400 whitespace-nowrap">
                          Tháng {inv.periodMonth.slice(5)}/{inv.periodMonth.slice(0, 4)}
                        </td>
                        <td className="p-3 font-semibold text-slate-200 whitespace-nowrap">
                          {formatVND(details.rentAmount)}
                        </td>
                        <td className="p-3 font-semibold text-amber-300 whitespace-nowrap">
                          {formatVND(details.electricAmount)}
                        </td>
                        <td className="p-3 font-semibold text-cyan-300 whitespace-nowrap">
                          {formatVND(details.waterAmount)}
                        </td>
                        <td className="p-3 font-black text-white text-sm whitespace-nowrap">
                          {formatVND(inv.currentCycleTotal)}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {inv.remainingBalance <= 0 ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold text-[11px]">
                              ✅ Đã đủ
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-700 font-bold text-[11px]">
                              Thiếu {formatVND(inv.remainingBalance)}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setActiveInvoice(inv);
                              setViewMode('detail');
                            }}
                            className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                          >
                            <span>Xem chi tiết</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payment History */}
      <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <History className="w-4 h-4 text-emerald-400" />
          <span>Lịch sử các đợt đã nộp tiền ({payments.length} phiếu thu):</span>
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
