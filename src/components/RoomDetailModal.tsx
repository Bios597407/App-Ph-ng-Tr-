import React, { useState } from 'react';
import { Room, TenancyStay, Tenant, Invoice, MeterReading, RoomStatus } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVND, formatDateVN } from '../utils/formatters.ts';
import {
  X,
  User,
  Zap,
  Droplet,
  Save,
  Check,
  Phone,
  MessageCircle,
  Banknote,
  FileText,
  Building,
  CreditCard,
  History,
  Shield,
} from 'lucide-react';

interface RoomDetailModalProps {
  room: Room;
  stay?: TenancyStay | null;
  tenants: Tenant[];
  invoices: Invoice[];
  meters: MeterReading[];
  currentPeriod?: string;
  onClose: () => void;
  onRefresh: () => void;
  onOpenZalo?: (roomId: string) => void;
  onCollect?: (roomId: string) => void;
}

export const RoomDetailModal: React.FC<RoomDetailModalProps> = ({
  room,
  stay,
  tenants,
  invoices,
  meters,
  currentPeriod = '2026-10',
  onClose,
  onRefresh,
  onOpenZalo,
  onCollect,
}) => {
  const [activeTab, setActiveTab] = useState<'billing' | 'tenant' | 'history'>('billing');

  const currentInvoice = invoices.find((i) => i.roomId === room.id && i.periodMonth === currentPeriod);
  const existingMeter = meters.find((m) => m.roomId === room.id && m.period === currentPeriod);
  const primaryTenant = tenants.find((t) => t.roomId === room.id || t.stayId === stay?.id);

  // Room Core Details
  const [roomNameInput, setRoomNameInput] = useState<string>(room.name);
  const [roomRentInput, setRoomRentInput] = useState<string>(room.currentRent.toString());
  const [roomStatus, setRoomStatus] = useState<RoomStatus>(room.status);

  // Tenant Details
  const [repName, setRepName] = useState<string>(stay?.representativeName || primaryTenant?.fullName || 'Lê Văn An');
  const [repPhone, setRepPhone] = useState<string>(stay?.representativePhone || primaryTenant?.phone || '0908123456');
  const [identityCard, setIdentityCard] = useState<string>(primaryTenant?.idCardNumber || '079201234567');
  const [depositAmount, setDepositAmount] = useState<string>((stay?.depositAmount || room.currentRent).toString());
  const [startDate, setStartDate] = useState<string>(stay?.startDate || '2026-01-01');
  const [serviceFeeInput, setServiceFeeInput] = useState<string>('0');

  // Meter Values
  const defaultEStart = existingMeter?.electricStart ?? Math.max(0, (room.currentMeter?.electricNumber ?? 1200) - 80);
  const defaultEEnd = existingMeter?.electricEnd ?? (room.currentMeter?.electricNumber ?? 1280);
  const [elecStart, setElecStart] = useState<string>(defaultEStart.toString());
  const [elecEnd, setElecEnd] = useState<string>(defaultEEnd.toString());

  const defaultWStart = existingMeter?.waterStart ?? Math.max(0, (room.currentMeter?.waterNumber ?? 340) - 10);
  const defaultWEnd = existingMeter?.waterEnd ?? (room.currentMeter?.waterNumber ?? 350);
  const [waterStart, setWaterStart] = useState<string>(defaultWStart.toString());
  const [waterEnd, setWaterEnd] = useState<string>(defaultWEnd.toString());

  // Unit Rates (Starts from 5000 and 4000)
  const defaultERate = existingMeter?.electricRate && existingMeter.electricRate !== 3500
    ? existingMeter.electricRate
    : (room.priceHistory?.[0]?.electricityRate && room.priceHistory[0].electricityRate !== 3500
        ? room.priceHistory[0].electricityRate
        : 5000);
  const defaultWRate = existingMeter?.waterRate && existingMeter.waterRate !== 20000
    ? existingMeter.waterRate
    : (room.priceHistory?.[0]?.waterRate && room.priceHistory[0].waterRate !== 20000
        ? room.priceHistory[0].waterRate
        : 4000);
  const [elecRateInput, setElecRateInput] = useState<string>(defaultERate.toString());
  const [waterRateInput, setWaterRateInput] = useState<string>(defaultWRate.toString());

  // Saving states
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Math Calculations
  const numEStart = parseInt(elecStart.replace(/\D/g, ''), 10) || 0;
  const numEEnd = parseInt(elecEnd.replace(/\D/g, ''), 10) || 0;
  const eUsage = numEEnd >= numEStart ? numEEnd - numEStart : 0;

  const rawERate = parseInt(elecRateInput.replace(/\D/g, ''), 10) || 5000;
  const eRate = rawERate <= 100 ? rawERate * 1000 : rawERate;
  const eCost = eUsage * eRate;

  const numWStart = parseInt(waterStart.replace(/\D/g, ''), 10) || 0;
  const numWEnd = parseInt(waterEnd.replace(/\D/g, ''), 10) || 0;
  const wUsage = numWEnd >= numWStart ? numWEnd - numWStart : 0;

  const rawWRate = parseInt(waterRateInput.replace(/\D/g, ''), 10) || 4000;
  const wRate = rawWRate <= 100 ? rawWRate * 1000 : rawWRate;
  const wCost = wUsage * wRate;

  const rentNum = parseInt(roomRentInput.replace(/\D/g, ''), 10) || 0;
  const serviceFeeNum = parseInt(serviceFeeInput.replace(/\D/g, ''), 10) || 0;

  const totalPeriodAmount = rentNum + eCost + wCost + serviceFeeNum;

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Update room base details
      await api.updateRoom(room.id, {
        name: roomNameInput.trim(),
        currentRent: rentNum,
        status: roomStatus,
      });

      // Update tenancy stay
      if (stay?.id) {
        await api.updateTenancy(stay.id, {
          representativeName: repName.trim(),
          representativePhone: repPhone.trim(),
          depositAmount: parseInt(depositAmount.replace(/\D/g, ''), 10) || rentNum,
          startDate,
        });
      }

      // Update billing, meters, and invoice
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
        garbageFee: 0,
        internetFee: 0,
        otherFee: serviceFeeNum,
        tenantName: repName.trim(),
        tenantPhone: repPhone.trim(),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onRefresh();
    } catch (err) {
      console.error('Error saving detail modal:', err);
    } finally {
      setSaving(false);
    }
  };

  const isRented = roomStatus === 'rented';
  const isPaid = currentInvoice && currentInvoice.remainingBalance <= 0;

  // History list for room
  const roomHistoryInvoices = invoices.filter((i) => i.roomId === room.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
              {room.code}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg">{roomNameInput}</h2>
                {isRented ? (
                  isPaid ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✅ Đã thu
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Chưa thu
                    </span>
                  )
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    Phòng trống
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Giá thuê gốc: <strong className="text-emerald-400">{formatVND(rentNum)}</strong>/tháng
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TAB NAVIGATION BAR */}
        <div className="bg-slate-100 px-5 py-2 border-b border-slate-200 flex items-center gap-2 text-xs font-extrabold">
          <button
            onClick={() => setActiveTab('billing')}
            className={`px-3.5 py-2 rounded-xl transition-all ${
              activeTab === 'billing'
                ? 'bg-white text-indigo-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Chi tiết kỳ thu ({currentPeriod})
          </button>
          <button
            onClick={() => setActiveTab('tenant')}
            className={`px-3.5 py-2 rounded-xl transition-all ${
              activeTab === 'tenant'
                ? 'bg-white text-indigo-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Khách thuê & Hợp đồng
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-xl transition-all ${
              activeTab === 'history'
                ? 'bg-white text-indigo-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Lịch sử đóng tiền ({roomHistoryInvoices.length})
          </button>
        </div>

        {/* MODAL TAB BODY */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs bg-slate-50/50">
          {/* TAB 1: BILLING DETAILS */}
          {activeTab === 'billing' && (
            <div className="space-y-4">
              {/* Basic Room Settings */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <span>Cấu hình phòng cơ bản</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Tên phòng:</label>
                    <input
                      type="text"
                      value={roomNameInput}
                      onChange={(e) => setRoomNameInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Giá thuê gốc/tháng:</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={rentNum > 0 ? rentNum.toLocaleString('vi-VN') : ''}
                      onChange={(e) => setRoomRentInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Trạng thái phòng:</label>
                    <select
                      value={roomStatus}
                      onChange={(e) => setRoomStatus(e.target.value as 'rented' | 'vacant')}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
                    >
                      <option value="rented">Đang thuê</option>
                      <option value="vacant">Phòng trống</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Electricity & Water Readings */}
              <div className="space-y-3">
                <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Chỉ số Điện & Nước kỳ {currentPeriod}</span>
                </h3>

                {/* Electricity */}
                <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200/90 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-black text-amber-950 flex items-center gap-1 text-sm">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span>Tiền điện ({Math.round(eRate / 1000)}k/kWh)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-900 font-bold">Đơn giá (đ/kWh):</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={elecRateInput}
                        onChange={(e) => setElecRateInput(e.target.value)}
                        className="w-20 px-2 py-1 bg-white border border-amber-300 rounded-lg text-right font-black text-slate-900 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-slate-600 font-bold block mb-1">Số cũ</span>
                      <input
                        type="text"
                        value={elecStart}
                        onChange={(e) => setElecStart(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg font-mono font-bold text-slate-900 text-sm"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-600 font-bold block mb-1">Số mới</span>
                      <input
                        type="text"
                        value={elecEnd}
                        onChange={(e) => setElecEnd(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-amber-400 rounded-lg font-mono font-black text-amber-950 text-sm focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div className="text-right text-xs sm:text-sm font-mono font-black text-amber-950 pt-1">
                    ⚡ {eUsage} kWh × {formatVND(eRate)} = {formatVND(eCost)}
                  </div>
                </div>

                {/* Water */}
                <div className="bg-sky-50/70 rounded-xl p-3.5 border border-sky-200/90 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-black text-sky-950 flex items-center gap-1 text-sm">
                      <Droplet className="w-4 h-4 text-sky-500 fill-sky-500" />
                      <span>Tiền nước ({Math.round(wRate / 1000)}k/m³)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-sky-900 font-bold">Đơn giá (đ/m³):</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={waterRateInput}
                        onChange={(e) => setWaterRateInput(e.target.value)}
                        className="w-20 px-2 py-1 bg-white border border-sky-300 rounded-lg text-right font-black text-slate-900 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-slate-600 font-bold block mb-1">Số cũ</span>
                      <input
                        type="text"
                        value={waterStart}
                        onChange={(e) => setWaterStart(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-sky-200 rounded-lg font-mono font-bold text-slate-900 text-sm"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-600 font-bold block mb-1">Số mới</span>
                      <input
                        type="text"
                        value={waterEnd}
                        onChange={(e) => setWaterEnd(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-sky-400 rounded-lg font-mono font-black text-sky-950 text-sm focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <div className="text-right text-xs sm:text-sm font-mono font-black text-sky-950 pt-1">
                    💧 {wUsage} m³ × {formatVND(wRate)} = {formatVND(wCost)}
                  </div>
                </div>

                {/* Additional Service Fees */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 text-xs">
                      Phụ phí / Dịch vụ khác (Wifi, Rác, Giữ xe...):
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={serviceFeeNum > 0 ? serviceFeeNum.toLocaleString('vi-VN') : ''}
                      onChange={(e) => setServiceFeeInput(e.target.value.replace(/\D/g, ''))}
                      className="w-28 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-right text-xs"
                      placeholder="80.000 đ"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TENANT & CONTRACT DETAILS */}
          {activeTab === 'tenant' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-extrabold text-indigo-700 text-xs flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span>Thông tin khách thuê đại diện</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Họ và tên đại diện:</label>
                    <input
                      type="text"
                      value={repName}
                      onChange={(e) => setRepName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-extrabold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Số điện thoại liên hệ:</label>
                    <input
                      type="text"
                      value={repPhone}
                      onChange={(e) => setRepPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-extrabold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Số CCCD / CMND:</label>
                    <input
                      type="text"
                      value={identityCard}
                      onChange={(e) => setIdentityCard(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Tiền đặt cọc (đ):</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={parseInt(depositAmount, 10) > 0 ? parseInt(depositAmount, 10).toLocaleString('vi-VN') : ''}
                      onChange={(e) => setDepositAmount(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Ngày bắt đầu thuê:</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PAYMENT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Lịch sử thanh toán hóa đơn ({roomHistoryInvoices.length} kỳ)</span>
              </h3>

              {roomHistoryInvoices.length === 0 ? (
                <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-400 font-medium">
                  Chưa có lịch sử thanh toán nào cho phòng này.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Kỳ thu</th>
                        <th className="p-2.5">Tổng tiền</th>
                        <th className="p-2.5">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {roomHistoryInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold font-mono">Tháng {inv.periodMonth.slice(5)}/{inv.periodMonth.slice(0, 4)}</td>
                          <td className="p-2.5 font-bold font-mono text-emerald-700">{formatVND(inv.currentCycleTotal)}</td>
                          <td className="p-2.5">
                            {inv.remainingBalance <= 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                                Đã hoàn tất
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px]">
                                Còn nợ {formatVND(inv.remainingBalance)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Tổng thanh toán kỳ này</span>
            <span className="text-xl font-black text-slate-950 tracking-tight tabular-nums">
              {formatVND(totalPeriodAmount)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs min-h-[44px]"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Đã lưu thành công!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Đang lưu...' : 'Lưu cập nhật'}</span>
                </>
              )}
            </button>

            {isRented && onOpenZalo && (
              <button
                onClick={() => {
                  onClose();
                  onOpenZalo(room.id);
                }}
                className="py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-colors min-h-[44px]"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Gửi Zalo</span>
              </button>
            )}

            {isRented && onCollect && (
              <button
                onClick={() => {
                  onClose();
                  onCollect(room.id);
                }}
                className="py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 transition-colors shadow-2xs min-h-[44px]"
              >
                <Banknote className="w-4 h-4" />
                <span>Thu tiền</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
