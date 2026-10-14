import React, { useState, useEffect } from 'react';
import {
  Room,
  HouseProfile,
  Invoice,
  Payment,
  Tenant,
  TenancyStay,
  MeterReading,
  User,
  MaintenanceTicket,
  HouseExpense,
} from './types/index.ts';
import { api } from './services/api.ts';
import { getClientFallbackDb, getDefaultHouseProfile } from './utils/clientDbFallback.ts';
import { formatVND } from './utils/formatters.ts';

// UI Components
import { RoomCard } from './components/RoomCard.tsx';
import { RoomSpreadsheetView } from './components/RoomSpreadsheetView.tsx';
import { QuickCollectModal } from './components/QuickCollectModal.tsx';
import { ReceiptModal } from './components/ReceiptModal.tsx';
import { MeterWalkthroughModal } from './components/MeterWalkthroughModal.tsx';
import { RoomDetailModal } from './components/RoomDetailModal.tsx';
import { AcceptanceTestSuiteModal } from './components/AcceptanceTestSuiteModal.tsx';
import { Day10ReminderModal } from './components/Day10ReminderModal.tsx';
import { TenantPortalView } from './components/TenantPortalView.tsx';
import { InvoiceManagerModal } from './components/InvoiceManagerModal.tsx';
import { MaintenanceModal } from './components/MaintenanceModal.tsx';
import { ExpensesModal } from './components/ExpensesModal.tsx';
import { BackupRestoreModal } from './components/BackupRestoreModal.tsx';
import { AuditLogModal } from './components/AuditLogModal.tsx';
import { SetupWizardModal } from './components/SetupWizardModal.tsx';
import { ZaloCalculatorModal } from './components/ZaloCalculatorModal.tsx';

// Icons
import {
  Zap,
  Bell,
  RotateCcw,
  History,
  LogOut,
  Settings,
  LayoutGrid,
  Table,
  Search,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Users,
  Calendar,
  Palette,
} from 'lucide-react';

