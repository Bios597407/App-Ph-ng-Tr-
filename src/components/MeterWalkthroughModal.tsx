import React, { useState } from 'react';
import { Room } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVND } from '../utils/formatters.ts';
import {
  X,
  Zap,
  Droplet,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface MeterWalkthroughModalProps {
  rooms: Room[];
  currentPeriod: string; // YYYY-MM
  onClose: () => void;
  onSuccess: () => void;
}

interface RoomReadingDraft {
  roomId: string;
  roomCode: string;
  roomName: string;
  electricStart: number;
  electricEnd: number;
  electricRate: number;
  waterStart: number;
  waterEnd: number;
  waterRate: number;
  waterBillingType: 'meter' | 'per_person' | 'fixed_room';
  isAnomaly: boolean;
  anomalyReason: string;
  confirmedAnomaly: boolean;
}

export const MeterWalkthroughModal: React.FC<MeterWalkthroughModalProps> = ({
  rooms,
  currentPeriod,
  onClose,
  onSuccess,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize draft state for all 9 rooms
  const [drafts, setDrafts] = useState<RoomReadingDraft[]>(() => {
    return rooms.map((r) => {
      const eStart = r.currentMeter?.electricNumber || 1000;
      const wStart = r.currentMeter?.waterNumber || 100;
      return {
        roomId: r.id,
        roomCode: r.code,
        roomName: r.name,
        electricStart: eStart,
        electricEnd: eStart + 75, // Default realistic consumption for quick entry
        electricRate: 3500,
        waterStart: wStart,
        waterEnd: wStart + 8,
        waterRate: 20000,
        waterBillingType: 'meter',
        isAnomaly: false,
        anomalyReason: '',
        confirmedAnomaly: false,
      };
    });
  });

  const currentDraft = drafts[currentIndex];
  const currentRoom = rooms[currentIndex];

  const updateCurrentDraft = (field: keyof RoomReadingDraft, value: any) => {
    setDrafts((prev) => {
      const updated = [...prev];
      const draft = { ...updated[currentIndex], [field]: value };

      // Check anomalies
      let isAnomaly = false;
      let anomalyReason = '';

      if (draft.electricEnd < draft.electricStart) {
        isAnomaly = true;
        anomalyReason += 'Chỉ số điện mới nhỏ hơn số cũ (thay đồng hồ hoặc số quay vòng). ';
      }
      if (draft.waterEnd < draft.waterStart) {
        isAnomaly = true;
        anomalyReason += 'Chỉ số nước mới nhỏ hơn số cũ. ';
      }
      const eUse = draft.electricEnd >= draft.electricStart ? draft.electricEnd - draft.electricStart : draft.electricEnd;
      const wUse = draft.waterEnd >= draft.waterStart ? draft.waterEnd - draft.waterStart : draft.waterEnd;
      if (eUse > 300) {
        isAnomaly = true;
        anomalyReason += `Lượng điện dùng rất cao (${eUse} kWh). `;
      }
      if (wUse > 30) {
        isAnomaly = true;
        anomalyReason += `Lượng nước dùng rất cao (${wUse} m3). `;
      }

      draft.isAnomaly = isAnomaly;
      draft.anomalyReason = anomalyReason;
      updated[currentIndex] = draft;
      return updated;
    });
  };

  const eUsage =
    currentDraft.electricEnd >= currentDraft.electricStart
      ? currentDraft.electricEnd - currentDraft.electricStart
      : currentDraft.electricEnd;

  const wUsage =
    currentDraft.waterEnd >= currentDraft.waterStart
      ? currentDraft.waterEnd - currentDraft.waterStart
      : currentDraft.waterEnd;

  const handleSaveAll = async () => {
    setSubmitting(true);
    setErrorMsg(null);

    // Validate if any unconfirmed anomaly
    const unconfirmed = drafts.find((d) => d.isAnomaly && !d.confirmedAnomaly);
    if (unconfirmed) {
      setErrorMsg(`Phòng ${unconfirmed.roomCode} có cảnh báo bất thường chưa được xác nhận: "${unconfirmed.anomalyReason}"`);
      setSubmitting(false);
      return;
    }

    try {
      await api.recordMeterBatch(currentPeriod, drafts);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu chỉ số điện nước.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-850 to-teal-850 px-5 py-4 flex items-center justify-between border-b border-emerald-700/50">
          <div>
            <h2 className="font-bold text-base sm:text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-300" />
              <span>Ghi Đồng Hồ Một Vòng</span>
            </h2>
            <p className="text-xs text-emerald-200">
              Kỳ {currentPeriod} - Lần lượt 9 phòng theo thứ tự
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Navigation Stepper Tabs */}
        <div className="bg-slate-850 px-3 py-2 border-b border-slate-800 flex overflow-x-auto gap-1.5 scrollbar-none">
          {drafts.map((d, idx) => (
            <button
              key={d.roomId}
              onClick={() => setCurrentIndex(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1 ${
                currentIndex === idx
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : d.isAnomaly && !d.confirmedAnomaly
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-700'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>{d.roomCode}</span>
              {d.isAnomaly && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current Room Header */}
          <div className="flex items-center justify-between bg-slate-850 p-3 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs text-slate-400">Phòng {currentIndex + 1} / 9:</span>
              <h3 className="text-lg font-black text-emerald-400">
                {currentDraft.roomCode} - {currentDraft.roomName}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Trạng thái phòng:</span>
              <div className="text-xs font-bold text-white">
                {currentRoom?.status === 'rented' ? 'Đang thuê' : 'Phòng trống'}
              </div>
            </div>
          </div>

          {/* Anomaly Banner */}
          {currentDraft.isAnomaly && (
            <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-700/70 text-amber-200 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span className="font-medium">{currentDraft.anomalyReason}</span>
              </div>
              <label className="flex items-center gap-2 pt-1 border-t border-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentDraft.confirmedAnomaly}
                  onChange={(e) => updateCurrentDraft('confirmedAnomaly', e.target.checked)}
                  className="rounded border-amber-600 text-amber-500 focus:ring-0"
                />
                <span className="text-[11px] font-semibold text-amber-300">
                  Tôi đã kiểm tra thực tế và xác nhận chỉ số này là chính xác
                </span>
              </label>
            </div>
          )}

          {/* Electricity Card */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Zap className="w-4 h-4" />
                <span>Chỉ số Điện (kWh)</span>
              </div>
              <span className="text-xs text-slate-400">
                Đơn giá: {formatVND(currentDraft.electricRate)}/kWh
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Số cũ (đầu kỳ):</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={currentDraft.electricStart}
                  onChange={(e) => updateCurrentDraft('electricStart', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300"
                />
              </div>
              <div>
                <label className="text-[11px] text-emerald-400 font-bold block mb-1">Số mới (chốt):</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={currentDraft.electricEnd}
                  onChange={(e) => updateCurrentDraft('electricEnd', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-800 border-2 border-emerald-500/70 rounded-lg px-3 py-2 text-sm font-bold text-emerald-300"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400">Lượng dùng: <strong className="text-white">{eUsage} kWh</strong></span>
              <span className="font-bold text-amber-400">
                Thành tiền: {formatVND(eUsage * currentDraft.electricRate)}
              </span>
            </div>
          </div>

          {/* Water Card */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Droplet className="w-4 h-4" />
                <span>Chỉ số Nước (m3)</span>
              </div>
              <span className="text-xs text-slate-400">
                Đơn giá: {formatVND(currentDraft.waterRate)}/m3
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Số cũ (đầu kỳ):</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={currentDraft.waterStart}
                  onChange={(e) => updateCurrentDraft('waterStart', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300"
                />
              </div>
              <div>
                <label className="text-[11px] text-cyan-400 font-bold block mb-1">Số mới (chốt):</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={currentDraft.waterEnd}
                  onChange={(e) => updateCurrentDraft('waterEnd', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-800 border-2 border-cyan-500/70 rounded-lg px-3 py-2 text-sm font-bold text-cyan-300"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400">Lượng dùng: <strong className="text-white">{wUsage} m3</strong></span>
              <span className="font-bold text-cyan-400">
                Thành tiền: {formatVND(wUsage * currentDraft.waterRate)}
              </span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Phòng trước</span>
            </button>

            {currentIndex < drafts.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(drafts.length - 1, prev + 1))}
                className="py-2.5 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <span>Phòng tiếp theo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSaveAll}
                className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-900/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Đang lưu...' : 'Lưu Đủ 9 Phòng'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
