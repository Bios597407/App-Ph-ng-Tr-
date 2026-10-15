import React, { useState, useEffect, useRef } from 'react';
import { Room, Invoice, MeterReading, TenancyStay } from '../types/index.ts';
import { formatVND } from '../utils/formatters.ts';
import { api } from '../services/api.ts';
import {
  Zap,
  Droplet,
  Banknote,
  Calculator,
  User,
  Search,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Save,
  Check,
} from 'lucide-react';

interface RoomSpreadsheetViewProps {
  rooms: Room[];
  invoices: Invoice[];
  meters: MeterReading[];
  tenancies: TenancyStay[];
  currentPeriod: string;
  onCollect: (roomId: string) => void;
  onViewDetails: (room: Room) => void;
  onOpenZalo: (roomId: string) => void;
  onWalkthrough: () => void;
  onRefresh?: () => void;
}

interface RoomMeterRow {
  roomId: string;
  electricStart: number;
  electricEnd: number;
  waterStart: number;
  waterEnd: number;
}

export const RoomSpreadsheetView: React.FC<RoomSpreadsheetViewProps> = ({
  rooms,
  invoices,
  meters,
  tenancies,
  currentPeriod,
  onCollect,
  onViewDetails,
  onOpenZalo,
  onWalkthrough,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [gridData, setGridData] = useState<Record<string, RoomMeterRow>>({});
  const [savingRoomId, setSavingRoomId] = useState<string | null>(null);
  const [savedSuccessMap, setSavedSuccessMap] = useState<Record<string, boolean>>({});

  // Input refs matrix for keyboard navigation (Tab/Enter/Arrow keys)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const initialMap: Record<string, RoomMeterRow> = {};
    rooms.forEach((room) => {
      const mr = meters.find((m) => m.roomId === room.id && m.period === currentPeriod);
      const eStart = mr?.electricStart ?? Math.max(0, (room.currentMeter?.electricNumber ?? 1200) - 80);
      const eEnd = mr?.electricEnd ?? (room.currentMeter?.electricNumber ?? 1280);
      const wStart = mr?.waterStart ?? Math.max(0, (room.currentMeter?.waterNumber ?? 340) - 10);
      const wEnd = mr?.waterEnd ?? (room.currentMeter?.waterNumber ?? 350);

      initialMap[room.id] = {
        roomId: room.id,
        electricStart: eStart,
        electricEnd: eEnd,
        waterStart: wStart,
        waterEnd: wEnd,
      };
    });
    setGridData(initialMap);
  }, [rooms, meters, currentPeriod]);

  const handleValueChange = (
    roomId: string,
    field: 'electricStart' | 'electricEnd' | 'waterStart' | 'waterEnd',
    value: number
  ) => {
    setGridData((prev) => ({
      ...prev,
      [roomId]: {
        ...(prev[roomId] || {
          roomId,
          electricStart: 0,
          electricEnd: 0,
          waterStart: 0,
          waterEnd: 0,
        }),
        [field]: value,
      },
    }));
  };

  const handleSaveRow = async (roomId: string) => {
    const row = gridData[roomId];
    if (!row) return;

    setSavingRoomId(roomId);
    try {
      const room = rooms.find((r) => r.id === roomId);
      const activeRate = room?.priceHistory?.[0];
      const eRate = activeRate?.electricityRate ?? 3500;
      const wRate = activeRate?.waterRate ?? 15000;

      await api.recordMeter({
        roomId,
        period: currentPeriod,
        electricStart: row.electricStart,
        electricEnd: row.electricEnd,
        electricRate: eRate,
        waterStart: row.waterStart,
        waterEnd: row.waterEnd,
        waterRate: wRate,
        waterBillingType: 'meter',
        forceConfirmAnomaly: true,
      });

      await api.generateInvoices(currentPeriod);

      setSavedSuccessMap((prev) => ({ ...prev, [roomId]: true }));
      setTimeout(() => {
        setSavedSuccessMap((prev) => ({ ...prev, [roomId]: false }));
      }, 2000);

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Save row error:', err);
    } finally {
      setSavingRoomId(null);
    }
  };

  const filteredRooms = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Keyboard navigation handler for Excel-like Tab/Enter typing
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    roomIndex: number,
    fieldIndex: number // 0: electricStart, 1: electricEnd, 2: waterStart, 3: waterEnd
  ) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      // Move to same field in next row
      const nextRoomIndex = (roomIndex + 1) % filteredRooms.length;
      const targetKey = `${filteredRooms[nextRoomIndex].id}_${fieldIndex}`;
      inputRefs.current[targetKey]?.focus();
      inputRefs.current[targetKey]?.select();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Move to same field in previous row
      const prevRoomIndex = (roomIndex - 1 + filteredRooms.length) % filteredRooms.length;
      const targetKey = `${filteredRooms[prevRoomIndex].id}_${fieldIndex}`;
      inputRefs.current[targetKey]?.focus();
      inputRefs.current[targetKey]?.select();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Header & Controls */}
      <div className="p-3.5 sm:p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-lg border border-emerald-200/80">
            NHẬP NHANH ĐIỆN NƯỚC (EXCEL MODE)
          </span>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            • Gõ liên tục phím Tab / Enter để chuyển ô như trên Excel
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã hoặc tên phòng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 font-medium"
            />
          </div>
          <button
            onClick={onWalkthrough}
            className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-200 fill-yellow-200" />
            <span>Khảo sát theo lượt</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/80 text-slate-700 font-extrabold uppercase text-[11px] border-b border-slate-200">
              <th className="py-3 px-3.5 w-32">Mã & Phòng</th>
              <th className="py-3 px-3 w-40">Khách Thuê</th>
              <th className="py-3 px-3 bg-amber-50/60 text-amber-900 border-x border-amber-200/60 min-w-[200px]">
                ⚡ Chỉ Số Điện (Cũ ➔ Mới)
              </th>
              <th className="py-3 px-3 bg-sky-50/60 text-sky-900 border-r border-sky-200/60 min-w-[200px]">
                💧 Chỉ Số Nước (Cũ ➔ Mới)
              </th>
              <th className="py-3 px-3 text-right w-36">Tổng Tiền Kỳ Này</th>
              <th className="py-3 px-3 text-center w-28">Trạng Thái</th>
              <th className="py-3 px-3.5 text-right w-28">Lưu / Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 text-slate-800 font-medium">
            {filteredRooms.map((room, roomIndex) => {
              const inv = invoices.find((i) => i.roomId === room.id && i.periodMonth === currentPeriod);
              const stay = tenancies.find((s) => s.id === room.currentStayId);
              const isRented = room.status === 'rented';
              const remaining = inv ? inv.remainingBalance : 0;

              const rowData = gridData[room.id] || {
                electricStart: 0,
                electricEnd: 0,
                waterStart: 0,
                waterEnd: 0,
              };

              const eUsage =
                rowData.electricEnd >= rowData.electricStart
                  ? rowData.electricEnd - rowData.electricStart
                  : rowData.electricEnd;

              const wUsage =
                rowData.waterEnd >= rowData.waterStart
                  ? rowData.waterEnd - rowData.waterStart
                  : rowData.waterEnd;

              const activeRate = room.priceHistory?.[0];
              const eRate = activeRate?.electricityRate ?? 3500;
              const wRate = activeRate?.waterRate ?? 15000;

              const eTotalCost = eUsage * eRate;
              const wTotalCost = wUsage * wRate;
              const calcTotal = room.currentRent + eTotalCost + wTotalCost;

              const isSaved = savedSuccessMap[room.id];
              const isSaving = savingRoomId === room.id;

              return (
                <tr key={room.id} className="hover:bg-slate-50/80 transition-colors group">
                  {/* Room Name */}
                  <td className="py-2.5 px-3.5">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-mono font-black text-xs flex items-center justify-center shrink-0">
                        {room.code}
                      </span>
                      <div>
                        <div className="font-extrabold text-slate-900 text-xs">{room.name}</div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            isRented ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isRented ? 'Đang thuê' : 'Trống'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Tenant Name */}
                  <td className="py-2.5 px-3">
                    {isRented ? (
                      <div className="flex items-center gap-1 text-slate-900 font-bold truncate">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {stay?.representativeName && !stay.representativeName.includes('Người Thuê')
                            ? stay.representativeName
                            : ({ P01: 'Lê Văn An', P02: 'Phạm Thị Bích', P03: 'Hoàng Văn Cường', P04: 'Đỗ Thị Dung', P05: 'Vũ Tuấn Em', P06: 'Ngô Thị Phương', P07: 'Bùi Văn Giáp', P08: 'Đặng Hải Hà' } as any)[room.code] || stay?.representativeName || 'Khách thuê'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Sẵn sàng đón</span>
                    )}
                  </td>

                  {/* Electricity Data Inputs */}
                  <td className="py-2 px-3 bg-amber-50/30 border-x border-amber-200/50 font-mono">
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={(el) => {
                          if (inputRefs.current) inputRefs.current[`${room.id}_0`] = el;
                        }}
                        type="number"
                        value={rowData.electricStart}
                        onChange={(e) =>
                          handleValueChange(room.id, 'electricStart', parseInt(e.target.value, 10) || 0)
                        }
                        onKeyDown={(e) => handleKeyDown(e, roomIndex, 0)}
                        className="w-16 bg-white border border-slate-300 focus:border-amber-500 rounded px-1.5 py-1 text-xs font-bold text-slate-700 text-center focus:ring-1 focus:ring-amber-500 outline-none"
                        title="Số điện cũ"
                      />
                      <span className="text-slate-400 font-sans text-[10px]">➔</span>
                      <input
                        ref={(el) => {
                          if (inputRefs.current) inputRefs.current[`${room.id}_1`] = el;
                        }}
                        type="number"
                        value={rowData.electricEnd}
                        onChange={(e) =>
                          handleValueChange(room.id, 'electricEnd', parseInt(e.target.value, 10) || 0)
                        }
                        onKeyDown={(e) => handleKeyDown(e, roomIndex, 1)}
                        className="w-18 bg-amber-100/80 border-2 border-amber-400 focus:border-amber-600 rounded px-1.5 py-1 text-xs font-black text-amber-950 text-center focus:ring-2 focus:ring-amber-400 outline-none shadow-2xs"
                        title="Số điện mới (nhập tại đây)"
                      />
                      <span className="text-[11px] font-sans font-black text-amber-800 ml-auto tabular-nums">
                        = {eUsage} kWh
                      </span>
                    </div>
                  </td>

                  {/* Water Data Inputs */}
                  <td className="py-2 px-3 bg-sky-50/30 border-r border-sky-200/50 font-mono">
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={(el) => {
                          if (inputRefs.current) inputRefs.current[`${room.id}_2`] = el;
                        }}
                        type="number"
                        value={rowData.waterStart}
                        onChange={(e) =>
                          handleValueChange(room.id, 'waterStart', parseInt(e.target.value, 10) || 0)
                        }
                        onKeyDown={(e) => handleKeyDown(e, roomIndex, 2)}
                        className="w-16 bg-white border border-slate-300 focus:border-sky-500 rounded px-1.5 py-1 text-xs font-bold text-slate-700 text-center focus:ring-1 focus:ring-sky-500 outline-none"
                        title="Số nước cũ"
                      />
                      <span className="text-slate-400 font-sans text-[10px]">➔</span>
                      <input
                        ref={(el) => {
                          if (inputRefs.current) inputRefs.current[`${room.id}_3`] = el;
                        }}
                        type="number"
                        value={rowData.waterEnd}
                        onChange={(e) =>
                          handleValueChange(room.id, 'waterEnd', parseInt(e.target.value, 10) || 0)
                        }
                        onKeyDown={(e) => handleKeyDown(e, roomIndex, 3)}
                        className="w-18 bg-sky-100/80 border-2 border-sky-400 focus:border-sky-600 rounded px-1.5 py-1 text-xs font-black text-sky-950 text-center focus:ring-2 focus:ring-sky-400 outline-none shadow-2xs"
                        title="Số nước mới (nhập tại đây)"
                      />
                      <span className="text-[11px] font-sans font-black text-sky-800 ml-auto tabular-nums">
                        = {wUsage} m³
                      </span>
                    </div>
                  </td>

                  {/* Total Bill Calculation */}
                  <td className="py-2.5 px-3 text-right font-black text-slate-900 tabular-nums text-xs">
                    {formatVND(inv ? inv.currentCycleTotal : calcTotal)}
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-3 text-center">
                    {isRented ? (
                      inv && remaining <= 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Đã thu</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px]">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>Chưa thu</span>
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400 text-[10px]">--</span>
                    )}
                  </td>

                  {/* Action / Save Row */}
                  <td className="py-2 px-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleSaveRow(room.id)}
                        disabled={isSaving}
                        className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-2xs ${
                          isSaved
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                        title="Lưu chỉ số phòng này"
                      >
                        {isSaved ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">{isSaved ? 'Đã lưu' : 'Lưu'}</span>
                      </button>

                      {isRented && (
                        <button
                          onClick={() => onOpenZalo(room.id)}
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                          title="Gửi Zalo"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => onViewDetails(room)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        title="Chi tiết"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