export default function App() {
  // Global App States
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [, setMode] = useState<'live' | 'demo'>('live');
  const [currentPeriod, setCurrentPeriod] = useState<string>('2026-10');

  // Business Data
  const [profile, setProfile] = useState<HouseProfile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenancies, setTenancies] = useState<TenancyStay[]>([]);
  const [meters, setMeters] = useState<MeterReading[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [expenses, setExpenses] = useState<HouseExpense[]>([]);

  // View & Filtering States
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'vacant'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [themeBg, setThemeBg] = useState<'xanh-ngoc' | 'xanh-duong' | 'xanh-sky' | 'xanh-navy'>('xanh-ngoc');

  const bgClassMap = {
    'xanh-ngoc': 'bg-[#EAF5F1] text-slate-900',
    'xanh-duong': 'bg-[#EFF4FA] text-slate-900',
    'xanh-sky': 'bg-[#EFF6FF] text-slate-900',
    'xanh-navy': 'bg-[#0B1727] text-slate-100',
  };

  // Active Modals
  const [collectRoomId, setCollectRoomId] = useState<string | null>(null);
  const [activeReceiptPayment, setActiveReceiptPayment] = useState<Payment | null>(null);
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState<boolean>(false);
  const [showTestSuite, setShowTestSuite] = useState<boolean>(false);
  const [showReminder, setShowReminder] = useState<boolean>(false);
  const [showInvoiceManager, setShowInvoiceManager] = useState<boolean>(false);
  const [showMaintenance, setShowMaintenance] = useState<boolean>(false);
  const [, setShowExpenses] = useState<boolean>(false);
  const [, setShowBackup] = useState<boolean>(false);
  const [showAudit, setShowAudit] = useState<boolean>(false);
  const [, setShowSetup] = useState<boolean>(false);
  const [zaloCalcRoomId, setZaloCalcRoomId] = useState<string | null>(null);

  // Initialize and load session
  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'landlord') {
      loadAllData();
    }
  }, [currentPeriod]);

  const bootstrap = async () => {
    setLoading(true);
    try {
      let meRes = await api.getMe();
      if (!meRes) {
        meRes = await api.login('chutro');
      }
      setCurrentUser(meRes.user);
      setMode(meRes.mode);
      await loadAllData();
    } catch (err) {
      console.error('Bootstrap error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async () => {
    try {
      const [houseRes, roomsData, invsData, paysData, tenantsData, metersData, tixData, expData] =
        await Promise.all([
          api.getHouse(),
          api.getRooms(),
          api.getInvoices({ period: currentPeriod }),
          api.getPayments(),
          api.getTenants(),
          api.getMeters(),
          api.getMaintenance(),
          api.getExpenses(),
        ]);

      let validRooms = roomsData;
      if (!validRooms || validRooms.length === 0) {
        const fallbackDb = getClientFallbackDb();
        validRooms = fallbackDb.rooms;
      }

      setProfile(houseRes?.profile || getDefaultHouseProfile());
      setRooms(validRooms);
      setInvoices(invsData || []);
      setPayments(paysData || []);
      setTenants(tenantsData?.tenants && tenantsData.tenants.length > 0 ? tenantsData.tenants : getClientFallbackDb().tenants);
      setTenancies(tenantsData?.tenancies && tenantsData.tenancies.length > 0 ? tenantsData.tenancies : getClientFallbackDb().tenancies);
      setMeters(metersData || []);
      setTickets(tixData || []);
      setExpenses(expData || []);
    } catch (err) {
      console.error('Error loading data:', err);
      const fallbackDb = getClientFallbackDb();
      setProfile(fallbackDb.profile);
      setRooms(fallbackDb.rooms);
      setTenants(fallbackDb.tenants);
      setTenancies(fallbackDb.tenancies);
    }
  };

  const handleSwitchUserRole = async (username: string) => {
    setLoading(true);
    try {
      const res = await api.login(username);
      setCurrentUser(res.user);
      setMode(res.mode);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi chuyển tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  // KPI Summary Calculations
  const periodInvoices = invoices.filter((i) => i.periodMonth === currentPeriod && i.status !== 'cancelled');

  const totalExpectedRevenue = periodInvoices.reduce((acc, inv) => acc + inv.currentCycleTotal, 0);

  const paidInvoices = periodInvoices.filter((i) => i.remainingBalance <= 0);
  const totalPaidAmount = paidInvoices.reduce((acc, inv) => acc + (inv.currentCycleTotal - inv.remainingBalance), 0);
  const paidRoomsCount = paidInvoices.length;

  const unpaidInvoices = periodInvoices.filter((i) => i.remainingBalance > 0);
  const totalUnpaidAmount = unpaidInvoices.reduce((acc, inv) => acc + inv.remainingBalance, 0);
  const unpaidRoomsCount = unpaidInvoices.length;

  const rentedRoomsCount = rooms.filter((r) => r.status === 'rented').length;
  const totalRoomsCount = rooms.length || 9;
  const occupancyRatePercent = Math.round((rentedRoomsCount / totalRoomsCount) * 100);

  // Filtered rooms
  const displayedRooms = rooms.filter((room) => {
    const stay = tenancies.find((s) => s.id === room.currentStayId);
    const tenantName = stay?.representativeName || '';
    const matchesSearch =
      room.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenantName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const inv = invoices.find((i) => i.roomId === room.id && i.periodMonth === currentPeriod);
    const isRented = room.status === 'rented';

    if (statusFilter === 'unpaid') {
      return isRented && inv && inv.remainingBalance > 0;
    }
    if (statusFilter === 'paid') {
      return isRented && inv && inv.remainingBalance <= 0;
    }
    return true;
  });

  // Formatted Vietnamese period label
  const [yearVal, monthVal] = currentPeriod.split('-');
  const periodLabelFormatted = `Tháng ${monthVal}/${yearVal}`;

  const vacantRoomsCount = rooms.filter((r) => r.status === 'vacant').length;

  const handleRollForwardMonth = async () => {
    const [year, month] = currentPeriod.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    const nextY = nextDate.getFullYear();
    const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nextPeriodStr = `${nextY}-${nextM}`;

    if (!confirm(`Bạn có chắc chắn muốn kết chuyển chỉ số Điện/Nước kỳ ${periodLabelFormatted} sang kỳ mới Tháng ${nextM}/${nextY}?`)) {
      return;
    }

    setLoading(true);
    try {
      for (const room of rooms) {
        if (room.status === 'rented') {
          const curReading = meters.find((m) => m.roomId === room.id && m.period === currentPeriod);
          const curEEnd = curReading ? curReading.electricEnd : (room.currentMeter?.electricNumber ?? 1280);
          const curWEnd = curReading ? curReading.waterEnd : (room.currentMeter?.waterNumber ?? 350);

          await api.recordMeter({
            roomId: room.id,
            period: nextPeriodStr,
            electricStart: curEEnd,
            electricEnd: curEEnd,
            waterStart: curWEnd,
            waterEnd: curWEnd,
            electricRate: profile?.electricityDefaultRate ?? 3500,
            waterRate: profile?.waterDefaultRate ?? 20000,
          });
        }
      }

      await api.generateInvoices(nextPeriodStr);
      setCurrentPeriod(nextPeriodStr);
      alert(`Đã kết chuyển chỉ số & khởi tạo thành công Kỳ thu Tháng ${nextM}/${nextY}!`);
    } catch (err: any) {
      alert(`Lỗi khi kết chuyển: ${err.message || 'Kiểm tra lại dữ liệu'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300 gap-3">
        <RotateCcw className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="font-semibold text-sm">Đang tải dữ liệu 9 phòng trọ...</p>
      </div>
    );
  }

  // Tenant Portal View (Isolated Security View)
  if (currentUser?.role === 'tenant') {
    const tenantRoom = rooms.find((r) => r.id === currentUser.roomId) || rooms[0];
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        <header className="bg-slate-850 border-b border-slate-800 px-4 py-3 sticky top-0 z-40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
              9P
            </span>
            <div>
              <span className="font-black text-sm text-white">TroXanh</span>
              <span className="text-[11px] text-slate-400 ml-1.5 font-medium">• Phòng {tenantRoom?.code}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 font-medium">{currentUser.fullName}</span>
            <button
              onClick={() => handleSwitchUserRole('chutro')}
              className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
              title="Chuyển về Quản lý"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đổi tài khoản</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-5">
          {tenantRoom && profile && (
            <TenantPortalView
              room={tenantRoom}
              profile={profile}
              invoices={invoices}
              payments={payments}
              onOpenMaintenanceModal={() => setShowMaintenance(true)}
            />
          )}
        </main>

        {showMaintenance && currentUser && (
          <MaintenanceModal
            currentUser={currentUser}
            rooms={rooms}
            tickets={tickets}
            onClose={() => setShowMaintenance(false)}
            onRefresh={loadAllData}
          />
        )}
      </div>
    );
  }

  // Management Main Dashboard View
  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col selection:bg-indigo-500 selection:text-white font-sans antialiased ${bgClassMap[themeBg]}`}>
      {/* 1. OPTIMIZED HEADER */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4 overflow-x-auto">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-base sm:text-lg shadow-sm shrink-0">
              9P
            </div>
            <div className="whitespace-nowrap">
              <h1 className="font-black text-xl sm:text-2xl text-slate-950 tracking-tight leading-tight whitespace-nowrap">
                Hóa Đơn Tiền Nhà
              </h1>
              <div className="text-xs text-slate-500 font-semibold mt-0.5">
                <span>Hạn thu: <strong className="text-slate-900 font-extrabold">Ngày 10 hằng tháng</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Color Dots Theme Selector (24x24px) */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setThemeBg('xanh-ngoc')}
                className={`w-6 h-6 rounded-full bg-emerald-500 transition-all cursor-pointer ${
                  themeBg === 'xanh-ngoc' ? 'ring-2 ring-emerald-600 ring-offset-2 scale-110' : 'hover:scale-105 opacity-80'
                }`}
                title="Xanh Ngọc Emerald"
              />
              <button
                type="button"
                onClick={() => setThemeBg('xanh-duong')}
                className={`w-6 h-6 rounded-full bg-indigo-600 transition-all cursor-pointer ${
                  themeBg === 'xanh-duong' ? 'ring-2 ring-indigo-600 ring-offset-2 scale-110' : 'hover:scale-105 opacity-80'
                }`}
                title="Xanh Dương Slate"
              />
              <button
                type="button"
                onClick={() => setThemeBg('xanh-sky')}
                className={`w-6 h-6 rounded-full bg-sky-400 transition-all cursor-pointer ${
                  themeBg === 'xanh-sky' ? 'ring-2 ring-sky-500 ring-offset-2 scale-110' : 'hover:scale-105 opacity-80'
                }`}
                title="Xanh Băng Sky"
              />
              <button
                type="button"
                onClick={() => setThemeBg('xanh-navy')}
                className={`w-6 h-6 rounded-full bg-slate-900 transition-all cursor-pointer ${
                  themeBg === 'xanh-navy' ? 'ring-2 ring-slate-900 ring-offset-2 scale-110' : 'hover:scale-105 opacity-80'
                }`}
                title="Xanh Navy Đêm"
              />
            </div>

            {/* Quick Bank & Default Rate Settings Button */}
            <button
              onClick={() => setShowSetup(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs sm:text-sm font-extrabold text-indigo-700 transition-colors shadow-2xs whitespace-nowrap"
              title="Cài đặt ngân hàng & đơn giá điện nước mặc định"
            >
              <Settings className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="whitespace-nowrap">Cài đặt (Ngân hàng & Đơn giá)</span>
            </button>

            {/* Single Period Selector in Vietnamese with Prev/Next Navigation */}
            <div className="flex items-center gap-1 bg-slate-100/90 border border-slate-200 rounded-xl px-2 py-1.5 text-xs sm:text-sm font-extrabold text-slate-800 shadow-2xs whitespace-nowrap">
              <button
                type="button"
                onClick={() => {
                  const [y, m] = currentPeriod.split('-').map(Number);
                  const d = new Date(y, m - 2, 1);
                  setCurrentPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-700 font-black text-sm"
                title="Tháng trước"
              >
                ‹
              </button>
              <div className="flex items-center gap-1 px-1">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-slate-950 font-black whitespace-nowrap">{periodLabelFormatted}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const [y, m] = currentPeriod.split('-').map(Number);
                  const d = new Date(y, m, 1);
                  setCurrentPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-700 font-black text-sm"
                title="Tháng sau"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4">
        {/* FINANCIAL SUMMARY STRIP (KPI Strip) */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-extrabold">
          <div className="flex items-center gap-1.5 text-slate-800">
            <span className="text-slate-500 font-bold">Tổng phải thu (9 phòng):</span>
            <span className="font-black text-slate-950 tabular-nums text-base">{formatVND(totalExpectedRevenue)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-bold">Đã thu ({paidRoomsCount} phòng):</span>
            <span className="font-black text-emerald-600 tabular-nums">{formatVND(totalPaidAmount)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="font-bold">Cần thu ({unpaidRoomsCount} phòng):</span>
            <span className="font-black text-amber-600 tabular-nums">{formatVND(totalUnpaidAmount)}</span>
          </div>
        </div>

        {/* 3. CONTROL TOOLBAR (Hàng dưới) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm phòng hoặc tên khách..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold text-slate-900"
              />
            </div>

            {/* Status Filter Tabs (Sums exactly to 9) */}
            <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs sm:text-sm font-extrabold gap-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-950 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({rooms.length})
              </button>
              <button
                onClick={() => setStatusFilter('unpaid')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'unpaid'
                    ? 'bg-amber-500 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chưa thu ({unpaidRoomsCount})
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'paid'
                    ? 'bg-emerald-600 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đã thu ({paidRoomsCount})
              </button>
              <button
                onClick={() => setStatusFilter('vacant')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'vacant'
                    ? 'bg-slate-700 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Phòng trống ({vacantRoomsCount})
              </button>
            </div>

            {/* Action Buttons & View Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-all shadow-2xs ${
                  viewMode === 'table'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <Table className="w-4 h-4 shrink-0" />
                <span>Bảng nhập nhanh (Excel Mode)</span>
              </button>

              <button
                onClick={handleRollForwardMonth}
                className="py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-2xs"
                title="Lấy số mới kỳ này gán thành số cũ kỳ sau và khởi tạo tháng mới"
              >
                <RotateCcw className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap">Kết chuyển sang kỳ mới</span>
              </button>

              <button
                onClick={() => setShowReminder(true)}
                className="py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Bell className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Nhắc tiền ngày 10 ({unpaidRoomsCount})</span>
              </button>

              <button
                onClick={() => setShowAudit(true)}
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <History className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Nhật ký</span>
              </button>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500'
                  }`}
                  title="Xem dạng Lưới Thẻ"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'table' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500'
                  }`}
                  title="Xem dạng Bảng Excel"
                >
                  <Table className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* DISPLAYED ROOMS VIEW (GRID OR TABLE) */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {displayedRooms.map((room) => {
              const inv = invoices.find((i) => i.roomId === room.id && i.periodMonth === currentPeriod);
              const mr = meters.find((m) => m.roomId === room.id && m.period === currentPeriod);
              const stay = tenancies.find((s) => s.id === room.currentStayId);
              return (
                <RoomCard
                  key={room.id}
                  room={room}
                  currentInvoice={inv}
                  meterReading={mr}
                  tenantName={stay?.representativeName}
                  tenantPhone={stay?.representativePhone}
                  currentStayId={stay?.id}
                  currentPeriod={currentPeriod}
                  onCollect={(rId) => setCollectRoomId(rId)}
                  onViewDetails={(r) => setDetailRoom(r)}
                  onOpenZalo={(rId) => setZaloCalcRoomId(rId)}
                  onRefresh={loadAllData}
                />
              );
            })}
          </div>
        ) : (
          <RoomSpreadsheetView
            rooms={displayedRooms}
            invoices={invoices}
            meters={meters}
            tenancies={tenancies}
            currentPeriod={currentPeriod}
            onCollect={(rId) => setCollectRoomId(rId)}
            onViewDetails={(r) => setDetailRoom(r)}
            onOpenZalo={(rId) => setZaloCalcRoomId(rId)}
            onWalkthrough={() => setShowWalkthrough(true)}
            onRefresh={loadAllData}
          />
        )}
      </main>

      {/* ACTIVE MODALS */}
      {collectRoomId && (
        <QuickCollectModal
          initialRoomId={collectRoomId}
          rooms={rooms}
          invoices={invoices}
          onClose={() => setCollectRoomId(null)}
          onSuccess={(payment) => {
            setCollectRoomId(null);
            setActiveReceiptPayment(payment);
            loadAllData();
          }}
        />
      )}

      {activeReceiptPayment && (
        <ReceiptModal
          payment={activeReceiptPayment}
          room={rooms.find((r) => r.id === activeReceiptPayment.roomId)}
          onClose={() => setActiveReceiptPayment(null)}
        />
      )}

      {showWalkthrough && (
        <MeterWalkthroughModal
          rooms={rooms}
          currentPeriod={currentPeriod}
          onClose={() => setShowWalkthrough(false)}
          onSuccess={() => {
            setShowWalkthrough(false);
            loadAllData();
          }}
        />
      )}

      {detailRoom && (
        <RoomDetailModal
          room={detailRoom}
          stay={tenancies.find((s) => s.id === detailRoom.currentStayId)}
          tenants={tenants}
          invoices={invoices}
          meters={meters}
          currentPeriod={currentPeriod}
          onClose={() => setDetailRoom(null)}
          onRefresh={loadAllData}
          onOpenZalo={(rId) => {
            setDetailRoom(null);
            setZaloCalcRoomId(rId);
          }}
          onCollect={(rId) => {
            setDetailRoom(null);
            setCollectRoomId(rId);
          }}
        />
      )}

      {showTestSuite && (
        <AcceptanceTestSuiteModal onClose={() => setShowTestSuite(false)} />
      )}

      {showReminder && profile && (
        <Day10ReminderModal
          profile={profile}
          currentPeriod={currentPeriod}
          onClose={() => setShowReminder(false)}
          onRefresh={loadAllData}
        />
      )}

      {showInvoiceManager && (
        <InvoiceManagerModal
          invoices={invoices}
          rooms={rooms}
          currentPeriod={currentPeriod}
          onClose={() => setShowInvoiceManager(false)}
          onRefresh={loadAllData}
        />
      )}

      {showMaintenance && currentUser && (
        <MaintenanceModal
          currentUser={currentUser}
          rooms={rooms}
          tickets={tickets}
          onClose={() => setShowMaintenance(false)}
          onRefresh={loadAllData}
        />
      )}

      {showAudit && (
        <AuditLogModal onClose={() => setShowAudit(false)} />
      )}

      {zaloCalcRoomId && profile && (
        <ZaloCalculatorModal
          initialRoomId={zaloCalcRoomId}
          rooms={rooms}
          profile={profile}
          currentPeriod={currentPeriod}
          meterReadings={meters}
          invoices={invoices}
          onClose={() => setZaloCalcRoomId(null)}
          onSuccess={() => {
            loadAllData();
          }}
        />
      )}
    </div>
  );
}
