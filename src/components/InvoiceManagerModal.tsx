import React, { useState } from 'react';
import { Invoice, Room } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVND, formatDateVN } from '../utils/formatters.ts';
import {
  FileText,
  Lock,
  PlusCircle,
  X,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface InvoiceManagerModalProps {
  invoices: Invoice[];
  rooms: Room[];
  currentPeriod: string;
  onClose: () => void;
  onRefresh: () => void;
}

export const InvoiceManagerModal: React.FC<InvoiceManagerModalProps> = ({
  invoices,
  rooms,
  currentPeriod,
  onClose,
  onRefresh,
}) => {
  const [generating, setGenerating] = useState(false);
  const [adjustModalInv, setAdjustModalInv] = useState<Invoice | null>(null);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjType, setAdjType] = useState<'decrease' | 'increase'>('decrease');
  const [adjReason, setAdjReason] = useState('Giảm trừ cúp nước nửa ngày');
  const [savingAdj, setSavingAdj] = useState(false);

  const periodInvoices = invoices.filter((i) => i.periodMonth === currentPeriod);

  const handleGenerateInvoices = async () => {
    setGenerating(true);
    try {
      await api.generateInvoices(currentPeriod);
      alert(`Đã tính toán và lập bảng tiền tháng ${currentPeriod} cho các phòng!`);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lập hóa đơn.');
    } finally {
      setGenerating(false);
    }
  };

  const handleLockInvoice = async (invoiceId: string) => {
    try {
      await api.lockInvoice(invoiceId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi chốt hóa đơn.');
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalInv) return;
    const num = parseInt(adjAmount.replace(/\D/g, ''), 10) || 0;
    if (num <= 0 || !adjReason.trim()) return;

    setSavingAdj(true);
    try {
      await api.adjustInvoice(adjustModalInv.id, {
        amount: num,
        type: adjType,
        reason: adjReason.trim(),
      });
      setAdjustModalInv(null);
      setAdjAmount('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi điều chỉnh hóa đơn.');
    } finally {
      setSavingAdj(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-850 to-teal-850 px-5 py-4 flex items-center justify-between border-b border-emerald-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg leading-tight">Quản Lý Bảng Tiền Thuê</h2>
              <p className="text-xs text-emerald-200">
                Kỳ {currentPeriod} • Lập nháp, kiểm tra chỉ số, chốt và điều chỉnh
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="bg-slate-850 px-4 py-3 border-b border-slate-800 flex flex-wrap justify-between items-center gap-2 text-xs">
          <div>
            <span className="text-slate-400">Số bảng tiền kỳ này: </span>
            <strong className="text-white text-sm">{periodInvoices.length} phòng</strong>
          </div>
          <button
            onClick={handleGenerateInvoices}
            disabled={generating}
            className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RotateCcw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Đang tính toán...' : 'Lập / Cập nhật bảng tiền tháng này'}</span>
          </button>
        </div>

        {/* Invoices List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {periodInvoices.length === 0 ? (
            <div className="text-center py-10 bg-slate-850 rounded-2xl border border-slate-800 space-y-2">
              <p className="text-xs text-slate-400">
                Chưa có bảng tiền nào được lập cho tháng {currentPeriod}.
              </p>
              <button
                onClick={handleGenerateInvoices}
                className="py-2 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs"
              >
                Tạo Bảng Tiền Tự Động Từ Chỉ Số
              </button>
            </div>
          ) : (
            periodInvoices.map((inv) => {
              const room = rooms.find((r) => r.id === inv.roomId);
              return (
                <div
                  key={inv.id}
                  className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {room ? room.code : inv.roomId} - {inv.payerName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'locked'
                              ? 'bg-slate-800 text-slate-300 border border-slate-700'
                              : 'bg-amber-950 text-amber-300 border border-amber-700'
                          }`}
                        >
                          {inv.status === 'locked' ? 'Đã chốt' : 'Bản nháp'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{inv.invoiceCode}</span>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-emerald-400">
                        {formatVND(inv.currentCycleTotal)}
                      </div>
                      <span
                        className={`text-[10px] font-bold ${
                          inv.remainingBalance <= 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {inv.remainingBalance <= 0 ? 'Đã thanh toán đủ' : `Còn thiếu: ${formatVND(inv.remainingBalance)}`}
                      </span>
                    </div>
                  </div>

                  {/* Summary of items */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 bg-slate-900 p-2 rounded-lg border border-slate-800/80">
                    {inv.items.map((it, idx) => (
                      <span key={idx}>
                        {it.name}: <strong className="text-slate-300">{formatVND(it.amount)}</strong>
                      </span>
                    ))}
                    {inv.previousDebt > 0 && (
                      <span className="text-amber-400">
                        Nợ cũ: <strong>+{formatVND(inv.previousDebt)}</strong>
                      </span>
                    )}
                  </div>

                  {/* Action row */}
                  <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
                    <button
                      onClick={() => setAdjustModalInv(inv)}
                      className="py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs flex items-center gap-1"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Điều chỉnh tăng / giảm</span>
                    </button>
                    {inv.status === 'draft' && (
                      <button
                        onClick={() => handleLockInvoice(inv.id)}
                        className="py-1 px-3 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Chốt bảng tiền</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Adjustment Modal if open */}
        {adjustModalInv && (
          <div className="p-4 bg-slate-800 border-t border-slate-700 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-white">
                Điều chỉnh số tiền cho {adjustModalInv.invoiceCode} ({adjustModalInv.payerName})
              </h4>
              <button onClick={() => setAdjustModalInv(null)} className="text-slate-400 hover:text-white">
                Hủy
              </button>
            </div>
            <form onSubmit={handleSaveAdjustment} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Loại điều chỉnh:</label>
                  <select
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                  >
                    <option value="decrease">Giảm trừ nghĩa vụ (-)</option>
                    <option value="increase">Cộng thêm (+)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Số tiền điều chỉnh (VND):</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    placeholder="0 đ"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Lý do điều chỉnh (lưu vết lịch sử):</label>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="VD: Hỗ trợ tiền nước nửa tháng cúp nước, phụ thu tiền gửi xe..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingAdj}
                  className="py-1.5 px-4 rounded bg-emerald-600 text-white font-bold"
                >
                  {savingAdj ? 'Đang lưu...' : 'Xác Nhận Điều Chỉnh'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
