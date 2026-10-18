import React, { useState, useEffect, useRef } from 'react';
import { Room, HouseProfile, Invoice, MeterReading } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVND } from '../utils/formatters.ts';
import { motion } from 'motion/react';
import {
  MessageSquare,
  Copy,
  CheckCircle2,
  X,
  Zap,
  Droplet,
  Home,
  Calculator,
  Save,
  Sparkles,
  ExternalLink,
  Download,
  FileText,
  Printer,
} from 'lucide-react';

interface ZaloCalculatorModalProps {
  initialRoomId?: string;
  rooms: Room[];
  profile: HouseProfile;
  currentPeriod: string;
  meterReadings: MeterReading[];
  invoices: Invoice[];
  onClose: () => void;
  onSuccess: () => void;
}

export const ZaloCalculatorModal: React.FC<ZaloCalculatorModalProps> = ({
  initialRoomId,
  rooms,
  profile,
  currentPeriod,
  meterReadings,
  invoices,
  onClose,
  onSuccess,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    initialRoomId || rooms[0]?.id || ''
  );

  const receiptRef = useRef<HTMLDivElement>(null);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const existingReading = meterReadings.find(
    (m) => m.roomId === selectedRoomId && m.period === currentPeriod
  );
  const existingInvoice = invoices.find(
    (i) => i.roomId === selectedRoomId && i.periodMonth === currentPeriod
  );

  // Meter readings
  const [electricStart, setElectricStart] = useState<number>(1200);
  const [electricEnd, setElectricEnd] = useState<number>(1280);
  const [waterStart, setWaterStart] = useState<number>(340);
  const [waterEnd, setWaterEnd] = useState<number>(350);

  // Rent & rates (adjustable)
  const [baseRentInput, setBaseRentInput] = useState<string>('1500000');
  const [electricRateInput, setElectricRateInput] = useState<string>('5000');
  const [waterRateInput, setWaterRateInput] = useState<string>('4000');

  const [copied, setCopied] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRoom) {
      const eStart = existingReading ? existingReading.electricStart : (selectedRoom.currentMeter?.electricNumber ?? 1280) - 80;
      const eEnd = existingReading ? existingReading.electricEnd : (selectedRoom.currentMeter?.electricNumber ?? 1280);
      const wStart = existingReading ? existingReading.waterStart : (selectedRoom.currentMeter?.waterNumber ?? 350) - 10;
      const wEnd = existingReading ? existingReading.waterEnd : (selectedRoom.currentMeter?.waterNumber ?? 350);

      setElectricStart(Math.max(0, eStart));
      setElectricEnd(Math.max(eStart, eEnd));
      setWaterStart(Math.max(0, wStart));
      setWaterEnd(Math.max(wStart, wEnd));

      const rent = existingInvoice
        ? existingInvoice.items.find((it) => it.type === 'rent')?.amount || selectedRoom.currentRent
        : selectedRoom.currentRent;
      setBaseRentInput(rent.toString());
    }
  }, [selectedRoomId]);

  // Rate calculations
  const rawE = parseInt(electricRateInput.replace(/\D/g, ''), 10) || 5000;
  const eRate = rawE <= 100 ? rawE * 1000 : rawE;

  const rawW = parseInt(waterRateInput.replace(/\D/g, ''), 10) || 4000;
  const wRate = rawW <= 100 ? rawW * 1000 : rawW;

  const baseRentNum = parseInt(baseRentInput.replace(/\D/g, ''), 10) || 0;

  const electricUsage = electricEnd >= electricStart ? electricEnd - electricStart : electricEnd;
  const electricTotal = electricUsage * eRate;

  const waterUsage = waterEnd >= waterStart ? waterEnd - waterStart : waterEnd;
  const waterTotal = waterUsage * wRate;

  // Service fees
  const garbageFee = profile.garbageDefaultFee || 0;
  const internetFee = profile.internetDefaultFee || 0;
  const otherFee = existingInvoice?.items.find((i) => i.type === 'other')?.amount || 0;
  const totalServiceFees = garbageFee + internetFee + otherFee;

  // Previous debt and paid amounts from existing invoice
  const previousDebt = existingInvoice?.previousDebt || 0;
  const paidAmount = existingInvoice?.paidAmount || 0;

  // Exact calculations
  const currentCycleTotal = baseRentNum + electricTotal + waterTotal + totalServiceFees;
  const totalBill = currentCycleTotal + previousDebt;
  const remainingBalance = Math.max(0, totalBill - paidAmount);

  // Editable Bank Transfer Info
  const [bankName, setBankName] = useState<string>(profile.bankAccount?.bankName || 'MB Bank');
  const [accountNumber, setAccountNumber] = useState<string>(profile.bankAccount?.accountNumber || '0908123456');
  const [accountHolder, setAccountHolder] = useState<string>(profile.bankAccount?.accountHolder || 'LE VAN AN');

  // Formatted period string e.g. "10/2026"
  const [yearStr, monthNumStr] = currentPeriod.split('-');
  const formattedPeriodLabel = `Tháng ${monthNumStr}/${yearStr}`;
  const transferMemo = `${selectedRoom?.code || 'P01'} TIEN NHA T${monthNumStr}`;

  const zaloMessage = `[HÓA ĐƠN TIỀN NHÀ] PHIẾU BÁO TIỀN THÁNG ${monthNumStr}/${yearStr}
Phòng: ${selectedRoom?.code || 'P01'} - ${selectedRoom?.name || ''}
----------------------------------------
🏠 1. TIỀN PHÒNG GỐC: ${formatVND(baseRentNum)}

⚡ 2. TIỀN ĐIỆN (${formatVND(eRate)}/kWh):
• Số cũ: ${electricStart} ➔ Số mới: ${electricEnd}
=> Sử dụng: ${electricUsage} kWh = ${formatVND(electricTotal)}

💧 3. TIỀN NƯỚC (${formatVND(wRate)}/m³):
• Số cũ: ${waterStart} ➔ Số mới: ${waterEnd}
=> Sử dụng: ${waterUsage} m³ = ${formatVND(waterTotal)}

🏢 4. PHÍ DỊCH VỤ (Rác, Wifi, Khác...):
• Phí rác: ${formatVND(garbageFee)}
• Phí internet/Wifi: ${formatVND(internetFee)}
${otherFee > 0 ? `• Phí khác: ${formatVND(otherFee)}\n` : ''}=> Tổng phí dịch vụ: +${formatVND(totalServiceFees)}

----------------------------------------
📊 5. TỔNG PHÁT SINH KỲ NÀY: ${formatVND(currentCycleTotal)}
${previousDebt > 0 ? `➕ 6. Nợ cũ kỳ trước: +${formatVND(previousDebt)}\n` : ''}${paidAmount > 0 ? `🔻 7. Đã thanh toán đợt trước: -${formatVND(paidAmount)}\n` : ''}========================================
💰 8. TỔNG CÒN PHẢI THU: ${formatVND(remainingBalance)}
----------------------------------------
🏦 THÔNG TIN CHUYỂN KHOẢN:
• Ngân hàng: ${bankName}
• STK: ${accountNumber}
• Chủ TK: ${accountHolder.toUpperCase()}
• Nội dung CK: ${transferMemo}

Hạn đóng tiền: Ngày 10/${monthNumStr}. Trân trọng cảm ơn!`;

  const handleCopyZalo = () => {
    navigator.clipboard.writeText(zaloMessage);
    setCopied(true);
    setStatusMsg('Đã sao chép tin nhắn Zalo thành công!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveToDatabase = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      await api.recordMeter({
        roomId: selectedRoomId,
        period: currentPeriod,
        electricStart,
        electricEnd,
        electricRate: eRate,
        waterStart,
        waterEnd,
        waterRate: wRate,
        waterBillingType: 'meter',
        forceConfirmAnomaly: true,
      });

      await api.generateInvoices(currentPeriod);

      await api.updateHouse({
        bankAccount: {
          ...profile.bankAccount,
          bankName,
          accountNumber,
          accountHolder,
        },
      });

      if (selectedRoom && baseRentNum !== selectedRoom.currentRent) {
        await api.updateRoom(selectedRoom.id, {
          currentRent: baseRentNum,
        });
      }

      setStatusMsg('Đã lưu chỉ số, thông tin ngân hàng & cập nhật hóa đơn thành công!');
      onSuccess();
    } catch (err: any) {
      setStatusMsg(`Lỗi: ${err.message || 'Kiểm tra lại dữ liệu'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenZaloApp = () => {
    handleCopyZalo();
    window.open('https://zalo.me', '_blank');
  };

  const handlePrintOrDownload = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col text-slate-800 max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg leading-tight flex items-center gap-2">
                <span>Phiếu Báo Tiền & Soạn Tin Zalo</span>
                <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-md font-mono">
                  {selectedRoom?.code}
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Tự động lập hóa đơn điện tử & gửi thông báo cho khách thuê
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs bg-slate-100/70">
          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Top Controls: Room Selector + Rates Adjustment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Choose Room */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
              <label className="block text-xs font-bold text-slate-700">Chọn phòng:</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} - {r.name} ({r.status === 'rented' ? 'Đang thuê' : 'Trống'})
                  </option>
                ))}
              </select>
            </div>

            {/* Rent Base */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
              <label className="block text-xs font-bold text-slate-700">Tiền phòng gốc:</label>
              <input
                type="text"
                value={baseRentNum > 0 ? baseRentNum.toLocaleString('vi-VN') : ''}
                onChange={(e) => setBaseRentInput(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Rates Adjustment */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
              <label className="block text-xs font-bold text-slate-700">Đơn giá Điện / Nước:</label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={electricRateInput}
                  onChange={(e) => setElectricRateInput(e.target.value)}
                  placeholder="5000"
                  className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-xs font-bold text-amber-900 text-center font-mono"
                  title="Đơn giá điện"
                />
                <input
                  type="text"
                  value={waterRateInput}
                  onChange={(e) => setWaterRateInput(e.target.value)}
                  placeholder="4000"
                  className="bg-sky-50 border border-sky-200 rounded-lg px-2 py-1 text-xs font-bold text-sky-900 text-center font-mono"
                  title="Đơn giá nước"
                />
              </div>
            </div>
          </div>

          {/* Meter Readings Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Electricity */}
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2 shadow-2xs">
              <div className="flex justify-between items-center text-amber-900 font-extrabold">
                <span className="flex items-center gap-1.5 text-xs">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Chỉ Số Điện (kWh)</span>
                </span>
                <span className="text-[11px] font-mono font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                  {formatVND(eRate)}/kWh
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold block mb-0.5">Số cũ:</label>
                  <input
                    type="number"
                    value={electricStart}
                    onChange={(e) => setElectricStart(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-bold font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-amber-900 font-bold block mb-0.5">Số mới:</label>
                  <input
                    type="number"
                    value={electricEnd}
                    onChange={(e) => setElectricEnd(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-amber-50 border-2 border-amber-400 rounded-lg p-1.5 font-black font-mono text-amber-950 focus:outline-none"
                  />
                </div>
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">Tiêu thụ: {electricUsage} kWh</span>
                <span className="text-slate-900 font-mono">{formatVND(electricTotal)}</span>
              </div>
            </div>

            {/* Water */}
            <div className="bg-white p-3.5 rounded-xl border border-sky-200 space-y-2 shadow-2xs">
              <div className="flex justify-between items-center text-sky-900 font-extrabold">
                <span className="flex items-center gap-1.5 text-xs">
                  <Droplet className="w-4 h-4 text-sky-500 fill-sky-500" />
                  <span>Chỉ Số Nước (m³)</span>
                </span>
                <span className="text-[11px] font-mono font-bold bg-sky-50 text-sky-800 px-2 py-0.5 rounded border border-sky-200">
                  {formatVND(wRate)}/m³
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 font-semibold block mb-0.5">Số cũ:</label>
                  <input
                    type="number"
                    value={waterStart}
                    onChange={(e) => setWaterStart(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-bold font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-sky-900 font-bold block mb-0.5">Số mới:</label>
                  <input
                    type="number"
                    value={waterEnd}
                    onChange={(e) => setWaterEnd(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-sky-50 border-2 border-sky-400 rounded-lg p-1.5 font-black font-mono text-sky-950 focus:outline-none"
                  />
                </div>
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">Tiêu thụ: {waterUsage} m³</span>
                <span className="text-slate-900 font-mono">{formatVND(waterTotal)}</span>
              </div>
            </div>
          </div>

          {/* Electronic Receipt / Bill Card Design Preview */}
          <div
            ref={receiptRef}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 text-slate-900"
          >
            {/* Bill Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-black text-lg sm:text-xl text-slate-900 uppercase tracking-wider">
                  HÓA ĐƠN TIỀN NHÀ
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Phòng {selectedRoom?.code} • Kỳ thu {formattedPeriodLabel}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block font-semibold">Hạn đóng:</span>
                <span className="text-xs sm:text-sm font-black text-rose-600">Ngày 10/{monthNumStr}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 font-medium">
                <span className="text-slate-700">1. Tiền phòng gốc ({selectedRoom?.code}):</span>
                <span className="font-bold font-mono tabular-nums">{formatVND(baseRentNum)}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 font-medium">
                <span className="text-slate-700">
                  2. Tiền điện ({electricUsage} kWh × {formatVND(eRate)}):
                </span>
                <span className="font-bold font-mono tabular-nums">{formatVND(electricTotal)}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 font-medium">
                <span className="text-slate-700">
                  3. Tiền nước ({waterUsage} m³ × {formatVND(wRate)}):
                </span>
                <span className="font-bold font-mono tabular-nums">{formatVND(waterTotal)}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 font-medium">
                <span className="text-slate-700">
                  4. Phí dịch vụ (Rác: {formatVND(garbageFee)}, Wifi: {formatVND(internetFee)}
                  {otherFee > 0 ? `, Khác: ${formatVND(otherFee)}` : ''}):
                </span>
                <span className="font-bold font-mono tabular-nums text-slate-800">
                  +{formatVND(totalServiceFees)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 bg-slate-50 px-2 rounded border border-slate-200 font-extrabold text-slate-900">
                <span>5. Tổng phát sinh kỳ này:</span>
                <span className="font-mono tabular-nums">{formatVND(currentCycleTotal)}</span>
              </div>

              {previousDebt > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 font-medium text-amber-700">
                  <span>6. Nợ cũ mang sang kỳ trước:</span>
                  <span className="font-bold font-mono tabular-nums">+{formatVND(previousDebt)}</span>
                </div>
              )}

              {paidAmount > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 font-medium text-emerald-700">
                  <span>7. Đã thanh toán đợt trước:</span>
                  <span className="font-bold font-mono tabular-nums">-{formatVND(paidAmount)}</span>
                </div>
              )}

              {/* Total Row */}
              <div className="flex justify-between items-center py-3 border-t-2 border-slate-900 font-black text-sm">
                <span className="text-slate-900">TỔNG CÒN PHẢI THU:</span>
                <span className="text-indigo-700 text-lg font-mono tabular-nums">
                  {formatVND(remainingBalance)}
                </span>
              </div>
            </div>

            {/* Editable Bank Transfer Info Box with VietQR Code Image */}
            <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 text-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* VietQR Code Image */}
                <div className="bg-white p-2 rounded-xl border border-indigo-200 shadow-2xs shrink-0 text-center">
                  <img
                    src={`https://img.vietqr.io/image/${profile.bankAccount?.bankId || 'MB'}-${accountNumber.trim()}-compact.png?amount=${remainingBalance}&addInfo=${encodeURIComponent(transferMemo)}&accountName=${encodeURIComponent(accountHolder.trim())}`}
                    alt="VietQR Chuyển Khoản Tự Động"
                    className="w-28 h-28 object-contain mx-auto rounded"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="text-[10px] text-indigo-900 font-bold block mt-1">Mã VietQR Tự Động</span>
                </div>

                {/* Editable Fields */}
                <div className="flex-1 space-y-2 w-full">
                  <div className="font-extrabold text-indigo-950 uppercase text-xs">
                    THÔNG TIN CHUYỂN KHOẢN (Cho phép chỉnh sửa):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-800 font-bold">
                    <div>
                      <label className="text-[11px] text-indigo-900 font-semibold block mb-0.5">Ngân hàng:</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="VD: MB Bank"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-indigo-900 font-semibold block mb-0.5">Số tài khoản (STK):</label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="VD: 0908123456"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-indigo-900 font-semibold block mb-0.5">Chủ tài khoản:</label>
                      <input
                        type="text"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
                        placeholder="VD: LE VAN AN"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-indigo-800 font-medium pt-0.5">
                    • Nội dung CK tự động: <strong className="text-indigo-950 font-mono font-bold">{transferMemo}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Message Zalo Code Block */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Nội dung văn bản tin nhắn Zalo:</span>
              </h4>
            </div>

            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 whitespace-pre-wrap leading-relaxed select-all">
              {zaloMessage}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyZalo}
            className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[44px]"
          >
            <Copy className="w-4 h-4" />
            <span>{copied ? 'Đã sao chép!' : '1. Copy tin nhắn văn bản'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleCopyZalo();
              window.open('https://zalo.me', '_blank');
            }}
            className="py-2.5 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[44px]"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Mở Zalo khách này</span>
          </button>

          <button
            type="button"
            onClick={handlePrintOrDownload}
            className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Tải / In phiếu</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToDatabase}
            disabled={saving}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang lưu...' : '2. Lưu Hóa Đơn Vào App'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
