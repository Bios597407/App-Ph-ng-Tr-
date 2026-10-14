import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { formatVND, formatDateVN, exportCsvFile } from '../utils/formatters.ts';
import {
  BarChart3,
  Download,
  Calendar,
  Printer,
  TrendingUp,
  DollarSign,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface ReportsViewProps {
  currentPeriod: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ currentPeriod }) => {
  const [period, setPeriod] = useState<string>(currentPeriod);
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadReport();
  }, [period]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await api.getReports(period);
      setReportData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!reportData) return;
    const headers = [
      'Mã phòng',
      'Tên phòng',
      'Trạng thái',
      'Phát sinh kỳ này (VND)',
      'Nợ cũ (VND)',
      'Đã thanh toán (VND)',
      'Còn thiếu (VND)',
      'Tình trạng thanh toán',
    ];
    const rows = reportData.roomBreakdown.map((r: any) => [
      r.roomCode,
      r.roomName,
      r.status === 'rented' ? 'Đang thuê' : 'Trống',
      r.currentCycleTotal,
      r.previousDebt,
      r.paidAmount,
      r.remainingBalance,
      r.paymentStatus === 'paid' ? 'Đã thu đủ' : r.paymentStatus === 'partial' ? 'Thu một phần' : 'Chưa thu',
    ]);
    exportCsvFile(`Bao_cao_thu_tien_phong_tro_${period}`, headers, rows);
  };

  const s = reportData?.summary;

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header & Period Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-850 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">Báo Cáo Tài Chính & Công Nợ</h2>
            <p className="text-xs text-slate-400">Đối chiếu doanh thu phát sinh và tiền thực nhận</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none"
            />
          </div>
          <button
            onClick={handleExportCsv}
            disabled={!reportData}
            className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel/CSV</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Đang tổng hợp báo cáo số liệu...</div>
      ) : reportData ? (
        <>
          {/* Summary KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. Phát sinh phải thu */}
            <div className="bg-slate-850 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-slate-400 text-xs block">Phát sinh phải thu kỳ này:</span>
              <div className="text-lg sm:text-xl font-black text-white mt-1">
                {formatVND(s.totalBilled)}
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">Tiền phòng + điện nước phát sinh</span>
            </div>

            {/* 2. Tiền thực nhận */}
            <div className="bg-slate-850 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-emerald-400 text-xs font-semibold block">Tiền thực nhận trong kỳ:</span>
              <div className="text-lg sm:text-xl font-black text-emerald-400 mt-1">
                {formatVND(s.totalCashCollected)}
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">Tiền mặt & chuyển khoản đã vào</span>
            </div>

            {/* 3. Còn thiếu phải thu */}
            <div className="bg-slate-850 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-amber-400 text-xs font-semibold block">Còn nợ phải thu:</span>
              <div className="text-lg sm:text-xl font-black text-amber-400 mt-1">
                {formatVND(s.totalRemainingDebt)}
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">Bao gồm nợ cũ mang sang</span>
            </div>

            {/* 4. Dòng tiền ròng */}
            <div className="bg-slate-850 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-cyan-400 text-xs font-semibold block">Dòng tiền ròng thực thu:</span>
              <div className="text-lg sm:text-xl font-black text-cyan-400 mt-1">
                {formatVND(s.netCashFlow)}
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                (Thực nhận trừ chi phí {formatVND(s.totalExpenses)})
              </span>
            </div>
          </div>

          {/* Secondary stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Nợ cũ mang sang:</span>
              <strong className="text-white">{formatVND(s.totalDebtBroughtForward)}</strong>
            </div>
            <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Tiền cọc đang giữ:</span>
              <strong className="text-emerald-400">{formatVND(s.totalDepositsHeld)}</strong>
            </div>
            <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Chi phí vận hành:</span>
              <strong className="text-rose-400">-{formatVND(s.totalExpenses)}</strong>
            </div>
          </div>

          {/* Room Breakdown Table */}
          <div className="bg-slate-850 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-sm text-white">Bảng Chi Tiết Thu Tiền 9 Phòng</h3>
              <span className="text-xs text-slate-400">Kỳ {period}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3.5">Phòng</th>
                    <th className="py-3 px-3.5">Trạng thái</th>
                    <th className="py-3 px-3.5 text-right">Phát sinh kỳ</th>
                    <th className="py-3 px-3.5 text-right">Nợ cũ</th>
                    <th className="py-3 px-3.5 text-right text-emerald-400">Đã thu</th>
                    <th className="py-3 px-3.5 text-right text-amber-400">Còn thiếu</th>
                    <th className="py-3 px-3.5 text-center">Tình trạng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {reportData.roomBreakdown.map((r: any) => (
                    <tr key={r.roomId} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-white">
                        {r.roomCode} - {r.roomName}
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            r.status === 'rented'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {r.status === 'rented' ? 'Đang thuê' : 'Trống'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right font-medium">{formatVND(r.currentCycleTotal)}</td>
                      <td className="py-3 px-3.5 text-right font-medium text-amber-300/80">
                        {r.previousDebt > 0 ? formatVND(r.previousDebt) : '--'}
                      </td>
                      <td className="py-3 px-3.5 text-right font-bold text-emerald-400">
                        {formatVND(r.paidAmount)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-bold text-amber-400">
                        {formatVND(r.remainingBalance)}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.paymentStatus === 'paid'
                              ? 'bg-emerald-950 text-emerald-300'
                              : r.paymentStatus === 'partial'
                              ? 'bg-amber-950 text-amber-300'
                              : r.status === 'vacant'
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-rose-950 text-rose-300'
                          }`}
                        >
                          {r.paymentStatus === 'paid'
                            ? 'Đã thu đủ'
                            : r.paymentStatus === 'partial'
                            ? 'Thu 1 phần'
                            : r.status === 'vacant'
                            ? 'Trống'
                            : 'Chưa thu'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
