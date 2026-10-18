import React, { useState } from 'react';
import { Invoice, Room } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVND } from '../utils/formatters.ts';
import {
  FileText,
  Lock,
  X,
  SlidersHorizontal,
  RotateCcw,
  BarChart2,
  ListFilter,
  CheckCircle2,
  ChevronRight,
  Zap,
  Droplet,
  Search,
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
  const [activeTab, setActiveTab] = useState<'list' | 'matrix'>('list');
  const [generating, setGenerating] = useState(false);
  const [adjustModalInv, setAdjustModalInv] = useState<Invoice | null>(null);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjType, setAdjType] = useState<'decrease' | 'increase'>('decrease');
  const [adjReason, setAdjReason] = useState('Giảm trừ cúp nước nửa ngày');
  const [savingAdj, setSavingAdj] = useState(false);

  // Filters
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>(currentPeriod);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Derive unique period months available across all invoices
  const availablePeriods = Array.from(
    new Set(invoices.map((i) => i.periodMonth).concat(currentPeriod))
  )
    .sort()
    .reverse();

  // Filter invoices dynamically for Tab 1
  const filteredInvoices = invoices.filter((i) => {
    if (selectedPeriodFilter !== 'all' && i.periodMonth !== selectedPeriodFilter) return false;
    if (selectedRoomFilter !== 'all' && i.roomId !== selectedRoomFilter) return false;
    if (selectedStatusFilter === 'unpaid' && i.remainingBalance <= 0) return false;
    if (selectedStatusFilter === 'paid' && i.remainingBalance > 0) return false;
    if (selectedStatusFilter === 'locked' && i.status !== 'locked') return false;
    if (selectedStatusFilter === 'draft' && i.status !== 'draft') return false;
    return true;
  });

  const handleGenerateInvoices = async () => {
    setGenerating(true);
    try {
      await api.generateInvoices(selectedPeriodFilter !== 'all' ? selectedPeriodFilter : currentPeriod);
      alert(`Đã tính toán và lập bảng tiền tháng ${selectedPeriodFilter !== 'all' ? selectedPeriodFilter : currentPeriod} cho các phòng!`);
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
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-850 to-teal-850 px-5 py-4 flex items-center justify-between border-b border-emerald-700/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg leading-tight">Quản Lý & Tra Cứu Hóa Đơn Lịch Sử Các Tháng</h2>
              <p className="text-xs text-emerald-200">
                Tra cứu, đối chiếu hóa đơn điện nước & tiền phòng giữa các tháng cũ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher: Danh sách vs Bảng đối chiếu đa kỳ */}
        <div className="bg-slate-850 px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              <span>Danh Sách Hóa Đơn Lịch Sử</span>
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>Bảng Đối Chiếu Đa Kỳ Các Tháng</span>
            </button>
          </div>
        </div>

        {/* TAB 1: LIST VIEW WITH FILTERS */}
        {activeTab === 'list' && (
          <>
            {/* Multi-Filter Bar: Month, Room, Status */}
            <div className="bg-slate-850 px-4 py-3 border-b border-slate-800 space-y-2 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {/* Period Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">📅 Kỳ Tháng Thu:</label>
                  <select
                    value={selectedPeriodFilter}
                    onChange={(e) => setSelectedPeriodFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 font-bold text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tất cả các tháng (Toàn bộ lịch sử)</option>
                    {availablePeriods.map((p) => (
                      <option key={p} value={p}>
                        Tháng {p.slice(5)}/{p.slice(0, 4)} {p === currentPeriod ? '(Kỳ hiện tại)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Room Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">🏠 Phòng Trọ:</label>
                  <select
                    value={selectedRoomFilter}
                    onChange={(e) => setSelectedRoomFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 font-bold text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tất cả các phòng ({rooms.length} phòng)</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} - {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">📌 Trạng Thái Thanh Toán:</label>
                  <select
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 font-bold text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="unpaid">Còn thiếu / Chưa nộp</option>
                    <option value="paid">Đã thanh toán đủ</option>
                    <option value="locked">Đã chốt sổ</option>
                    <option value="draft">Bản nháp</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-2 pt-1 text-xs border-t border-slate-800/80">
                <span className="text-slate-400">
                  Hiển thị: <strong className="text-emerald-400 font-extrabold">{filteredInvoices.length} hóa đơn</strong>
                </span>
                <button
                  type="button"
                  onClick={handleGenerateInvoices}
                  disabled={generating}
                  className="py-1.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  <span>{generating ? 'Đang tính toán...' : `Lập / Cập nhật bảng tiền kỳ ${selectedPeriodFilter !== 'all' ? selectedPeriodFilter : currentPeriod}`}</span>
                </button>
              </div>
            </div>

            {/* Invoices List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 scrollbar-thin">
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-10 bg-slate-850 rounded-2xl border border-slate-800 space-y-2">
                  <p className="text-xs text-slate-400">
                    Không tìm thấy hóa đơn nào khớp với bộ lọc.
                  </p>
                </div>
              ) : (
                filteredInvoices.map((inv) => {
                  const room = rooms.find((r) => r.id === inv.roomId);
                  return (
                    <div
                      key={inv.id}
                      className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">
                              {room ? room.code : inv.roomId} - {inv.payerName}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-mono">
                              Kỳ T{inv.periodMonth.slice(5)}/{inv.periodMonth.slice(0, 4)}
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
                          className="py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Điều chỉnh tăng / giảm</span>
                        </button>
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleLockInvoice(inv.id)}
                            className="py-1 px-3 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
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
          </>
        )}

        {/* TAB 2: MULTI-MONTH COMPARISON MATRIX */}
        {activeTab === 'matrix' && (
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
            <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-300">
                Đối chiếu bảng tiền & điện nước của từng phòng qua tất cả các tháng ({availablePeriods.length} kỳ):
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                Cập nhật mới nhất: T10/2026
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-850">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-slate-300 font-extrabold border-b border-slate-700">
                  <tr>
                    <th className="p-3 sticky left-0 bg-slate-800 z-10">Phòng Trọ</th>
                    {availablePeriods.map((p) => (
                      <th key={p} className="p-3 text-center min-w-[130px]">
                        Tháng {p.slice(5)}/{p.slice(0, 4)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium text-slate-200">
                  {rooms.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/60 transition-colors">
                      <td className="p-3 font-bold text-emerald-400 sticky left-0 bg-slate-850 z-10 border-r border-slate-800 whitespace-nowrap">
                        {r.code} ({r.name})
                      </td>
                      {availablePeriods.map((p) => {
                        const inv = invoices.find((i) => i.roomId === r.id && i.periodMonth === p);
                        if (!inv) {
                          return (
                            <td key={p} className="p-3 text-center text-slate-500 italic">
                              Chưa lập
                            </td>
                          );
                        }
                        return (
                          <td key={p} className="p-2.5 text-center border-r border-slate-800/40">
                            <div className="font-bold text-white">{formatVND(inv.currentCycleTotal)}</div>
                            <div className="text-[10px] mt-0.5">
                              {inv.remainingBalance <= 0 ? (
                                <span className="text-emerald-400 font-bold">✅ Đã đủ</span>
                              ) : (
                                <span className="text-amber-400 font-bold">
                                  Thiếu {formatVND(inv.remainingBalance)}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Adjustment Modal if open */}
        {adjustModalInv && (
          <div className="p-4 bg-slate-800 border-t border-slate-700 space-y-3 text-xs shrink-0">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-white">
                Điều chỉnh số tiền cho {adjustModalInv.invoiceCode} ({adjustModalInv.payerName})
              </h4>
              <button onClick={() => setAdjustModalInv(null)} className="text-slate-400 hover:text-white cursor-pointer">
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
                  className="py-1.5 px-4 rounded bg-emerald-600 text-white font-bold cursor-pointer"
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
