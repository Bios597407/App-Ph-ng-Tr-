import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Search,
  Filter,
  ShieldCheck,
  X,
  FileText,
  Download,
} from 'lucide-react';

interface TestCaseResult {
  id: number;
  title: string;
  category: string;
  inputData: string;
  action: string;
  expectedResult: string;
  actualResult: string;
  status: 'PASSED' | 'FAILED' | 'NOT_RUN';
  evidence: string;
}

interface AcceptanceTestSuiteModalProps {
  onClose: () => void;
}

export const AcceptanceTestSuiteModal: React.FC<AcceptanceTestSuiteModalProps> = ({ onClose }) => {
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const runTests = async () => {
    setLoading(true);
    try {
      const data = await api.runTestSuite();
      setResults(data.results);
    } catch (err) {
      console.error('Error running test suite:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  const categories = Array.from(new Set(results.map((r) => r.category)));

  const filteredResults = results.filter((r) => {
    const matchesCategory = selectedCategory === 'all' || r.category === selectedCategory;
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.inputData.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.actualResult.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  const failedCount = results.filter((r) => r.status === 'FAILED').length;

  const exportReport = () => {
    const blob = new Blob([JSON.stringify({ date: new Date().toISOString(), results }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao_cao_nghiem_thu_32_ca_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col text-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 px-5 py-4 flex items-center justify-between border-b border-emerald-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight flex items-center gap-2">
                <span>Hệ Thống Nghiệm Thu Bắt Buộc (32 Ca)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/80 border border-emerald-500/60 text-emerald-300 font-mono">
                  MỤC 20 SPEC
                </span>
              </h2>
              <p className="text-xs text-emerald-200">
                Kiểm chứng toàn diện 100% tính đúng đắn nghiệp vụ, giao dịch và quyền hạn
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

        {/* Action & Metric Bar */}
        <div className="bg-slate-850 p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs">
              <span className="text-slate-400">Tổng số ca: </span>
              <strong className="text-white text-sm">{results.length}</strong>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-700/60 text-xs text-emerald-300">
              <span className="text-emerald-400">ĐẠT (Passed): </span>
              <strong className="text-emerald-300 text-sm">{passedCount}</strong>
            </div>
            {failedCount > 0 && (
              <div className="px-3.5 py-1.5 rounded-xl bg-rose-950/70 border border-rose-700/60 text-xs text-rose-300">
                <span className="text-rose-400">LỖI (Failed): </span>
                <strong className="text-rose-300 text-sm">{failedCount}</strong>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportReport}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Xuất JSON</span>
            </button>
            <button
              onClick={runTests}
              disabled={loading}
              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              {loading ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Đang chạy lại...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Chạy Lại Tất Cả</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm ca kiểm thử theo tên, số liệu..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Tất cả nhóm nghiệp vụ ({results.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredResults.map((tc) => {
            const isExpanded = expandedId === tc.id;
            return (
              <div
                key={tc.id}
                className={`rounded-xl border transition-all ${
                  tc.status === 'PASSED'
                    ? 'bg-slate-850/90 border-slate-800 hover:border-slate-700'
                    : 'bg-rose-950/20 border-rose-900/60'
                }`}
              >
                {/* Header row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : tc.id)}
                  className="p-3 sm:p-3.5 flex items-center justify-between cursor-pointer select-none gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-xs font-bold text-slate-300 shrink-0">
                      #{tc.id}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                        {tc.title}
                      </h4>
                      <span className="text-[11px] text-slate-400">{tc.category}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 ${
                        tc.status === 'PASSED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                          : 'bg-rose-950 text-rose-300 border border-rose-700/60'
                      }`}
                    >
                      {tc.status === 'PASSED' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>ĐẠT</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>LỖI</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-800/80 text-xs space-y-2.5 bg-slate-900/60 rounded-b-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                      <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          1. Dữ liệu đầu vào:
                        </span>
                        <p className="text-slate-300">{tc.inputData}</p>
                      </div>
                      <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          2. Thao tác nghiệp vụ:
                        </span>
                        <p className="text-slate-300">{tc.action}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                          3. Kết quả mong đợi:
                        </span>
                        <p className="text-slate-200">{tc.expectedResult}</p>
                      </div>
                      <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block mb-1">
                          4. Kết quả thực tế:
                        </span>
                        <p className="text-cyan-200 font-medium">{tc.actualResult}</p>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400">
                      <span className="text-slate-500 font-bold block mb-0.5">Bằng chứng kỹ thuật (Evidence):</span>
                      <code>{tc.evidence}</code>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-850 border-t border-slate-800 text-center text-xs text-slate-400">
          Toàn bộ 32 ca nghiệm thu được thực thi và chứng thực tự động theo Tiêu chí Mục 20 bản đặc tả.
        </div>
      </div>
    </div>
  );
};
