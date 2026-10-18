import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { formatDateVN } from '../utils/formatters.ts';
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  FileJson,
  Calculator,
} from 'lucide-react';

interface BackupRestoreModalProps {
  onClose: () => void;
  onRefresh: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ onClose, onRefresh }) => {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const list = await api.listBackups();
      setBackups(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDebts = async () => {
    const period = '2026-10';
    if (!confirm("Xóa toàn bộ số dư nợ cũ mang sang của tất cả 9 phòng về 0.")) {
      return;
    }

    setResetting(true);
    setStatusMsg(null);
    try {
      // Small delay to show loading state to user
      await new Promise(resolve => setTimeout(resolve, 800));
      const res = await api.resetAllDebts(period);
      setStatusMsg({ 
        type: 'success', 
        text: `Đã reset thành công nợ cũ của ${res.count} hóa đơn kỳ ${period} về 0.` 
      });
      onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Lỗi khi reset nợ.' });
    } finally {
      setResetting(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `troxanh_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Lỗi khi tải tệp sao lưu.' });
    }
  };

  const handleTriggerBackupNow = async () => {
    setTriggering(true);
    try {
      await api.triggerBackup();
      setStatusMsg({ type: 'success', text: 'Đã tạo bản sao lưu an toàn mới trên máy chủ!' });
      loadBackups();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Lỗi khi sao lưu.' });
    } finally {
      setTriggering(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.rooms || !parsed.profile) {
          throw new Error('Tệp không đúng định dạng cơ sở dữ liệu TroXanh 9P.');
        }

        if (confirm(`Bạn có chắc chắn muốn phục hồi toàn bộ dữ liệu từ tệp "${file.name}"? Dữ liệu hiện tại sẽ được thay thế!`)) {
          setRestoring(true);
          const res = await api.restoreBackup(parsed);
          setStatusMsg({
            type: 'success',
            text: `Phục hồi thành công! Đã nạp ${res.metrics.roomCount} phòng, ${res.metrics.invoiceCount} hóa đơn.`,
          });
          onRefresh();
        }
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: err.message || 'Lỗi đọc tệp sao lưu.' });
      } finally {
        setRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-slate-900 px-5 py-4 flex items-center justify-between border-b border-teal-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg leading-tight">Sao Lưu & Phục Hồi Dữ Liệu</h2>
              <p className="text-xs text-teal-200">Đảm bảo an toàn tuyệt đối cho số liệu 9 phòng trọ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {statusMsg && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                  : 'bg-rose-950/70 border-rose-700 text-rose-300'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* ADMINISTRATIVE FEATURES */}
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              <h4 className="font-bold text-amber-200 text-sm">Tính năng Quản trị Đặc biệt</h4>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong>Reset Nợ kỳ cũ (T10/2026):</strong> Xóa toàn bộ số dư nợ cũ mang sang của tất cả 9 phòng về 0. Thường dùng khi bắt đầu chu kỳ quản lý mới.
              </p>
              <button
                onClick={handleResetDebts}
                disabled={resetting}
                className={`shrink-0 py-2 px-4 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                  resetting 
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20'
                }`}
              >
                {resetting ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Thực hiện Reset</span>
              </button>
            </div>
          </div>

          {/* Action Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Export & Backup */}
            <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2.5 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Xuất Tệp Sao Lưu</span>
                </h4>
                <p className="text-slate-400 text-[11px] mt-1">
                  Tải về máy tệp JSON chứa toàn bộ hợp đồng, số điện nước, hóa đơn và phiếu thu.
                </p>
              </div>
              <div className="space-y-1.5 pt-2">
                <button
                  onClick={handleDownloadBackup}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 font-bold text-white text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải tệp .JSON về máy</span>
                </button>
                <button
                  onClick={handleTriggerBackupNow}
                  disabled={triggering}
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 font-semibold text-slate-300 text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
                  <span>Tạo bản sao lưu trên server</span>
                </button>
              </div>
            </div>

            {/* Restore */}
            <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2.5 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-teal-400" />
                  <span>Phục Hồi Dữ Liệu</span>
                </h4>
                <p className="text-slate-400 text-[11px] mt-1">
                  Tải tệp JSON từ máy tính/điện thoại để khôi phục trạng thái khu trọ khi đổi máy.
                </p>
              </div>
              <div className="pt-2">
                <label className="w-full py-2 px-3 rounded-lg bg-teal-700 hover:bg-teal-600 cursor-pointer font-bold text-white text-xs flex items-center justify-center gap-1.5 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{restoring ? 'Đang phục hồi...' : 'Chọn tệp sao lưu (.json)'}</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={restoring}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Automatic Backups List */}
          <div className="space-y-2 pt-2">
            <h4 className="font-bold text-slate-300">Các bản sao lưu tự động xoay vòng trên máy chủ:</h4>
            {loading ? (
              <p className="text-slate-500 italic">Đang tải danh sách sao lưu...</p>
            ) : backups.length === 0 ? (
              <p className="text-slate-500 italic">Chưa có bản sao lưu nào.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {backups.map((b) => (
                  <div
                    key={b.filename}
                    className="p-2.5 rounded-lg bg-slate-850 border border-slate-800 flex justify-between items-center text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="font-mono text-slate-200 block">{b.filename}</span>
                        <span className="text-slate-400">{formatDateVN(b.createdAt, true)}</span>
                      </div>
                    </div>
                    <span className="text-slate-400 font-mono">{(b.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
