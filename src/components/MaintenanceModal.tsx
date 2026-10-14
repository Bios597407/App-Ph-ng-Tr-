import React, { useState } from 'react';
import { MaintenanceTicket, Room, User } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVND, formatDateVN } from '../utils/formatters.ts';
import {
  Wrench,
  Plus,
  CheckCircle2,
  Clock,
  X,
  AlertCircle,
  DollarSign,
} from 'lucide-react';

interface MaintenanceModalProps {
  currentUser: User;
  rooms: Room[];
  tickets: MaintenanceTicket[];
  onClose: () => void;
  onRefresh: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  currentUser,
  rooms,
  tickets,
  onClose,
  onRefresh,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(currentUser.roomId || rooms[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Resolving state for landlord
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [cost, setCost] = useState('');
  const [savingResolution, setSavingResolution] = useState(false);

  const isLandlord = currentUser.role === 'landlord';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setCreating(true);
    try {
      await api.createMaintenance({
        roomId: selectedRoomId,
        title: title.trim(),
        description: description.trim(),
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gửi yêu cầu bảo trì.');
    } finally {
      setCreating(false);
    }
  };

  const handleResolve = async (ticketId: string, status: 'resolved' | 'in_progress' | 'rejected') => {
    setSavingResolution(true);
    try {
      await api.updateMaintenance(ticketId, {
        status,
        resolutionNote: resolutionNote.trim() || undefined,
        cost: cost ? parseInt(cost.replace(/\D/g, ''), 10) : undefined,
        handler: currentUser.fullName,
      });
      setResolvingId(null);
      setCost('');
      setResolutionNote('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật trạng thái.');
    } finally {
      setSavingResolution(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 px-5 py-4 flex items-center justify-between border-b border-amber-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg leading-tight">Yêu Cầu Sửa Chữa & Bảo Trì</h2>
              <p className="text-xs text-amber-200">Tiếp nhận báo hỏng vòi sen, bóng đèn, quạt trần, điện nước</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Bar */}
        <div className="bg-slate-850 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs text-slate-400">
            Có <strong>{tickets.length}</strong> sự cố ghi nhận
          </span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreate ? 'Đóng form' : 'Báo sự cố mới'}</span>
          </button>
        </div>

        {/* New Ticket Form */}
        {showCreate && (
          <form onSubmit={handleCreate} className="p-4 bg-slate-850/80 border-b border-slate-800 space-y-3 text-xs">
            <h4 className="font-bold text-emerald-400">Tạo báo cáo sự cố hư hỏng</h4>
            {isLandlord && (
              <div>
                <label className="block text-slate-400 mb-1">Chọn phòng:</label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-slate-400 mb-1">Tiêu đề ngắn gọn:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Vòi sen rỉ nước, Cháy bóng đèn bếp..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Mô tả chi tiết vị trí và tình trạng:</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả cụ thể để chủ trọ chuẩn bị vật tư sửa chữa..."
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
                disabled={creating}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
              >
                {creating ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </form>
        )}

        {/* Tickets List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {tickets.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-500 italic">Không có sự cố nào cần xử lý.</p>
          ) : (
            tickets.map((t) => {
              const room = rooms.find((r) => r.id === t.roomId);
              return (
                <div key={t.id} className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{t.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'resolved'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : t.status === 'in_progress'
                              ? 'bg-amber-950 text-amber-300 border border-amber-700'
                              : 'bg-rose-950 text-rose-300 border border-rose-700'
                          }`}
                        >
                          {t.status === 'resolved'
                            ? 'Đã sửa xong'
                            : t.status === 'in_progress'
                            ? 'Đang xử lý'
                            : 'Chờ tiếp nhận'}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Phòng: <strong className="text-slate-200">{room ? room.name : t.roomId}</strong> • Người báo: {t.tenantName} ({formatDateVN(t.createdAt, true)})
                      </p>
                    </div>
                  </div>

                  <p className="text-slate-300 bg-slate-900 p-2 rounded-lg border border-slate-800/80">
                    {t.description}
                  </p>

                  {t.resolutionNote && (
                    <div className="text-[11px] text-teal-300 bg-teal-950/40 p-2 rounded-lg border border-teal-800/40">
                      <strong>Kết quả xử lý:</strong> {t.resolutionNote}
                      {t.cost && <span> • Chi phí: {formatVND(t.cost)}</span>}
                    </div>
                  )}

                  {/* Landlord Action Bar */}
                  {isLandlord && t.status !== 'resolved' && (
                    <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      {resolvingId === t.id ? (
                        <div className="w-full space-y-2 bg-slate-900 p-3 rounded-lg border border-slate-800">
                          <div>
                            <label className="block text-slate-400 text-[11px] mb-1">Ghi chú xử lý / vật tư thay thế:</label>
                            <input
                              type="text"
                              value={resolutionNote}
                              onChange={(e) => setResolutionNote(e.target.value)}
                              placeholder="VD: Đã thay van khóa và vòi mới..."
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 text-[11px] mb-1">Chi phí sửa chữa (tự động đưa vào chi phí khu trọ):</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={cost}
                              onChange={(e) => setCost(e.target.value)}
                              placeholder="0 đ"
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white text-xs"
                            />
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => setResolvingId(null)}
                              className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 text-xs"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolve(t.id, 'resolved')}
                              disabled={savingResolution}
                              className="px-3 py-1 rounded bg-emerald-600 text-white font-bold text-xs"
                            >
                              Đã hoàn thành
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResolve(t.id, 'in_progress')}
                            className="py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-750 text-amber-300 font-semibold text-xs"
                          >
                            Đang xử lý
                          </button>
                          <button
                            onClick={() => setResolvingId(t.id)}
                            className="py-1 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                          >
                            Đã sửa xong & Quyết toán
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
