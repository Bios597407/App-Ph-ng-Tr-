import React, { useState } from 'react';
import { Room, Invoice, MeterReading } from '../types/index.ts';
import { formatVND } from '../utils/formatters.ts';
import { calculateRoomBillingBreakdown } from '../utils/billingCalculator.ts';
import {
  User,
  Zap,
  Droplet,
  Banknote,
  CheckCircle2,
  Phone,
  MessageCircle,
  AlertCircle,
  RotateCcw,
  Copy,
  Eye,
  History,
  Calculator,
  SlidersHorizontal,
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
  onOpenAdjustment?: (room: Room) => void;
  onOpenZalo?: (roomId: string) => void;
  onViewTenantPortal?: (roomId: string) => void;
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
  onOpenAdjustment,
  onOpenZalo,
  onViewTenantPortal,
}) => {
  const breakdown = calculateRoomBillingBreakdown({
    room,
    currentPeriod,
    invoice: currentInvoice || undefined,
    meterReading: meterReading || undefined,
  });

  const isRented = room.status === 'rented';
  const isPaid = isRented && breakdown.isPaid;

  // Meter Reading Numbers (Read-only on Card, Adjusted exclusively via Dialog)
  const numEStart = breakdown.electricStart;
  const numEEnd = breakdown.electricEnd;
  const eRate = breakdown.electricRate;
  const eUsage = breakdown.electricUsage;
  const eTotalCost = breakdown.electricTotal;

  const numWStart = breakdown.waterStart;
  const numWEnd = breakdown.waterEnd;
  const wRate = breakdown.waterRate;
  const wUsage = breakdown.waterUsage;
  const wTotalCost = breakdown.waterTotal;

  // Service Fees & Adjustments
  const otherFeesNum = breakdown.totalServiceFees;

  // Exact Transparent Sum
  const totalBill = breakdown.totalExpected;

  const [copiedPhoneToast, setCopiedPhoneToast] = useState<boolean>(false);

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tenantPhone) return;
    navigator.clipboard.writeText(tenantPhone);
    setCopiedPhoneToast(true);
    setTimeout(() => setCopiedPhoneToast(false), 2000);
  };

  const handleOpenDialog = () => {
    if (onOpenAdjustment) {
      onOpenAdjustment(room);
    } else {
      onViewDetails(room);
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
      onClick={handleOpenDialog}
      className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between relative overflow-hidden group cursor-pointer"
      title="Bấm vào thẻ hoặc 'Tổng tiền kỳ này' để mở hộp thoại điều chỉnh chỉ số điện nước & phí"
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
                  className="text-slate-600 hover:text-indigo-600 font-mono font-bold tabular-nums shrink-0 flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs cursor-pointer"
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

        {/* METER READINGS OVERVIEW DISPLAY (CLICKABLE TO OPEN ADJUSTMENT DIALOG) */}
        {isRented && (
          <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
            {/* Electricity Summary Box */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDialog();
              }}
              className="rounded-xl p-2.5 border bg-amber-50/60 hover:bg-amber-100/90 border-amber-200/80 hover:border-amber-300 space-y-1 cursor-pointer transition-all hover:shadow-2xs group/elec"
              title="Chạm để điều chỉnh chỉ số và đơn giá Điện"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-black text-amber-950 flex items-center gap-1 text-xs whitespace-nowrap shrink-0">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                  <span className="whitespace-nowrap">Điện ({Math.round(eRate / 1000)}k)</span>
                </span>
                <span className="font-mono font-extrabold text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded text-xs tabular-nums whitespace-nowrap shrink-0 group-hover/elec:bg-amber-200/90">
                  {eUsage} kWh
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700 font-mono text-xs pt-0.5">
                <span className="text-slate-500 font-bold">{numEStart}</span>
                <span className="text-slate-400 font-sans">➔</span>
                <span className="font-black text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-300">
                  {numEEnd}
                </span>
              </div>
              <div className="text-xs text-amber-950 font-black text-right tabular-nums pt-0.5">
                {formatVND(eTotalCost)}
              </div>
            </div>

            {/* Water Summary Box */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDialog();
              }}
              className="rounded-xl p-2.5 border bg-sky-50/60 hover:bg-sky-100/90 border-sky-200/80 hover:border-sky-300 space-y-1 cursor-pointer transition-all hover:shadow-2xs group/water"
              title="Chạm để điều chỉnh chỉ số và đơn giá Nước"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-black text-sky-950 flex items-center gap-1 text-xs whitespace-nowrap shrink-0">
                  <Droplet className="w-4 h-4 text-sky-500 fill-sky-500 shrink-0" />
                  <span className="whitespace-nowrap">Nước ({Math.round(wRate / 1000)}k)</span>
                </span>
                <span className="font-mono font-extrabold text-sky-900 bg-sky-100/90 px-1.5 py-0.5 rounded text-xs tabular-nums whitespace-nowrap shrink-0 group-hover/water:bg-sky-200/90">
                  {wUsage} m³
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700 font-mono text-xs pt-0.5">
                <span className="text-slate-500 font-bold">{numWStart}</span>
                <span className="text-slate-400 font-sans">➔</span>
                <span className="font-black text-sky-950 bg-white px-2 py-0.5 rounded border border-sky-300">
                  {numWEnd}
                </span>
              </div>
              <div className="text-xs text-sky-950 font-black text-right tabular-nums pt-0.5">
                {formatVND(wTotalCost)}
              </div>
            </div>
          </div>
        )}

        {/* SERVICE FEES / ADJUSTMENTS ROW */}
        {isRented && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDialog();
            }}
            className="bg-slate-50/80 hover:bg-slate-100 p-2 rounded-xl border border-slate-200/80 hover:border-indigo-300 flex items-center justify-between text-xs cursor-pointer transition-all hover:shadow-2xs"
            title="Chạm để điều chỉnh phí dịch vụ và phụ phí"
          >
            <span className="text-slate-600 font-bold truncate">
              Phí dịch vụ (Rác, Wifi, Khác...):
            </span>
            <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
              +{formatVND(otherFeesNum)}
            </span>
          </div>
        )}
      </div>

      {/* FOOTER & ACTIONS */}
      <div className="pt-3 mt-2 border-t border-slate-100 space-y-2.5">
        {/* TỔNG CÒN PHẢI THU - DÙNG CHUNG CẤU TRÚC ĐỒNG BỘ 100% VỚI HỘP THOẠI THU TIỀN & ZALO */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDialog();
          }}
          className="bg-indigo-50/70 hover:bg-indigo-100/90 border border-indigo-200 hover:border-indigo-300 rounded-xl p-2.5 sm:p-3 cursor-pointer transition-all hover:shadow-xs group/total"
          title="Chạm vào đây để mở hộp thoại điều chỉnh Chỉ số Điện, Nước và Phí dịch vụ"
        >
          <div className="flex items-center justify-between text-xs text-indigo-950 font-black mb-1">
            <span className="flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Tổng còn phải thu:</span>
            </span>
            <span className="text-[11px] text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200 font-extrabold group-hover/total:bg-indigo-600 group-hover/total:text-white transition-colors flex items-center gap-1 shadow-2xs">
              <SlidersHorizontal className="w-3 h-3" />
              <span>Điều chỉnh</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] text-slate-600 font-medium truncate pr-2 space-x-1">
              <span>Phát sinh: <strong>{formatVND(breakdown.currentCycleTotal)}</strong></span>
              {breakdown.previousDebt > 0 && <span className="text-amber-700 font-bold">• Nợ: +{formatVND(breakdown.previousDebt)}</span>}
              {breakdown.paidAmount > 0 && <span className="text-emerald-700 font-bold">• Đã nộp: -{formatVND(breakdown.paidAmount)}</span>}
            </div>
            <span className="text-lg sm:text-2xl font-black text-indigo-950 tracking-tight tabular-nums">
              {formatVND(breakdown.remainingBalance)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
          {isRented && onOpenZalo ? (
            <button
              onClick={() => onOpenZalo(room.id)}
              className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors min-h-[44px] cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-blue-600" />
              <span>Gửi Zalo</span>
            </button>
          ) : (
            <button
              onClick={handleOpenDialog}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs sm:text-sm transition-colors min-h-[44px] cursor-pointer"
            >
              <span>Chi tiết</span>
            </button>
          )}

          <button
            onClick={() => onCollect(room.id)}
            disabled={!isRented}
            className={`py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-2xs min-h-[44px] cursor-pointer ${
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

        {/* Quick Link: Tenant Portal View */}
        {isRented && onViewTenantPortal && (
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onViewTenantPortal(room.id)}
              className="w-full py-1.5 px-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Mở giao diện Cổng Khách Thuê của phòng này để xem và đối chiếu lịch sử hóa đơn"
            >
              <Eye className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>👁️ Xem giao diện Cổng Khách Thuê</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
