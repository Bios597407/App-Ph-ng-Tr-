import React, { useState, useEffect } from 'react';
import { Room, Invoice, MeterReading } from '../types/index.ts';
import { formatVND } from '../utils/formatters.ts';
import { api } from '../services/api.ts';
import {
  User,
  Zap,
  Droplet,
  Banknote,
  CheckCircle2,
  Phone,
  MessageCircle,
  AlertCircle,
  Check,
  RotateCcw,
  Copy,
} from 'lucide-react';

interface RoomCardProps {
  room: Room;
  currentInvoice?: Invoice | null;
  meterReading?: MeterReading | null;
  tenantName?: string;
  tenantPhone?: string;
  currentStayId?: string;
  currentPeriod: string;
  onCollect: (roomId: string) => void;
  onViewDetails: (room: Room) => void;
  onOpenZalo?: (roomId: string) => void;
  onRefresh?: () => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  currentInvoice,
  meterReading,
  tenantName = '',
  tenantPhone = '',
  currentPeriod,
  onCollect,
  onViewDetails,
  onOpenZalo,
  onRefresh,
}) => {
  const isRented = room.status === 'rented';
  const remaining = currentInvoice ? currentInvoice.remainingBalance : 0;
  const isPaid = isRented && currentInvoice && remaining <= 0;

  // Meter Initial Values
  const defaultEStart =
    meterReading?.electricStart ?? Math.max(0, (room.currentMeter?.electricNumber ?? 1200) - 80);
  const defaultEEnd = meterReading?.electricEnd ?? (room.currentMeter?.electricNumber ?? 1280);

  const defaultWStart =
    meterReading?.waterStart ?? Math.max(0, (room.currentMeter?.waterNumber ?? 340) - 10);
  const defaultWEnd = meterReading?.waterEnd ?? (room.currentMeter?.waterNumber ?? 350);

  // Local Editable States
  const [elecEndInput, setElecEndInput] = useState<string>(defaultEEnd.toString());
  const [waterEndInput, setWaterEndInput] = useState<string>(defaultWEnd.toString());

  // Other Fees / Adjustment State (Wifi, Garbage, Previous Debt...)
  const initialOtherFees = currentInvoice
    ? currentInvoice.items
        .filter((it) => ['garbage', 'internet', 'other', 'debt_adjustment'].includes(it.type))
        .reduce((sum, it) => sum + it.amount, 0)
    : 80000;

  const [otherFeesInput, setOtherFeesInput] = useState<string>(initialOtherFees.toString());

  const activeRate = room.priceHistory && room.priceHistory.length > 0 ? room.priceHistory[0] : null;
  const initialERate = meterReading?.electricRate ?? (activeRate?.electricityRate ?? 3500);
  const initialWRate = meterReading?.waterRate ?? (activeRate?.waterRate ?? 20000);

  const [eRateInput, setERateInput] = useState<string>(initialERate.toString());
  const [wRateInput, setWRateInput] = useState<string>(initialWRate.toString());

  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [copiedPhoneToast, setCopiedPhoneToast] = useState<boolean>(false);

  useEffect(() => {
    setElecEndInput(defaultEEnd.toString());
    setWaterEndInput(defaultWEnd.toString());
  }, [defaultEEnd, defaultWEnd]);

  // Meter & Rate Math
  const numEStart = defaultEStart;
  const numEEnd = parseInt(elecEndInput.replace(/\D/g, ''), 10) || 0;
  const isElectricInvalid = numEEnd < numEStart;
  const eUsage = isElectricInvalid ? 0 : numEEnd - numEStart;

  const rawERate = parseInt(eRateInput.replace(/\D/g, ''), 10) || 3500;
  const eRate = rawERate <= 100 ? rawERate * 1000 : rawERate;
  const eTotalCost = eUsage * eRate;

  const numWStart = defaultWStart;
  const numWEnd = parseInt(waterEndInput.replace(/\D/g, ''), 10) || 0;
  const isWaterInvalid = numWEnd < numWStart;
  const wUsage = isWaterInvalid ? 0 : numWEnd - numWStart;

  const rawWRate = parseInt(wRateInput.replace(/\D/g, ''), 10) || 20000;
  const wRate = rawWRate <= 100 ? rawWRate * 1000 : rawWRate;
  const wTotalCost = wUsage * wRate;

  const otherFeesNum = parseInt(otherFeesInput.replace(/\D/g, ''), 10) || 0;

  // Exact Transparent Sum
  const calculatedTotal = room.currentRent + eTotalCost + wTotalCost + otherFeesNum;
  const totalBill = calculatedTotal;

  const handleSaveMeters = async () => {
    if (!isRented) return;

    try {
      await api.recordMeter({
        roomId: room.id,
        period: currentPeriod,
        electricStart: numEStart,
        electricEnd: numEEnd,
        waterStart: numWStart,
        waterEnd: numWEnd,
        electricRate: eRate,
        waterRate: wRate,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error saving meters on card:', err);
    }
  };

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tenantPhone) return;
    navigator.clipboard.writeText(tenantPhone);
    setCopiedPhoneToast(true);
    setTimeout(() => setCopiedPhoneToast(false), 2000);
  };

  // Keyboard navigation logic
  const handleElectricKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleSaveMeters();
      const waterEl = document.querySelector<HTMLInputElement>(
        `[data-room-id="${room.id}"][data-field="water"]`
      );
      if (waterEl) {
        waterEl.focus();
        waterEl.select();
      }
    }
  };

  const handleWaterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveMeters();
      // Move focus to next room's electric input
      const allElectricInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('[data-field="electric"]')
      );
      const currentIndex = allElectricInputs.findIndex(
        (el) => el.getAttribute('data-room-id') === room.id
      );
      if (currentIndex !== -1 && currentIndex + 1 < allElectricInputs.length) {
        const nextInput = allElectricInputs[currentIndex + 1];
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  const DEFAULT_TENANT_NAMES: Record<string, string> = {
    P01: 'Lê Văn An',
    P02: 'Phạm Thị Bích',
    P03: 'Hoàng Văn Cường',
    P04: 'Đỗ Thị Dung',
    P05: 'Vũ Tuấn Em',
    P06: 'Ngô Thị Phương',
    P07: 'Bùi Văn Giáp',
    P08: 'Đặng Hải Hà',
  };

  let displayTenantName = tenantName;
  if (!displayTenantName || displayTenantName.includes('Người Thuê')) {
    displayTenantName = DEFAULT_TENANT_NAMES[room.code] || tenantName || 'Khách thuê';
  }

  return (
    <div
      onClick={() => onViewDetails(room)}
      className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between relative overflow-hidden group cursor-pointer"
    >
      {/* Top Accent Line */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 transition-colors ${
          !isRented ? 'bg-slate-300' : isPaid ? 'bg-emerald-500' : 'bg-amber-500'
        }`}
      />

      <div className="space-y-3 pt-1">
        {/* ROOM HEADER */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-base tracking-wider shrink-0 shadow-xs">
              {room.code}
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                {room.name}
              </h3>
              <div className="text-sm font-bold text-slate-600 flex items-center gap-1">
                <span className="tabular-nums text-slate-900">{formatVND(room.currentRent)}</span>
                <span className="text-slate-400 font-medium">/tháng</span>
              </div>
            </div>
          </div>

          <div>
            {isRented ? (
              isPaid ? (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>✅ Đã thu</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Chưa thu</span>
                </span>
              )
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Phòng trống
              </span>
            )}
          </div>
        </div>

        {/* TENANT INFO ROW */}
        {isRented ? (
          <div className="bg-slate-50/90 rounded-xl px-3.5 py-2 border border-slate-200 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <User className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="font-extrabold text-slate-900 truncate" title={displayTenantName}>
                {displayTenantName}
              </span>
              {tenantPhone && (
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="text-slate-600 hover:text-indigo-600 font-mono font-bold tabular-nums shrink-0 flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs"
                  title="Bấm để sao chép SĐT"
                >
                  <span>{tenantPhone}</span>
                  <Copy className="w-3 h-3 text-slate-400" />
                </button>
              )}
              {copiedPhoneToast && (
                <span className="text-[11px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full animate-in fade-in duration-150">
                  Đã sao chép SĐT!
                </span>
              )}
            </div>
            {tenantPhone && (
              <a
                href={`tel:${tenantPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors shrink-0 shadow-2xs ml-1"
                title="Gọi điện trực tiếp"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl px-3 py-2 border border-dashed border-slate-200 text-center text-slate-400 text-xs font-semibold">
            Chưa có khách thuê
          </div>
        )}

        {/* DIRECT METER EDITING SECTION */}
        {isRented && (
          <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm" onClick={(e) => e.stopPropagation()}>
            {/* Electricity Box */}
            <div
              className={`rounded-xl p-2.5 border space-y-1.5 transition-colors ${
                isElectricInvalid
                  ? 'bg-rose-50/80 border-rose-300'
                  : 'bg-amber-50/60 border-amber-200/80'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-black text-amber-950 flex items-center gap-1 text-xs whitespace-nowrap shrink-0">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                  <span className="whitespace-nowrap">Điện ({Math.round(eRate / 1000)}k)</span>
                </span>
                <span className="font-mono font-extrabold text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded text-xs tabular-nums whitespace-nowrap shrink-0">
                  {eUsage} kWh
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700 font-mono text-xs">
                <span className="text-slate-400 font-bold">{numEStart} ➔</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  data-room-id={room.id}
                  data-field="electric"
                  value={elecEndInput}
                  onChange={(e) => setElecEndInput(e.target.value)}
                  onBlur={handleSaveMeters}
                  onKeyDown={handleElectricKeyDown}
                  onFocus={(e) => e.target.select()}
                  className={`w-20 px-2 py-1.5 bg-white border rounded-lg text-right font-black focus:outline-none text-xs sm:text-sm min-h-[44px] ${
                    isElectricInvalid
                      ? 'border-rose-500 text-rose-950 focus:ring-2 focus:ring-rose-500'
                      : 'border-amber-300 text-slate-900 focus:ring-1 focus:ring-amber-500'
                  }`}
                  placeholder="Số mới"
                />
              </div>
              {isElectricInvalid ? (
                <p className="text-[11px] font-bold text-rose-600 text-right">
                  ⚠️ Số mới thấp hơn số cũ!
                </p>
              ) : (
                <div className="text-xs text-amber-950 font-black text-right tabular-nums">
                  {formatVND(eTotalCost)}
                </div>
              )}
            </div>

            {/* Water Box */}
            <div
              className={`rounded-xl p-2.5 border space-y-1.5 transition-colors ${
                isWaterInvalid
                  ? 'bg-rose-50/80 border-rose-300'
                  : 'bg-sky-50/60 border-sky-200/80'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-black text-sky-950 flex items-center gap-1 text-xs whitespace-nowrap shrink-0">
                  <Droplet className="w-4 h-4 text-sky-500 fill-sky-500 shrink-0" />
                  <span className="whitespace-nowrap">Nước ({Math.round(wRate / 1000)}k)</span>
                </span>
                <span className="font-mono font-extrabold text-sky-900 bg-sky-100/90 px-1.5 py-0.5 rounded text-xs tabular-nums whitespace-nowrap shrink-0">
                  {wUsage} m³
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700 font-mono text-xs">
                <span className="text-slate-400 font-bold">{numWStart} ➔</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  data-room-id={room.id}
                  data-field="water"
                  value={waterEndInput}
                  onChange={(e) => setWaterEndInput(e.target.value)}
                  onBlur={handleSaveMeters}
                  onKeyDown={handleWaterKeyDown}
                  onFocus={(e) => e.target.select()}
                  className={`w-20 px-2 py-1.5 bg-white border rounded-lg text-right font-black focus:outline-none text-xs sm:text-sm min-h-[44px] ${
                    isWaterInvalid
                      ? 'border-rose-500 text-rose-950 focus:ring-2 focus:ring-rose-500'
                      : 'border-sky-300 text-slate-900 focus:ring-1 focus:ring-sky-500'
                  }`}
                  placeholder="Số mới"
                />
              </div>
              {isWaterInvalid ? (
                <p className="text-[11px] font-bold text-rose-600 text-right">
                  ⚠️ Số mới thấp hơn số cũ!
                </p>
              ) : (
                <div className="text-xs text-sky-950 font-black text-right tabular-nums">
                  {formatVND(wTotalCost)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MATH TRANSPARENCY: SERVICE FEES / ADJUSTMENTS ROW */}
        {isRented && (
          <div
            className="bg-slate-50/80 p-2 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-slate-600 font-bold flex items-center gap-1 truncate">
              <span>Phí dịch vụ / Điều chỉnh (Rác, Wifi...):</span>
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-slate-400 font-bold">+</span>
              <input
                type="text"
                inputMode="numeric"
                value={otherFeesNum > 0 ? otherFeesNum.toLocaleString('vi-VN') : '0'}
                onChange={(e) => setOtherFeesInput(e.target.value.replace(/\D/g, ''))}
                className="w-20 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 text-right text-xs focus:ring-1 focus:ring-indigo-500"
                placeholder="0 đ"
              />
            </div>
          </div>
        )}
      </div>

      {/* FOOTER & ACTIONS */}
      <div className="pt-3 mt-2 border-t border-slate-100 space-y-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-600 font-bold">Tổng tiền kỳ này:</span>
          <div className="flex items-center gap-1.5">
            {saveSuccess && (
              <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-0.5">
                <Check className="w-3.5 h-3.5" /> Đã lưu
              </span>
            )}
            <span className="text-lg sm:text-2xl font-black text-slate-950 tracking-tight tabular-nums">
              {formatVND(totalBill)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
          {isRented && onOpenZalo ? (
            <button
              onClick={() => onOpenZalo(room.id)}
              className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
            >
              <MessageCircle className="w-4 h-4 text-blue-600" />
              <span>Gửi Zalo</span>
            </button>
          ) : (
            <button
              onClick={() => onViewDetails(room)}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs sm:text-sm transition-colors min-h-[44px]"
            >
              <span>Chi tiết</span>
            </button>
          )}

          <button
            onClick={() => onCollect(room.id)}
            disabled={!isRented}
            className={`py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-2xs min-h-[44px] ${
              !isRented
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : isPaid
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 shadow-md'
            }`}
          >
            {isPaid ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Hoàn tác</span>
              </>
            ) : (
              <>
                <Banknote className="w-4 h-4" />
                <span>Thu tiền</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
