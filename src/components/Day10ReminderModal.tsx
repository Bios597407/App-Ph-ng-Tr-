import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { HouseProfile } from '../types/index.ts';
import { formatVND, formatDateVN, buildZaloMessage } from '../utils/formatters.ts';
import {
  Bell,
  Copy,
  CheckCircle2,
  Calendar,
  X,
  MessageSquare,
  Clock,
  Send,
  AlertCircle,
} from 'lucide-react';

interface Day10ReminderModalProps {
  profile: HouseProfile;
  currentPeriod: string;
  onClose: () => void;
  onRefresh: () => void;
}

interface PendingReminderItem {
  invoiceId: string;
  invoiceCode: string;
  roomId: string;
  roomName: string;
  roomCode: string;
  payerName: string;
  phone: string;
  remainingBalance: number;
  dueDate: string;
  isExtended: boolean;
  formattedAmount: string;
  electricStart?: number;
  electricEnd?: number;
  electricRate?: number;
  waterStart?: number;
  waterEnd?: number;
  waterRate?: number;
  baseRent?: number;
  otherFees?: number;
  previousDebt?: number;
  appliedAdvance?: number;
}

export const Day10ReminderModal: React.FC<Day10ReminderModalProps> = ({
  profile,
  currentPeriod,
  onClose,
  onRefresh,
}) => {
  const [pendingList, setPendingList] = useState<PendingReminderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [extensionModalItem, setExtensionModalItem] = useState<PendingReminderItem | null>(null);
  const [extendDate, setExtendDate] = useState<string>(
    `${currentPeriod}-15`
  );
  const [extendReason, setExtendReason] = useState<string>('Khách hẹn nhận lương');

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const data = await api.getPendingReminders();
      setPendingList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateMessage = (item: PendingReminderItem): string => {
    const month = currentPeriod.slice(5);
    const transferNote = `${item.roomCode} TIEN NHA T${month}`;

    return buildZaloMessage({
      houseName: profile.name,
      roomCode: item.roomCode,
      roomName: item.roomName,
      payerName: item.payerName,
      periodMonth: currentPeriod,
      electricStart: item.electricStart || 1200,
      electricEnd: item.electricEnd || 1280,
      electricRate: item.electricRate || 5000,
      waterStart: item.waterStart || 340,
      waterEnd: item.waterEnd || 350,
      waterRate: item.waterRate || 4000,
      baseRent: item.baseRent || 1500000,
      otherFees: item.otherFees,
      previousDebt: item.previousDebt,
      appliedAdvance: item.appliedAdvance,
      totalDue: item.remainingBalance,
      bankName: profile.bankAccount.bankName,
      accountNumber: profile.bankAccount.accountNumber,
      accountHolder: profile.bankAccount.accountHolder,
      transferMemo: transferNote,
      dueDate: item.dueDate,
    });
  };

  const handleCopyMessage = async (item: PendingReminderItem, channel: 'zalo' | 'sms') => {
    const msg = generateMessage(item);
    await navigator.clipboard.writeText(msg);
    setCopiedId(`${item.invoiceId}-${channel}`);
    // Log reminder sent to server
    await api.logReminderSent({
      invoiceId: item.invoiceId,
      channel,
      content: msg,
    });
    setTimeout(() => setCopiedId(null), 2500);
  };

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extensionModalItem) return;
    setStatusMsg(null);
    try {
      await api.extendInvoice(extensionModalItem.invoiceId, {
        extendedDate: extendDate,
        reason: extendReason,
      });
      setExtensionModalItem(null);
      setStatusMsg({ type: 'success', text: `Đã gia hạn thành công cho phòng ${extensionModalItem.roomCode} đến ngày ${extendDate}!` });
      await loadPending();
      onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Lỗi khi lưu ngày gia hạn.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 px-5 py-4 flex items-center justify-between border-b border-amber-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg leading-tight">
                Nhắc Tiền Thuê Ngày 10
              </h2>
              <p className="text-xs text-amber-200">
                Lọc tự động danh sách phòng chưa nộp đủ tiền tháng {currentPeriod}
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

        {/* In-Modal Alert Notification */}
        {statusMsg && (
          <div className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/80 border-rose-800 text-rose-300'
          }`}>
            <span>{statusMsg.text}</span>
            <button
              type="button"
              onClick={() => setStatusMsg(null)}
              className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Đang tải danh sách phòng...</div>
          ) : pendingList.length === 0 ? (
            <div className="p-8 text-center bg-slate-850 rounded-xl border border-slate-800 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="font-bold text-sm text-white">Tất cả các phòng đã thanh toán đủ!</h3>
              <p className="text-xs text-slate-400">
                Không có phòng nào quá hạn hoặc còn nợ tiền tháng {currentPeriod}.
              </p>
            </div>
          ) : (
            pendingList.map((item) => (
              <div
                key={item.invoiceId}
                className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">
                        {item.roomCode} - {item.roomName}
                      </h4>
                      {item.isExtended && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-700">
                          Đã gia hạn
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Người thuê: <strong className="text-slate-200">{item.payerName}</strong> ({item.phone})
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Còn thiếu:</span>
                    <span className="font-black text-amber-400 text-base">
                      {item.formattedAmount}
                    </span>
                  </div>
                </div>

                {/* Message preview snippet */}
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 leading-relaxed italic">
                  "{generateMessage(item)}"
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyMessage(item, 'zalo')}
                      className="py-1.5 px-3 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedId === `${item.invoiceId}-zalo` ? 'Đã sao chép!' : 'Chép gửi Zalo'}</span>
                    </button>
                    <button
                      onClick={() => handleCopyMessage(item, 'sms')}
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{copiedId === `${item.invoiceId}-sms` ? 'Đã sao chép!' : 'Chép SMS'}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setExtensionModalItem(item)}
                    className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Hẹn ngày trả / Gia hạn</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Extension Dialog if active */}
        {extensionModalItem && (
          <div className="p-4 bg-slate-800 border-t border-slate-700 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Gia hạn thanh toán cho {extensionModalItem.roomName}</span>
              </h4>
              <button
                onClick={() => setExtensionModalItem(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Hủy
              </button>
            </div>
            <form onSubmit={handleSaveExtension} className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Gia hạn đến ngày:</label>
                <input
                  type="date"
                  value={extendDate}
                  onChange={(e) => setExtendDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Lý do gia hạn:</label>
                <input
                  type="text"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="Khách hẹn ngày nhận lương..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
              <div className="sm:col-span-2 pt-1 flex justify-end">
                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
                >
                  Xác Nhận Gia Hạn
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
