import React, { useState } from 'react';
import { HouseExpense } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVND, formatDateVN } from '../utils/formatters.ts';
import { Plus, X, DollarSign, Receipt, Tag } from 'lucide-react';

interface ExpensesModalProps {
  expenses: HouseExpense[];
  onClose: () => void;
  onRefresh: () => void;
}

export const ExpensesModal: React.FC<ExpensesModalProps> = ({ expenses, onClose, onRefresh }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [category, setCategory] = useState<HouseExpense['category']>('repairs');
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(amountStr.replace(/\D/g, ''), 10) || 0;
    if (num <= 0 || !title.trim()) return;

    setLoading(true);
    try {
      await api.createExpense({
        category,
        title: title.trim(),
        amount: num,
        notes: notes.trim() || undefined,
      });
      setShowCreate(false);
      setTitle('');
      setAmountStr('');
      setNotes('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu chi phí.');
    } finally {
      setLoading(false);
    }
  };

  const categoryNames: Record<HouseExpense['category'], string> = {
    electricity_master: 'Điện tổng',
    water_master: 'Nước tổng',
    repairs: 'Sửa chữa / Bảo trì',
    internet_master: 'Cáp quang tổng',
    taxes: 'Thuế / Môn bài',
    cleaning: 'Vệ sinh / Dọn rác',
    other: 'Chi phí khác',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 px-5 py-4 flex items-center justify-between border-b border-rose-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg leading-tight">Chi Phí Khu Trọ</h2>
              <p className="text-xs text-rose-200">Ghi nhận các khoản chi chủ trọ chịu để tính đúng dòng tiền</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Total Bar */}
        <div className="bg-slate-850 px-4 py-3 border-b border-slate-800 flex justify-between items-center text-xs">
          <div>
            <span className="text-slate-400">Tổng chi phí đã ghi nhận: </span>
            <strong className="text-rose-400 text-sm font-black">{formatVND(totalExpense)}</strong>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="py-1.5 px-3 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreate ? 'Đóng' : 'Thêm khoản chi'}</span>
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <form onSubmit={handleCreate} className="p-4 bg-slate-850 border-b border-slate-800 space-y-3 text-xs">
            <h4 className="font-bold text-rose-400">Ghi nhận khoản chi mới</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1">Loại chi phí:</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {Object.entries(categoryNames).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Số tiền chi (VND):</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0 đ"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-bold"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Mô tả nội dung chi:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Cước gói internet tổng Viettel, Mua 2 bóng đèn led..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 rounded-lg bg-rose-600 text-white font-bold"
              >
                {loading ? 'Đang lưu...' : 'Lưu khoản chi'}
              </button>
            </div>
          </form>
        )}

        {/* Expenses List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5">
          {expenses.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-500 italic">Chưa có khoản chi nào.</p>
          ) : (
            expenses.map((e) => (
              <div
                key={e.id}
                className="p-3 rounded-xl bg-slate-850 border border-slate-800 flex justify-between items-center text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{e.title}</div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {categoryNames[e.category] || e.category}
                    </span>
                    <span>{formatDateVN(e.date)}</span>
                    <span>Người chi: {e.paidBy}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-rose-400 text-sm">-{formatVND(e.amount)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
