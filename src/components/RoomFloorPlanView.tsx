import React from 'react';
import { Room, Invoice, MeterReading, TenancyStay } from '../types/index.ts';
import { formatVND } from '../utils/formatters.ts';
import { Zap, Droplet, Banknote, Calculator, User, Building2, CheckCircle2, AlertCircle } from 'lucide-react';

interface RoomFloorPlanViewProps {
  rooms: Room[];
  invoices: Invoice[];
  meters: MeterReading[];
  tenancies: TenancyStay[];
  currentPeriod: string;
  onCollect: (roomId: string) => void;
  onViewDetails: (room: Room) => void;
  onOpenZalo: (roomId: string) => void;
}

export const RoomFloorPlanView: React.FC<RoomFloorPlanViewProps> = ({
  rooms,
  invoices,
  meters,
  tenancies,
  currentPeriod,
  onCollect,
  onViewDetails,
  onOpenZalo,
}) => {
  // Group rooms by floor derived from room floor number or room code
  const floors = [
    { level: 1, name: 'TẦNG 1 (TRỆT)', filterCodes: ['P01', 'P02', 'P03'] },
    { level: 2, name: 'TẦNG 2 (LẦU 1)', filterCodes: ['P04', 'P05', 'P06'] },
    { level: 3, name: 'TẦNG 3 (LẦU 2)', filterCodes: ['P07', 'P08', 'P09'] },
  ];

  return (
    <div className="space-y-5">
      {/* Visual Floor Plan Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-cyan-900 p-4 sm:p-5 rounded-2xl text-white shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2.5 py-1 rounded-lg">
            MẪU 3: SƠ ĐỒ MẶT BẰNG & PHÂN TẦNG KHU TRỌ
          </span>
          <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-300" />
            <span>Mặt Bằng Tòa Nhà 3 Tầng • 9 Phòng Trọ</span>
          </h2>
          <p className="text-xs text-emerald-100/90 font-medium">
            Trực quan hóa khu nhà theo kiến trúc thực tế, kiểm tra nhanh trạng thái thu tiền & chỉ số từng phòng
          </p>
        </div>

        {/* Status Legend */}
        <div className="flex items-center gap-2 text-xs bg-black/20 p-2 rounded-xl backdrop-blur-xs border border-white/10 font-bold">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Đã thu
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span> Nợ tiền
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Phòng trống
          </span>
        </div>
      </div>

      {/* Floor by Floor Layout */}
      <div className="space-y-6">
        {floors.map((floor) => {
          const floorRooms = rooms.filter(
            (r) => floor.filterCodes.includes(r.code)
          );

          return (
            <div key={floor.level} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              {/* Floor Section Title */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-mono font-black text-xs flex items-center justify-center">
                    F{floor.level}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">{floor.name}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">{floorRooms.length} phòng chức năng</p>
                  </div>
                </div>
              </div>

              {/* Floor Rooms Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {floorRooms.map((room) => {
                  const inv = invoices.find((i) => i.roomId === room.id && i.periodMonth === currentPeriod);
                  const mr = meters.find((m) => m.roomId === room.id && m.period === currentPeriod);
                  const stay = tenancies.find((s) => s.id === room.currentStayId);
                  const isRented = room.status === 'rented';

                  const eStart = mr?.electricStart ?? Math.max(0, (room.currentMeter?.electricNumber ?? 1200) - 80);
                  const eEnd = mr?.electricEnd ?? (room.currentMeter?.electricNumber ?? 1280);
                  const eUsage = eEnd >= eStart ? eEnd - eStart : eEnd;

                  const wStart = mr?.waterStart ?? Math.max(0, (room.currentMeter?.waterNumber ?? 340) - 10);
                  const wEnd = mr?.waterEnd ?? (room.currentMeter?.waterNumber ?? 350);
                  const wUsage = wEnd >= wStart ? wEnd - wStart : wEnd;

                  const remaining = inv ? inv.remainingBalance : 0;
                  const isPaid = isRented && inv && remaining <= 0;
                  const isOwing = isRented && inv && remaining > 0;

                  return (
                    <div
                      key={room.id}
                      className={`bg-white rounded-xl border-2 p-3.5 shadow-2xs space-y-3 transition-all ${
                        isPaid
                          ? 'border-emerald-300 hover:border-emerald-500'
                          : isOwing
                          ? 'border-rose-300 hover:border-rose-500'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Room Code & Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-900'
                                : isOwing
                                ? 'bg-rose-100 text-rose-900'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {room.code}
                          </span>
                          <div>
                            <span className="font-extrabold text-slate-900 text-xs block">{room.name}</span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {formatVND(room.currentRent)}
                            </span>
                          </div>
                        </div>

                        {/* Status Icon Indicator */}
                        {isPaid && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Đã thu</span>
                          </span>
                        )}
                        {isOwing && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Nợ {formatVND(remaining)}</span>
                          </span>
                        )}
                        {!isRented && (
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Trống
                          </span>
                        )}
                      </div>

                      {/* Tenant Row */}
                      {isRented ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{stay?.representativeName || 'Khách đang ở'}</span>
                        </div>
                      ) : (
                        <div className="text-center text-slate-400 text-xs italic py-1">Phòng sẵn sàng đón khách</div>
                      )}

                      {/* Vertical Electricity & Water Meters */}
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        {/* Electricity */}
                        <div className="bg-amber-50/80 p-2 rounded-lg border border-amber-200/80 space-y-1">
                          <div className="flex justify-between items-center text-amber-900 font-extrabold text-[11px]">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-600" />
                              <span>⚡ ĐIỆN</span>
                            </span>
                            <span className="font-mono bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded font-black">
                              {eUsage} kWh
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] font-mono text-slate-600">
                            <span>Cũ: <strong>{eStart}</strong></span>
                            <span>Mới: <strong className="text-amber-900 bg-amber-200 px-1 rounded">{eEnd}</strong></span>
                          </div>
                        </div>

                        {/* Water */}
                        <div className="bg-sky-50/80 p-2 rounded-lg border border-sky-200/80 space-y-1">
                          <div className="flex justify-between items-center text-sky-900 font-extrabold text-[11px]">
                            <span className="flex items-center gap-1">
                              <Droplet className="w-3 h-3 text-sky-600" />
                              <span>💧 NƯỚC</span>
                            </span>
                            <span className="font-mono bg-sky-200 text-sky-950 px-1.5 py-0.2 rounded font-black">
                              {wUsage} m³
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] font-mono text-slate-600">
                            <span>Cũ: <strong>{wStart}</strong></span>
                            <span>Mới: <strong className="text-sky-900 bg-sky-200 px-1 rounded">{wEnd}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Room Actions */}
                      <div className="flex gap-1.5 pt-1">
                        {isRented && (
                          <button
                            onClick={() => onOpenZalo(room.id)}
                            className="flex-1 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs border border-blue-200 transition-colors flex items-center justify-center gap-1"
                          >
                            <Calculator className="w-3 h-3 text-blue-600" />
                            <span>Zalo</span>
                          </button>
                        )}
                        {isRented && (
                          <button
                            onClick={() => onCollect(room.id)}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1"
                          >
                            <Banknote className="w-3 h-3" />
                            <span>Thu tiền</span>
                          </button>
                        )}
                        <button
                          onClick={() => onViewDetails(room)}
                          className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                        >
                          Chi tiết
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
