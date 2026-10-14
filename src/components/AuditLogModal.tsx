import React, { useState, useEffect } from 'react';
import { AuditLogItem } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatDateVN } from '../utils/formatters.ts';
import { History, X, Search, User, ShieldCheck } from 'lucide-react';

interface AuditLogModalProps {
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.description.toLowerCase().includes(search.toLowerCase()) ||
      l.actorName.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 flex items-center justify-between border-b border-slate-750">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg leading-tight">Nhật Ký Thao Tác Hệ Thống</h2>
              <p className="text-xs text-slate-400">Lưu vết minh bạch mọi chỉnh sửa số liệu, chốt thu và phân bổ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 bg-slate-850 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm hành động, người thực hiện..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Logs List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2 text-xs">
          {loading ? (
            <p className="text-center py-8 text-slate-400">Đang tải nhật ký...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-center py-8 text-slate-500 italic">Không tìm thấy bản ghi nhật ký phù hợp.</p>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-850 border border-slate-800 space-y-1.5 cursor-pointer hover:border-slate-700 transition-colors"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                      {log.action}
                    </span>
                    <span className="font-semibold text-white">{log.actorName}</span>
                    <span className="text-[11px] text-slate-400">({log.role})</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{formatDateVN(log.timestamp, true)}</span>
                </div>

                <p className="text-slate-300">{log.description}</p>

                {expandedId === log.id && (log.beforeSnapshot || log.afterSnapshot) && (
                  <div className="mt-2 pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                    {log.beforeSnapshot && (
                      <div className="bg-slate-900 p-2 rounded border border-slate-800 text-amber-300 overflow-x-auto">
                        <span className="font-bold text-slate-400 block mb-1">Dữ liệu trước thay đổi:</span>
                        <pre>{JSON.stringify(log.beforeSnapshot, null, 2)}</pre>
                      </div>
                    )}
                    {log.afterSnapshot && (
                      <div className="bg-slate-900 p-2 rounded border border-slate-800 text-emerald-300 overflow-x-auto">
                        <span className="font-bold text-slate-400 block mb-1">Dữ liệu sau thay đổi:</span>
                        <pre>{JSON.stringify(log.afterSnapshot, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
