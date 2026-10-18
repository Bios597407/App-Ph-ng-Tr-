import React, { useState, useEffect } from 'react';
import { Room, Invoice, Payment } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVND } from '../utils/formatters.ts';
import {
  X,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface QuickCollectModalProps {
  initialRoomId?: string;
  rooms: Room[];
  invoices: Invoice[];
  onClose: () => void;
  onSuccess: (payment: Payment) => void;
}

export const QuickCollectModal: React.FC<QuickCollectModalProps> = ({
  initialRoomId,
  rooms,
  invoices,
  onClose,
  onSuccess,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    initialRoomId || (rooms.find((r) => r.status === 'rented')?.id || rooms[0]?.id || '')
  );
  const [amountStr, setAmountStr] = useState<string>('');
  const [method, setMethod] = useState<'transfer' | 'cash'>('transfer');
  const [bankRef, setBankRef] = useState<string>('');
  const [payerName, setPayerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Generate unique idempotency key once per modal open
  const [idempotencyKey] = useState<string>(() => `pay-req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  const currentRoom = rooms.find((r) => r.id === selectedRoomId);
  const roomInvoices = invoices.filter(
    (i) => i.roomId === selectedRoomId && i.remainingBalance > 0 && i.status !== 'cancelled'
  );

  const totalRemainingDebt = roomInvoices.reduce((sum, inv) => sum + inv.remainingBalance, 0);

  useEffect(() => {
    if (currentRoom) {
      // Find payer name
      const activeInv = roomInvoices[0];
      if (activeInv) {
        setPayerName(activeInv.payerName);
      } else {
        setPayerName(currentRoom.name);
      }
      // Default to total remaining debt if > 0
      if (totalRemainingDebt > 0) {
        setAmountStr(totalRemainingDebt.toString());
      } else {
        setAmountStr(currentRoom.currentRent.toString());
      }
    }
  }, [selectedRoomId, totalRemainingDebt]);

  const numAmount = parseInt(amountStr.replace(/\D/g, ''), 10) || 0;

  // Compute live preview of allocation
  let previewAllocated = 0;
  const previewAllocations: { invoice: Invoice; amount: number }[] = [];
  let remaining = numAmount;

  for (const inv of roomInvoices) {
    if (remaining <= 0) break;
    const alloc = Math.min(remaining, inv.remainingBalance);
    previewAllocations.push({ invoice: inv, amount: alloc });
    previewAllocated += alloc;
    remaining -= alloc;
  }
  const previewSurplus = numAmount - previewAllocated;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setErrorMessage('Vui lòng nhập số tiền hợp lệ (> 0 đ).');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.recordPayment({
        roomId: selectedRoomId,
        amount: numAmount,
        payerName: payerName.trim() || currentRoom?.name || 'Khách thuê',
        method,
        bankTransactionRef: bankRef.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey,
      });

      onSuccess(res.payment);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể lưu khoản thu. Vui lòng kiểm tra kết nối mạng!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col text-slate-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed at Top */}
        <div className="bg-gradient-to-r from-emerald-850 to-teal-800 px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-emerald-700/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg leading-tight">Ghi Nhận Thu Tiền</h2>
              <p className="text-[11px] sm:text-xs text-emerald-200">Tối ưu thao tác nhanh & cuộn xem dễ dàng trên điện thoại</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors cursor-pointer"
            title="Đóng hộp thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container with Scrollable Body and Fixed Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin text-xs sm:text-sm">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Room Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Chọn phòng thu tiền:
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} - {r.name} ({r.status === 'rented' ? 'Đang thuê' : 'Trống'})
                  </option>
                ))}
              </select>
            </div>

            {/* Current Debt & Billing Breakdown Summary */}
            {(() => {
              const activeInv = roomInvoices[0];
              const rentItem = activeInv?.items.find((i) => i.type === 'rent');
              const elecItem = activeInv?.items.find((i) => i.type === 'electricity');
              const waterItem = activeInv?.items.find((i) => i.type === 'water');
              const serviceItems = activeInv?.items.filter((i) =>
                ['garbage', 'internet', 'other'].includes(i.type)
              ) || [];

              const rentAmt = rentItem?.amount || currentRoom?.currentRent || 0;
              const elecAmt = elecItem?.amount || 0;
              const waterAmt = waterItem?.amount || 0;
              const utilityAmt = elecAmt + waterAmt;
              const serviceAmt = serviceItems.reduce((s, i) => s + i.amount, 0);

              return (
                <div className="bg-slate-850 rounded-xl p-3.5 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Người thuê / Đại diện:</span>
                      <span className="font-bold text-white text-sm">{payerName || '--'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[11px]">Kỳ hóa đơn:</span>
                      <span className="font-extrabold text-emerald-400 text-xs">
                        {activeInv ? `Tháng ${activeInv.periodMonth}` : 'Không có nợ'}
                      </span>
                    </div>
                  </div>

                  {/* ITEMIZED BREAKDOWN LIST - KEEPING ALL ACCESSIBLE ITEMS */}
                  {activeInv && (
                    <div className="space-y-1.5 pt-0.5 text-slate-300">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Bảng kê chi tiết cấu thành khoản thu:
                      </div>
                      
                      {/* Rent */}
                      <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-750">
                        <span>🏠 Tiền thuê phòng:</span>
                        <span className="font-extrabold text-white">{formatVND(rentAmt)}</span>
                      </div>

                      {/* Electricity */}
                      <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-750">
                        <span>
                          ⚡ Điện ({elecItem?.quantity || 0} kWh x {(elecItem?.unitPrice || 5000).toLocaleString('vi-VN')} đ):
                        </span>
                        <span className="font-extrabold text-amber-300">{formatVND(elecAmt)}</span>
                      </div>

                      {/* Water */}
                      <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-750">
                        <span>
                          💧 Nước ({waterItem?.quantity || 0} m³ x {(waterItem?.unitPrice || 4000).toLocaleString('vi-VN')} đ):
                        </span>
                        <span className="font-extrabold text-sky-300">{formatVND(waterAmt)}</span>
                      </div>

                      {/* Service fees */}
                      <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-750">
                        <span>🗑️ Phí dịch vụ (Rác, Wifi, Phụ phí):</span>
                        <span className="font-extrabold text-teal-300">+{formatVND(serviceAmt)}</span>
                      </div>

                      {/* Current Cycle Total */}
                      <div className="flex justify-between items-center bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700 font-extrabold text-white">
                        <span>📊 Tổng phát sinh kỳ này:</span>
                        <span className="font-mono">{formatVND(activeInv.currentCycleTotal)}</span>
                      </div>

                      {/* Previous Debt */}
                      {activeInv.previousDebt > 0 && (
                        <div className="flex justify-between items-center bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-rose-900/50 text-rose-300">
                          <span>➕ Nợ cũ kỳ trước mang sang:</span>
                          <span className="font-extrabold">+{formatVND(activeInv.previousDebt)}</span>
                        </div>
                      )}

                      {/* Previous Paid Amount */}
                      {activeInv.paidAmount > 0 && (
                        <div className="flex justify-between items-center bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-900/50 text-emerald-300">
                          <span>🔻 Đã thanh toán đợt trước:</span>
                          <span className="font-extrabold">-{formatVND(activeInv.paidAmount)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TOTAL REMAINING */}
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-800 font-black">
                    <span className="text-amber-300">Tổng còn phải thu:</span>
                    <span className="text-amber-400 text-lg tabular-nums">
                      {formatVND(totalRemainingDebt)}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Payment Amount Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Số tiền thực nhận (VND):
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={numAmount > 0 ? numAmount.toLocaleString('vi-VN') : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setAmountStr(raw);
                  }}
                  placeholder="0"
                  className="w-full bg-slate-800 border-2 border-emerald-600/60 rounded-xl px-3.5 py-3 text-xl font-black text-emerald-400 text-right pr-12 focus:outline-none focus:border-emerald-400 font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-sm text-slate-400">
                  đ
                </span>
              </div>

              {/* Smart Context-Aware Quick Amount Chips */}
              {(() => {
                const activeInv = roomInvoices[0];
                const rentAmt = activeInv?.items.find((i) => i.type === 'rent')?.amount || currentRoom?.currentRent || 0;
                const elecAmt = activeInv?.items.find((i) => i.type === 'electricity')?.amount || 0;
                const waterAmt = activeInv?.items.find((i) => i.type === 'water')?.amount || 0;
                const utilityAmt = elecAmt + waterAmt;

                return (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {totalRemainingDebt > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmountStr(totalRemainingDebt.toString())}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs font-black hover:bg-emerald-900 transition-colors shadow-2xs cursor-pointer"
                      >
                        Trả hết ({formatVND(totalRemainingDebt)})
                      </button>
                    )}
                    {rentAmt > 0 && rentAmt !== totalRemainingDebt && (
                      <button
                        type="button"
                        onClick={() => setAmountStr(rentAmt.toString())}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-750 transition-colors cursor-pointer"
                      >
                        Chỉ tiền phòng ({formatVND(rentAmt)})
                      </button>
                    )}
                    {utilityAmt > 0 && utilityAmt !== totalRemainingDebt && (
                      <button
                        type="button"
                        onClick={() => setAmountStr(utilityAmt.toString())}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-750 transition-colors cursor-pointer"
                      >
                        Chỉ Điện + Nước ({formatVND(utilityAmt)})
                      </button>
                    )}
                    {rentAmt > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmountStr(Math.round(rentAmt / 2).toString())}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-750 transition-colors cursor-pointer"
                      >
                        50% Tiền phòng ({formatVND(Math.round(rentAmt / 2))})
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Payment Method Toggle */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Hình thức thu tiền:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('transfer')}
                  className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-medium text-xs transition-all cursor-pointer ${
                    method === 'transfer'
                      ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Chuyển khoản (QR)
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('cash')}
                  className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-medium text-xs transition-all cursor-pointer ${
                    method === 'cash'
                      ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  Tiền mặt trao tay
                </button>
              </div>
            </div>

            {method === 'transfer' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Mã giao dịch ngân hàng / Tham chiếu (tùy chọn):
                </label>
                <input
                  type="text"
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  placeholder="VD: MB-239103 hoặc VCB-99238"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Allocation Preview */}
            {numAmount > 0 && (
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Xem trước phân bổ tự động:</span>
                </div>
                {previewAllocations.length === 0 ? (
                  <p className="text-slate-400 italic">
                    Không có hóa đơn còn nợ. Toàn bộ tiền sẽ được lưu vào số dư trả trước/cọc của phòng.
                  </p>
                ) : (
                  previewAllocations.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-300">
                      <span>
                        Trừ nợ kỳ {p.invoice.periodMonth} ({p.invoice.invoiceCode}):
                      </span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        -{formatVND(p.amount)}
                      </span>
                    </div>
                  ))
                )}
                {previewSurplus > 0 && (
                  <div className="flex justify-between items-center text-amber-400 font-medium pt-1 border-t border-slate-800">
                    <span>Tiền thu dư (chuyển vào Trả trước):</span>
                    <span className="font-mono">+{formatVND(previewSurplus)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Ghi chú thêm:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Khách trả tiền đợt 1, hẹn đợt 2 ngày 15"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Submit Actions - Fixed at Bottom */}
          <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur-xs flex gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-1/3 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || numAmount <= 0}
              className="w-2/3 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98] cursor-pointer"
            >
              {loading ? (
                <span>Đang ghi nhận...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác Nhận Thu {formatVND(numAmount)}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
