import React, { useState, useEffect } from 'react';
import { Room, Invoice, MeterReading } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVND } from '../utils/formatters.ts';
import {
  X,
  Zap,
  Droplet,
  Home,
  Calculator,
  Save,
  Check,
  Phone,
  MessageCircle,
  Banknote,
  AlertTriangle,
  Receipt,
  Wifi,
  Trash2,
  PlusCircle,
  ShieldAlert,
  User,
  History,
} from 'lucide-react';

interface BillingAdjustmentModalProps {
  room: Room;
  currentInvoice?: Invoice | null;
  meterReading?: MeterReading | null;
  tenantName?: string;
  tenantPhone?: string;
  currentPeriod: string;
  onClose: () => void;
  onSuccess: () => void;
  onOpenZalo?: (roomId: string) => void;
  onCollect?: (roomId: string) => void;
  onViewHistory?: () => void;
}

export const BillingAdjustmentModal: React.FC<BillingAdjustmentModalProps> = ({
  room,
  currentInvoice,
  meterReading,
  tenantName = '',
  tenantPhone = '',
  currentPeriod,
  onClose,
  onSuccess,
  onOpenZalo,
  onCollect,
  onViewHistory,
}) => {
  // 0. Tenant information state (editable right in dialog)
  const [tenantNameInput, setTenantNameInput] = useState<string>(tenantName || '');
  const [tenantPhoneInput, setTenantPhoneInput] = useState<string>(tenantPhone || '');

  // 1. Rent state
  const initialRent = currentInvoice?.items.find((it) => it.type === 'rent')?.amount ?? room.currentRent;
  const [rentInput, setRentInput] = useState<string>(initialRent.toString());

  // 2. Electricity state (Starts from 5000)
  const defaultEStart = meterReading?.electricStart ?? Math.max(0, (room.currentMeter?.electricNumber ?? 1200) - 80);
  const defaultEEnd = meterReading?.electricEnd ?? (room.currentMeter?.electricNumber ?? 1280);
  const defaultERate = meterReading?.electricRate && meterReading.electricRate !== 3500
    ? meterReading.electricRate
    : (room.priceHistory?.[0]?.electricityRate && room.priceHistory[0].electricityRate !== 3500
        ? room.priceHistory[0].electricityRate
        : 5000);

  const [elecStartInput, setElecStartInput] = useState<string>(defaultEStart.toString());
  const [elecEndInput, setElecEndInput] = useState<string>(defaultEEnd.toString());
  const [elecRateInput, setElecRateInput] = useState<string>(defaultERate.toString());

  // 3. Water state (Starts from 4000)
  const defaultWStart = meterReading?.waterStart ?? Math.max(0, (room.currentMeter?.waterNumber ?? 340) - 10);
  const defaultWEnd = meterReading?.waterEnd ?? (room.currentMeter?.waterNumber ?? 350);
  const defaultWRate = meterReading?.waterRate && meterReading.waterRate !== 20000
    ? meterReading.waterRate
    : (room.priceHistory?.[0]?.waterRate && room.priceHistory[0].waterRate !== 20000
        ? room.priceHistory[0].waterRate
        : 4000);

  const [waterStartInput, setWaterStartInput] = useState<string>(defaultWStart.toString());
  const [waterEndInput, setWaterEndInput] = useState<string>(defaultWEnd.toString());
  const [waterRateInput, setWaterRateInput] = useState<string>(defaultWRate.toString());

  // 4. Service fees state (Garbage, Internet, Other - Starts from 0)
  const initialGarbage = currentInvoice?.items.find((it) => it.type === 'garbage')?.amount ?? 0;
  const initialInternet = currentInvoice?.items.find((it) => it.type === 'internet')?.amount ?? 0;
  const initialOther = currentInvoice?.items
    .filter((it) => ['other', 'debt_adjustment'].includes(it.type))
    .reduce((sum, it) => sum + it.amount, 0) ?? 0;

  const [garbageFeeInput, setGarbageFeeInput] = useState<string>(initialGarbage.toString());
  const [internetFeeInput, setInternetFeeInput] = useState<string>(initialInternet.toString());
  const [otherFeeInput, setOtherFeeInput] = useState<string>(initialOther.toString());

  // Saving states
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Math Calculations
  const rentNum = parseInt(rentInput.replace(/\D/g, ''), 10) || 0;

  const numEStart = parseInt(elecStartInput.replace(/\D/g, ''), 10) || 0;
  const numEEnd = parseInt(elecEndInput.replace(/\D/g, ''), 10) || 0;
  const rawERate = parseInt(elecRateInput.replace(/\D/g, ''), 10) || 5000;
  const eRate = rawERate <= 100 ? rawERate * 1000 : rawERate;
  const isElectricInvalid = elecEndInput.trim() !== '' && numEEnd < numEStart;
  const eUsage = isElectricInvalid ? 0 : Math.max(0, numEEnd - numEStart);
  const eTotalCost = eUsage * eRate;

  const numWStart = parseInt(waterStartInput.replace(/\D/g, ''), 10) || 0;
  const numWEnd = parseInt(waterEndInput.replace(/\D/g, ''), 10) || 0;
  const rawWRate = parseInt(waterRateInput.replace(/\D/g, ''), 10) || 4000;
  const wRate = rawWRate <= 100 ? rawWRate * 1000 : rawWRate;
  const isWaterInvalid = waterEndInput.trim() !== '' && numWEnd < numWStart;
  const wUsage = isWaterInvalid ? 0 : Math.max(0, numWEnd - numWStart);
  const wTotalCost = wUsage * wRate;

  const garbageNum = parseInt(garbageFeeInput.replace(/\D/g, ''), 10) || 0;
  const internetNum = parseInt(internetFeeInput.replace(/\D/g, ''), 10) || 0;
  const otherNum = parseInt(otherFeeInput.replace(/\D/g, ''), 10) || 0;
  const totalServiceFees = garbageNum + internetNum + otherNum;

  // Total Period Bill
  const totalBillCalculated = rentNum + eTotalCost + wTotalCost + totalServiceFees;

  const isRented = room.status === 'rented';
  const isPaid = currentInvoice && currentInvoice.remainingBalance <= 0;

  // Format month label
  const [y, m] = currentPeriod.split('-');
  const periodLabel = `Tháng ${m}/${y}`;

  const handleSave = async () => {
    if (isElectricInvalid) {
      setErrorMessage('Chỉ số Điện mới không được nhỏ hơn số cũ!');
      return;
    }
    if (isWaterInvalid) {
      setErrorMessage('Chỉ số Nước mới không được nhỏ hơn số cũ!');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      await api.updateRoomBilling({
        roomId: room.id,
        periodMonth: currentPeriod,
        roomRent: rentNum,
        electricStart: numEStart,
        electricEnd: numEEnd,
        electricRate: eRate,
        waterStart: numWStart,
        waterEnd: numWEnd,
        waterRate: wRate,
        garbageFee: garbageNum,
        internetFee: internetNum,
        otherFee: otherNum,
        tenantName: tenantNameInput.trim(),
        tenantPhone: tenantPhoneInput.trim(),
      });

      if (room.currentStayId) {
        try {
          await api.updateTenancy(room.currentStayId, {
            representativeName: tenantNameInput.trim(),
            representativePhone: tenantPhoneInput.trim(),
            baseRent: rentNum,
            garbageFee: garbageNum,
            internetFee: internetNum,
          });
        } catch {
          // Handled inside api.updateTenancy
        }
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onSuccess();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Error saving room billing:', err);
      setErrorMessage(err.message || 'Lỗi khi lưu dữ liệu điều chỉnh!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-xs">
              {room.code}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg text-white">
                  {room.name} — Điều Chỉnh Kỳ Thu
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {periodLabel}
                </span>
              </div>
              <div className="text-xs text-slate-300 font-medium flex items-center gap-2 mt-0.5">
                <span>Khách thuê: <strong className="text-white">{tenantNameInput || 'Chưa cập nhật'}</strong></span>
                {tenantPhoneInput && (
                  <span className="font-mono text-slate-400">({tenantPhoneInput})</span>
                )}
                {isPaid ? (
                  <span className="text-emerald-400 font-bold ml-1">● Đã thu tiền</span>
                ) : (
                  <span className="text-amber-400 font-bold ml-1">● Chưa thu</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onViewHistory && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewHistory();
                }}
                className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                title="Mở hộp thoại Chi Tiết & Lịch Sử Hóa Đơn 3 Tab của phòng này"
              >
                <History className="w-4 h-4 text-indigo-200 shrink-0" />
                <span>📜 Xem Tab Lịch Sử Các Tháng</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng hộp thoại"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/60 text-xs sm:text-sm">
          {/* Notification explanation */}
          <div className="bg-indigo-50/80 border border-indigo-200/90 rounded-xl px-3.5 py-2.5 flex items-center gap-2 text-indigo-900 text-xs font-semibold">
            <Calculator className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Tất cả chỉ số Điện, Nước, Phí dịch vụ, Tiền phòng và Thông tin người thuê được điều chỉnh tập trung tại hộp thoại này.
            </span>
          </div>

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-rose-800 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 0. THÔNG TIN NGƯỜI THUÊ & SỐ ĐIỆN THOẠI */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-800 flex items-center gap-1.5 text-xs sm:text-sm">
                <User className="w-4 h-4 text-indigo-600" />
                <span>Thông tin người thuê & Liên hệ:</span>
              </span>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/70">
                Điều chỉnh tại đây
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Họ tên người thuê
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={tenantNameInput}
                    onChange={(e) => setTenantNameInput(e.target.value)}
                    placeholder="Nhập tên người thuê..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-lg font-bold text-slate-900 text-xs sm:text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Số điện thoại người thuê
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={tenantPhoneInput}
                    onChange={(e) => setTenantPhoneInput(e.target.value)}
                    placeholder="09xx xxx xxx"
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-lg font-bold text-slate-900 text-xs sm:text-sm font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* 1. ROOM RENT */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-black text-slate-800 flex items-center gap-1.5 text-xs sm:text-sm">
                <Home className="w-4 h-4 text-indigo-600" />
                <span>1. Tiền phòng (Giá thuê tháng {m}/{y}):</span>
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  value={rentInput}
                  onChange={(e) => setRentInput(e.target.value.replace(/\D/g, ''))}
                  className="w-36 px-3 py-1.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-lg text-right font-black text-slate-900 text-sm font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="0"
                />
                <span className="font-bold text-slate-500">đ</span>
              </div>
            </div>
            {rentNum > 0 && (
              <p className="text-[11px] text-right font-bold text-indigo-700">
                Hiển thị: {formatVND(rentNum)}
              </p>
            )}
          </div>

          {/* 2. ELECTRICITY SECTION */}
          <div
            className={`rounded-xl p-3.5 border space-y-2.5 transition-colors shadow-2xs ${
              isElectricInvalid
                ? 'bg-rose-50/80 border-rose-300'
                : 'bg-amber-50/70 border-amber-200/90'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-black text-amber-950 flex items-center gap-1.5 text-xs sm:text-sm">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                <span>2. Tiền điện ({Math.round(eRate / 1000)}k/kWh)</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-amber-900 font-bold">Đơn giá:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={elecRateInput}
                  onChange={(e) => setElecRateInput(e.target.value.replace(/\D/g, ''))}
                  className="w-24 px-2 py-1 bg-white border border-amber-300 rounded-lg text-right font-black text-slate-900 text-xs font-mono"
                  placeholder="5000"
                />
                <span className="text-xs text-amber-900 font-bold">đ/kWh</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-slate-600 font-bold block mb-1">Số điện CŨ:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={elecStartInput}
                  onChange={(e) => setElecStartInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800 text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <span className="text-xs text-amber-950 font-black block mb-1">
                  Số điện MỚI (chỉ số chốt):
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={elecEndInput}
                  onChange={(e) => setElecEndInput(e.target.value.replace(/\D/g, ''))}
                  className={`w-full px-3 py-1.5 bg-white border rounded-lg font-mono font-black text-amber-950 text-base focus:ring-2 outline-none ${
                    isElectricInvalid
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-amber-400 focus:ring-amber-500 shadow-2xs'
                  }`}
                  placeholder="Nhập số mới"
                />
              </div>
            </div>

            {isElectricInvalid ? (
              <p className="text-xs font-bold text-rose-600 text-right">
                ⚠️ Số mới ({numEEnd}) thấp hơn số cũ ({numEStart})!
              </p>
            ) : (
              <div className="bg-white/80 rounded-lg px-3 py-2 flex items-center justify-between text-xs border border-amber-200">
                <span className="text-amber-900 font-bold">
                  Tiêu thụ: <strong className="font-mono text-sm text-slate-900">{eUsage} kWh</strong>
                </span>
                <span className="font-mono font-black text-amber-950 text-sm tabular-nums">
                  {eUsage} × {eRate.toLocaleString('vi-VN')} đ = {formatVND(eTotalCost)}
                </span>
              </div>
            )}
          </div>

          {/* 3. WATER SECTION */}
          <div
            className={`rounded-xl p-3.5 border space-y-2.5 transition-colors shadow-2xs ${
              isWaterInvalid
                ? 'bg-rose-50/80 border-rose-300'
                : 'bg-sky-50/70 border-sky-200/90'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-black text-sky-950 flex items-center gap-1.5 text-xs sm:text-sm">
                <Droplet className="w-4 h-4 text-sky-500 fill-sky-500 shrink-0" />
                <span className="whitespace-nowrap">3. Tiền nước ({Math.round(wRate / 1000)}k/m³)</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-sky-900 font-bold">Đơn giá:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={waterRateInput}
                  onChange={(e) => setWaterRateInput(e.target.value.replace(/\D/g, ''))}
                  className="w-24 px-2 py-1 bg-white border border-sky-300 rounded-lg text-right font-black text-slate-900 text-xs font-mono"
                  placeholder="4000"
                />
                <span className="text-xs text-sky-900 font-bold">đ/m³</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-slate-600 font-bold block mb-1">Số nước CŨ:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={waterStartInput}
                  onChange={(e) => setWaterStartInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800 text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <span className="text-xs text-sky-950 font-black block mb-1">
                  Số nước MỚI (chỉ số chốt):
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={waterEndInput}
                  onChange={(e) => setWaterEndInput(e.target.value.replace(/\D/g, ''))}
                  className={`w-full px-3 py-1.5 bg-white border rounded-lg font-mono font-black text-sky-950 text-base focus:ring-2 outline-none ${
                    isWaterInvalid
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-sky-400 focus:ring-sky-500 shadow-2xs'
                  }`}
                  placeholder="Nhập số mới"
                />
              </div>
            </div>

            {isWaterInvalid ? (
              <p className="text-xs font-bold text-rose-600 text-right">
                ⚠️ Số mới ({numWEnd}) thấp hơn số cũ ({numWStart})!
              </p>
            ) : (
              <div className="bg-white/80 rounded-lg px-3 py-2 flex items-center justify-between text-xs border border-sky-200">
                <span className="text-sky-900 font-bold whitespace-nowrap">
                  Tiêu thụ: <strong className="font-mono text-sm text-slate-900 whitespace-nowrap">{wUsage} m³</strong>
                </span>
                <span className="font-mono font-black text-sky-950 text-sm tabular-nums whitespace-nowrap">
                  {wUsage} × {wRate.toLocaleString('vi-VN')} đ = {formatVND(wTotalCost)}
                </span>
              </div>
            )}
          </div>

          {/* 4. SERVICE FEES & EXTRAS */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <span>4. Phí Dịch Vụ & Phụ Phí:</span>
              </span>
              <span className="font-mono font-black text-indigo-700 text-xs sm:text-sm">
                Tổng DV: {formatVND(totalServiceFees)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1">
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Rác sinh hoạt:</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={garbageFeeInput}
                  onChange={(e) => setGarbageFeeInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-right text-xs focus:ring-1 focus:ring-indigo-500"
                  placeholder="0"
                />
                <p className="text-[10px] text-right text-slate-500 font-semibold mt-0.5">
                  {formatVND(garbageNum)}
                </p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1">
                  <Wifi className="w-3.5 h-3.5 text-slate-400" />
                  <span>Wifi Internet:</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={internetFeeInput}
                  onChange={(e) => setInternetFeeInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-right text-xs focus:ring-1 focus:ring-indigo-500"
                  placeholder="0"
                />
                <p className="text-[10px] text-right text-slate-500 font-semibold mt-0.5">
                  {formatVND(internetNum)}
                </p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1">
                  <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Phí khác / Nợ cũ:</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otherFeeInput}
                  onChange={(e) => setOtherFeeInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-right text-xs focus:ring-1 focus:ring-indigo-500"
                  placeholder="0"
                />
                <p className="text-[10px] text-right text-slate-500 font-semibold mt-0.5">
                  {formatVND(otherNum)}
                </p>
              </div>
            </div>
          </div>

          {/* 5. SUMMARY CALCULATION BOX */}
          <div className="bg-linear-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-indigo-200 font-extrabold flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span>Tổng số tiền kỳ này ({periodLabel}):</span>
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight tabular-nums">
                {formatVND(totalBillCalculated)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-medium text-slate-300">
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-slate-400 block text-[11px]">Tiền phòng:</span>
                <span className="font-mono font-bold text-white">{formatVND(rentNum)}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-amber-400 block text-[11px]">Tiền điện ({eUsage} kWh):</span>
                <span className="font-mono font-bold text-amber-300">{formatVND(eTotalCost)}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-sky-400 block text-[11px]">Tiền nước ({wUsage} m³):</span>
                <span className="font-mono font-bold text-sky-300">{formatVND(wTotalCost)}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-indigo-300 block text-[11px]">Phí DV & Khác:</span>
                <span className="font-mono font-bold text-white">{formatVND(totalServiceFees)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs transition-colors min-h-[44px] cursor-pointer"
            >
              Hủy bỏ
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isRented && onOpenZalo && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenZalo(room.id);
                }}
                className="py-2.5 px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-extrabold text-xs flex items-center gap-1.5 transition-colors min-h-[44px] cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-blue-600" />
                <span>Gửi Zalo</span>
              </button>
            )}

            {isRented && onCollect && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCollect(room.id);
                }}
                className="py-2.5 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-extrabold text-xs flex items-center gap-1.5 transition-colors min-h-[44px] cursor-pointer"
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Thu tiền</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || isElectricInvalid || isWaterInvalid}
              className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Đã lưu thành công!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Đang lưu...' : 'Lưu & Cập nhật'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
