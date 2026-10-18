import React, { useState, useEffect, useMemo } from 'react';
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
  AppDatabase,
} from './types/index.ts';
import { api } from './services/api.ts';
import {
  getClientFallbackDb,
  getDefaultHouseProfile,
  rollForwardPeriodClient,
  VIETNAMESE_TENANT_NAMES,
  saveClientFallbackDb,
} from './utils/clientDbFallback.ts';
import { formatVND } from './utils/formatters.ts';
import { calculateRoomBillingBreakdown } from './utils/billingCalculator.ts';

// UI Components
import { RoomCard } from './components/RoomCard.tsx';
import { RoomSpreadsheetView } from './components/RoomSpreadsheetView.tsx';
import { RoomFloorPlanView } from './components/RoomFloorPlanView.tsx';
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
import { BillingAdjustmentModal } from './components/BillingAdjustmentModal.tsx';

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
  CheckCircle2,
  AlertCircle,
  Calendar,
  Type,
  Building2,
  Receipt,
  Wrench,
  Database,
  Banknote,
  DollarSign,
  ShieldCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Home,
  UserCheck,
  Eye,
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
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'floorplan'>('grid');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'vacant'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [themeBg, setThemeBg] = useState<'xanh-ngoc' | 'xanh-duong' | 'xanh-sky' | 'xanh-navy'>('xanh-ngoc');
  const [textHeight, setTextHeight] = useState<'sm' | 'md' | 'lg'>(() => {
    try {
      const saved = localStorage.getItem('troxanh_text_height');
      if (saved === 'sm' || saved === 'md' || saved === 'lg') return saved;
    } catch {}
    return 'md';
  });

  // Toast Notification System
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMsg({ type, text });
    setTimeout(() => {
      setToastMsg((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    try {
      localStorage.setItem('troxanh_text_height', textHeight);
    } catch {}
    const root = document.documentElement;
    root.classList.remove('text-scale-sm', 'text-scale-md', 'text-scale-lg');
    root.classList.add(`text-scale-${textHeight}`);
  }, [textHeight]);

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
  const [adjustmentRoom, setAdjustmentRoom] = useState<Room | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState<boolean>(false);
  const [showTestSuite, setShowTestSuite] = useState<boolean>(false);
  const [showReminder, setShowReminder] = useState<boolean>(false);
  const [showInvoiceManager, setShowInvoiceManager] = useState<boolean>(false);
  const [showMaintenance, setShowMaintenance] = useState<boolean>(false);
  const [showExpenses, setShowExpenses] = useState<boolean>(false);
  const [showBackup, setShowBackup] = useState<boolean>(false);
  const [showAudit, setShowAudit] = useState<boolean>(false);
  const [showSetup, setShowSetup] = useState<boolean>(false);
  const [showRollForwardConfirm, setShowRollForwardConfirm] = useState<boolean>(false);
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
    // 1. Immediately populate from localStorage - NEVER block UI or show permanent spinner
    const initialDb = getClientFallbackDb();
    setProfile(initialDb.profile);
    setRooms(initialDb.rooms);
    setInvoices(initialDb.invoices || []);
    setPayments(initialDb.payments || []);
    setTenants(initialDb.tenants || []);
    setTenancies(initialDb.tenancies || []);
    setMeters(initialDb.meterReadings || []);
    setTickets(initialDb.maintenanceTickets || []);
    setExpenses(initialDb.expenses || []);
    setLoading(false);

    try {
      let meRes = await api.getMe();
      if (!meRes) {
        meRes = await api.login('chutro');
      }
      if (meRes?.user) {
        setCurrentUser(meRes.user);
        setMode(meRes.mode);
      }
    } catch {
      setCurrentUser({
        id: 'u_chutro',
        username: 'chutro',
        role: 'landlord',
        fullName: 'Chủ Trọ Xanh',
        phone: '0901234567',
        createdAt: new Date().toISOString(),
      });
    }

    loadAllData();
  };

  const loadAllData = async () => {
    // Read from client localStorage state first
    const clientDb = getClientFallbackDb();
    if (clientDb.profile) setProfile(clientDb.profile);
    if (clientDb.rooms && clientDb.rooms.length > 0) setRooms(clientDb.rooms);
    if (clientDb.invoices) setInvoices(clientDb.invoices);
    if (clientDb.payments) setPayments(clientDb.payments);
    if (clientDb.tenants) setTenants(clientDb.tenants);
    if (clientDb.tenancies) setTenancies(clientDb.tenancies);
    if (clientDb.meterReadings) setMeters(clientDb.meterReadings);
    if (clientDb.maintenanceTickets) setTickets(clientDb.maintenanceTickets);
    if (clientDb.expenses) setExpenses(clientDb.expenses);

    // Try background server sync with graceful fallback
    try {
      const [
        houseData,
        roomsData,
        invsData,
        paysData,
        metersData,
        tixData,
        expData,
      ] = await Promise.all([
        api.getHouse().catch(() => null),
        api.getRooms().catch(() => null),
        api.getInvoices().catch(() => null),
        api.getPayments().catch(() => null),
        api.getMeters().catch(() => null),
        api.getMaintenance().catch(() => null),
        api.getExpenses().catch(() => null),
      ]);

      if (houseData?.profile) setProfile(houseData.profile);
      if (roomsData && roomsData.length > 0) setRooms(roomsData);
      if (invsData && invsData.length > 0) setInvoices(invsData);
      if (paysData && paysData.length > 0) setPayments(paysData);
      if (metersData && metersData.length > 0) setMeters(metersData);
      if (tixData && tixData.length > 0) setTickets(tixData);
      if (expData && expData.length > 0) setExpenses(expData);

      // Persist latest synced state into localStorage fallback DB
      const currentDb = getClientFallbackDb();
      saveClientFallbackDb({
        ...currentDb,
        profile: houseData?.profile || currentDb.profile,
        rooms: roomsData && roomsData.length > 0 ? roomsData : currentDb.rooms,
        invoices: invsData && invsData.length > 0 ? invsData : currentDb.invoices,
        payments: paysData && paysData.length > 0 ? paysData : currentDb.payments,
        meterReadings: metersData && metersData.length > 0 ? metersData : currentDb.meterReadings,
        maintenanceTickets: tixData && tixData.length > 0 ? tixData : currentDb.maintenanceTickets,
        expenses: expData && expData.length > 0 ? expData : currentDb.expenses,
      });
    } catch (err) {
      console.warn('Background sync notice (relying on localStorage):', err);
    }
  };

  const handleSwitchUserRole = async (username: string) => {
    try {
      const res = await api.login(username);
      setCurrentUser(res.user);
      setMode(res.mode);
      await loadAllData();
      showToast(`Đã chuyển sang chế độ ${username === 'chutro' ? 'Chủ trọ' : 'Khách thuê'}`, 'info');
    } catch {
      showToast('Lỗi khi chuyển đổi quyền truy cập', 'error');
    }
  };

  const handleSwitchTenantPortalForRoom = async (roomId: string) => {
    try {
      const res = await api.login('khachthue');
      setCurrentUser({
        ...res.user,
        roomId: roomId,
      });
      const room = rooms.find((r) => r.id === roomId);
      showToast(`Đã mở Cổng Khách Thuê cho phòng ${room ? room.code : ''}`, 'info');
    } catch {
      showToast('Lỗi khi mở Cổng Khách Thuê', 'error');
    }
  };

  // KPI Summary Calculations directly derived from 9 rooms of current period
  const roomCalculations = useMemo(() => {
    let totalExpectedRevenue = 0;
    let totalPaidAmount = 0;
    let totalUnpaidAmount = 0;
    let paidRoomsCount = 0;
    let unpaidRoomsCount = 0;
    let vacantRoomsCount = 0;

    const roomDetails = rooms.map((room) => {
      const isRented = room.status === 'rented';
      if (!isRented) {
        vacantRoomsCount++;
        return {
          room,
          isRented: false,
          isPaid: false,
          totalBill: 0,
          paidAmount: 0,
          remainingBalance: 0,
        };
      }

      const inv = invoices.find(
        (i) => i.roomId === room.id && i.periodMonth === currentPeriod && i.status !== 'cancelled'
      );
      const reading = meters.find((m) => m.roomId === room.id && m.period === currentPeriod);

      const bd = calculateRoomBillingBreakdown({
        room,
        currentPeriod,
        invoice: inv,
        meterReading: reading,
        profile: profile || undefined,
        payments,
        allInvoices: invoices,
      });

      totalExpectedRevenue += bd.totalExpected;
      totalPaidAmount += bd.paidAmount;
      totalUnpaidAmount += bd.remainingBalance;

      if (bd.isPaid) {
        paidRoomsCount++;
      } else {
        unpaidRoomsCount++;
      }

      return {
        room,
        isRented: true,
        isPaid: bd.isPaid,
        totalBill: bd.totalExpected,
        paidAmount: bd.paidAmount,
        remainingBalance: bd.remainingBalance,
      };
    });

    const collectionRate = totalExpectedRevenue > 0
      ? Math.round((totalPaidAmount / totalExpectedRevenue) * 100)
      : 0;

    return {
      totalExpectedRevenue,
      totalPaidAmount,
      totalUnpaidAmount,
      paidRoomsCount,
      unpaidRoomsCount,
      vacantRoomsCount,
      totalRoomsCount: rooms.length,
      collectionRate,
      roomDetails,
    };
  }, [rooms, meters, invoices, payments, currentPeriod, profile]);

  // Filtered rooms based on derived state
  const displayedRooms = rooms.filter((room) => {
    const detail = roomCalculations.roomDetails.find((d) => d.room.id === room.id);
    const isRented = room.status === 'rented';
    const isPaid = detail?.isPaid ?? false;

    const stay = tenancies.find((s) => s.id === room.currentStayId);
    const tenantMeta = VIETNAMESE_TENANT_NAMES[room.code];
    const tenantName = stay?.representativeName || tenantMeta?.name || '';
    const matchesSearch =
      room.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenantName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'unpaid') return isRented && !isPaid;
    if (statusFilter === 'paid') return isRented && isPaid;
    if (statusFilter === 'vacant') return !isRented;
    return true;
  });

  // Formatted Vietnamese period label
  const [yearVal, monthVal] = currentPeriod.split('-');
  const periodLabelFormatted = `Tháng ${monthVal}/${yearVal}`;

  const executeRollForward = () => {
    const [year, month] = currentPeriod.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    const nextY = nextDate.getFullYear();
    const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');

    try {
      const currentDb: AppDatabase = {
        profile: profile || getDefaultHouseProfile(),
        rooms,
        invoices,
        payments,
        tenants,
        tenancies,
        meterReadings: meters,
        depositTransactions: [],
        advanceBalances: [],
        expenses,
        maintenanceTickets: tickets,
        users: currentUser ? [currentUser] : [],
        auditLogs: [],
        lastBackupDate: new Date().toISOString(),
        version: 1,
      };

      const { db: newDb, nextPeriod } = rollForwardPeriodClient(currentDb, currentPeriod);
      setRooms(newDb.rooms);
      setMeters(newDb.meterReadings);
      setInvoices(newDb.invoices);
      setCurrentPeriod(nextPeriod);
      setShowRollForwardConfirm(false);
      showToast(
        `Đã kết chuyển thành công sang Tháng ${nextM}/${nextY}! Tất cả 9 phòng đã chuyển về Chưa thu.`,
        'success'
      );
    } catch (err: any) {
      setShowRollForwardConfirm(false);
      showToast(`Lỗi khi kết chuyển: ${err.message || 'Kiểm tra lại dữ liệu'}`, 'error');
    }
  };

  const handlePrevMonth = () => {
    const [y, m] = currentPeriod.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setCurrentPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentPeriod.split('-').map(Number);
    const d = new Date(y, m, 1);
    setCurrentPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
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
              <span className="font-black text-sm text-white">TrọXanh Pro</span>
              <span className="text-[11px] text-slate-400 ml-1.5 font-medium">• Phòng {tenantRoom?.code}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 3 Lựa chọn Chiều cao chữ (Tenant Portal) */}
            <div className="flex items-center gap-0.5 bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-2xs">
              <Type className="w-3.5 h-3.5 text-emerald-400 mx-1 shrink-0" />
              <button
                type="button"
                onClick={() => setTextHeight('sm')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  textHeight === 'sm' ? 'bg-emerald-600 text-white font-black' : 'text-slate-400 hover:text-white'
                }`}
                title="Chiều cao chữ: Nhỏ (16px - dòng 1.35)"
              >
                Nhỏ
              </button>
              <button
                type="button"
                onClick={() => setTextHeight('md')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  textHeight === 'md' ? 'bg-emerald-600 text-white font-black' : 'text-slate-400 hover:text-white'
                }`}
                title="Chiều cao chữ: Tiêu chuẩn (18px - dòng 1.5)"
              >
                Vừa
              </button>
              <button
                type="button"
                onClick={() => setTextHeight('lg')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  textHeight === 'lg' ? 'bg-emerald-600 text-white font-black' : 'text-slate-400 hover:text-white'
                }`}
                title="Chiều cao chữ: Lớn (20px - dòng 1.65)"
              >
                Lớn
              </button>
            </div>

            <button
              onClick={() => handleSwitchUserRole('chutro')}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Về màn hình Chủ trọ</span>
            </button>
          </div>
        </header>

        {tenantRoom && profile && (
          <TenantPortalView
            room={tenantRoom}
            profile={profile}
            invoices={invoices.filter((i) => i.roomId === tenantRoom.id)}
            payments={payments.filter((p) => p.roomId === tenantRoom.id)}
            onOpenMaintenanceModal={() => setShowMaintenance(true)}
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
      </div>
    );
  }

  // Management Main Dashboard View
  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col selection:bg-indigo-500 selection:text-white font-sans antialiased ${bgClassMap[themeBg]}`}>
      {/* FLOATING TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-xl text-xs sm:text-sm font-bold border backdrop-blur-md ${
              toastMsg.type === 'error'
                ? 'bg-rose-900/95 text-white border-rose-700 shadow-rose-950/40'
                : toastMsg.type === 'info'
                ? 'bg-indigo-900/95 text-white border-indigo-700 shadow-indigo-950/40'
                : 'bg-emerald-900/95 text-white border-emerald-700 shadow-emerald-950/40'
            }`}
          >
            {toastMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* 1. TOP HEADER BAR */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Brand Wordmark & Metadata */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-700 to-slate-900 text-white flex items-center justify-center font-black text-sm sm:text-base shadow-sm shrink-0 tracking-wider">
              9P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg sm:text-xl text-slate-950 tracking-tight leading-tight whitespace-nowrap">
                  TrọXanh Pro
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  9 Phòng Trọ
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap shrink-0">
            {/* Single Period Selector with 44px Touch Target Navigation */}
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs sm:text-sm font-extrabold text-slate-800 shadow-2xs whitespace-nowrap">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-700 font-black text-base transition-colors cursor-pointer"
                title="Tháng trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-slate-950 font-black whitespace-nowrap text-xs sm:text-sm">
                  {periodLabelFormatted}
                </span>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-700 font-black text-base transition-colors cursor-pointer"
                title="Tháng sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 3 Lựa chọn Chiều cao chữ (Text Height Selector) */}
            <div
              className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs"
              title="3 lựa chọn chiều cao & kích cỡ chữ toàn ứng dụng"
            >
              <div className="flex items-center gap-1 px-1 text-slate-600 font-bold text-xs">
                <Type className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              </div>
              <button
                type="button"
                onClick={() => setTextHeight('sm')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[32px] flex items-center ${
                  textHeight === 'sm'
                    ? 'bg-white text-indigo-700 shadow-xs font-black ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Cỡ chữ Nhỏ (16px - dòng 1.35)"
              >
                Nhỏ
              </button>
              <button
                type="button"
                onClick={() => setTextHeight('md')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[32px] flex items-center ${
                  textHeight === 'md'
                    ? 'bg-white text-indigo-700 shadow-xs font-black ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Cỡ chữ Tiêu chuẩn (18px - dòng 1.5)"
              >
                Vừa
              </button>
              <button
                type="button"
                onClick={() => setTextHeight('lg')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[32px] flex items-center ${
                  textHeight === 'lg'
                    ? 'bg-white text-indigo-700 shadow-xs font-black ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Cỡ chữ Lớn (20px - dòng 1.65)"
              >
                Lớn
              </button>
            </div>

            {/* Color Dots Theme Selector */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setThemeBg('xanh-ngoc')}
                className={`w-6 h-6 rounded-full bg-emerald-500 transition-all cursor-pointer ${
                  themeBg === 'xanh-ngoc' ? 'ring-2 ring-emerald-600 ring-offset-2 scale-110' : 'hover:scale-105 opacity-80'
                }`}
                title="Xanh Ngọc"
              />
              <button
                type="button"
                onClick={() => setThemeBg('xanh-duong')}
                className={`w-6 h-6 rounded-full bg-indigo-600 transition-all cursor-pointer ${
                  themeBg === 'xanh-duong' ? 'ring-2 ring-indigo-600 ring-offset-2 scale-110' : 'hover:scale-105 opacity-80'
                }`}
                title="Xanh Dương"
              />
              <button
                type="button"
                onClick={() => setThemeBg('xanh-sky')}
                className={`w-6 h-6 rounded-full bg-sky-400 transition-all cursor-pointer ${
                  themeBg === 'xanh-sky' ? 'ring-2 ring-sky-500 ring-offset-2 scale-110' : 'hover:scale-105 opacity-80'
                }`}
                title="Xanh Sky"
              />
              <button
                type="button"
                onClick={() => setThemeBg('xanh-navy')}
                className={`w-6 h-6 rounded-full bg-slate-900 transition-all cursor-pointer ${
                  themeBg === 'xanh-navy' ? 'ring-2 ring-slate-900 ring-offset-2 scale-110' : 'hover:scale-105 opacity-80'
                }`}
                title="Xanh Navy"
              />
            </div>

            {/* Quick Bank & Default Rate Settings Button */}
            <button
              onClick={() => setShowSetup(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs sm:text-sm font-extrabold text-indigo-700 transition-colors shadow-2xs whitespace-nowrap min-h-[40px] cursor-pointer"
              title="Cài đặt ngân hàng VietQR & đơn giá điện nước mặc định"
            >
              <Settings className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="whitespace-nowrap">Cài đặt (Ngân hàng & Đơn giá)</span>
            </button>

            {/* Quick Switch to Tenant Portal View */}
            <button
              type="button"
              onClick={() => handleSwitchTenantPortalForRoom(rooms[0]?.id || 'room-P01')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs sm:text-sm font-black transition-colors shadow-2xs whitespace-nowrap min-h-[40px] cursor-pointer"
              title="Mở Cổng Khách Thuê (Tenant Portal) để trải nghiệm giao diện xem & đối chiếu lịch sử hóa đơn các tháng"
            >
              <UserCheck className="w-4 h-4 text-teal-200 shrink-0" />
              <span className="whitespace-nowrap">👁️ Xem Giao Diện Khách Thuê</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4 pb-24 md:pb-8">
        {/* FINANCIAL SUMMARY STRIP (KPI Strip) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Total Due */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Tổng phải thu ({roomCalculations.totalRoomsCount} phòng)</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-slate-950 tabular-nums">
                {formatVND(roomCalculations.totalExpectedRevenue)}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">Đã gồm điện nước + DV</span>
            </div>
          </div>

          {/* Collected */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Đã thu ({roomCalculations.paidRoomsCount} phòng)</span>
              </span>
              <span className="font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">
                {roomCalculations.collectionRate}%
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-emerald-600 tabular-nums">
                {formatVND(roomCalculations.totalPaidAmount)}
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">
                {roomCalculations.paidRoomsCount}/{roomCalculations.totalRoomsCount} phòng xong
              </span>
            </div>
          </div>

          {/* Remaining */}
          <div className="bg-white rounded-2xl p-4 border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
              <span className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Cần thu ({roomCalculations.unpaidRoomsCount} phòng)</span>
              </span>
              <span className="font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-[11px]">
                Hạn ngày 10
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-amber-600 tabular-nums">
                {formatVND(roomCalculations.totalUnpaidAmount)}
              </span>
              <span className="text-[11px] font-semibold text-amber-700">
                {roomCalculations.unpaidRoomsCount > 0 ? 'Cần gửi nhắc nhở' : 'Đã thu hoàn tất!'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. CONTROL TOOLBAR & ACTION BAR */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-xs space-y-3">
          {/* Row 1: Search, Filter Tabs, and View Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Search */}
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm phòng (P01..P09) hoặc tên khách..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold text-slate-900 min-h-[40px]"
              />
            </div>

            {/* Status Filter Tabs (Sums exactly to 9) */}
            <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs sm:text-sm font-extrabold gap-1">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer min-h-[36px] flex items-center ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-950 shadow-2xs font-black ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({roomCalculations.totalRoomsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unpaid')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer min-h-[36px] flex items-center ${
                  statusFilter === 'unpaid'
                    ? 'bg-amber-500 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chưa thu ({roomCalculations.unpaidRoomsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('paid')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer min-h-[36px] flex items-center ${
                  statusFilter === 'paid'
                    ? 'bg-emerald-600 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đã thu ({roomCalculations.paidRoomsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('vacant')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer min-h-[36px] flex items-center ${
                  statusFilter === 'vacant'
                    ? 'bg-slate-700 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Phòng trống ({roomCalculations.vacantRoomsCount})
              </button>
            </div>

            {/* View Mode Switcher: Grid, Spreadsheet, Floor Plan */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px] ${
                  viewMode === 'grid'
                    ? 'bg-white text-indigo-700 shadow-2xs font-black ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem dạng Lưới Thẻ Phòng"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Dạng Thẻ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px] ${
                  viewMode === 'table'
                    ? 'bg-white text-emerald-700 shadow-2xs font-black ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem dạng Bảng tính Excel"
              >
                <Table className="w-4 h-4" />
                <span className="hidden sm:inline">Bảng Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('floorplan')}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px] ${
                  viewMode === 'floorplan'
                    ? 'bg-white text-sky-700 shadow-2xs font-black ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem Mặt Bằng 3 Tầng"
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Sơ Đồ 3 Tầng</span>
              </button>
            </div>
          </div>

          {/* Row 2: Comprehensive Management Action Buttons - Phương án 1: Trọn vẹn 8 nút trên 1 HÀNG DUY NHẤT */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 text-xs font-bold overflow-x-auto pb-0.5 scrollbar-none">
            {/* 1. Ghi điện nước */}
            <button
              type="button"
              onClick={() => setShowWalkthrough(true)}
              className="flex-1 py-2 px-1.5 sm:px-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[38px] cursor-pointer whitespace-nowrap"
              title="Ghi chỉ số điện nước nhanh"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Ghi điện nước</span>
            </button>

            {/* 2. Kết chuyển kỳ */}
            <button
              type="button"
              onClick={() => setShowRollForwardConfirm(true)}
              className="flex-1 py-2 px-1.5 sm:px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5 transition-all shadow-2xs min-h-[38px] cursor-pointer whitespace-nowrap"
              title="Lấy số mới kỳ này gán thành số cũ kỳ sau và khởi tạo tháng mới"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Kết chuyển kỳ</span>
            </button>

            {/* 3. Nhắc tiền ngày 10 */}
            <button
              type="button"
              onClick={() => setShowReminder(true)}
              className="flex-1 py-2 px-1.5 sm:px-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[38px] cursor-pointer whitespace-nowrap"
              title="Gửi tin nhắn nhắc tiền ngày 10"
            >
              <Bell className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Nhắc ngày 10</span>
              {roomCalculations.unpaidRoomsCount > 0 && (
                <span className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {roomCalculations.unpaidRoomsCount}
                </span>
              )}
            </button>

            {/* 4. Hóa đơn */}
            <button
              type="button"
              onClick={() => setShowInvoiceManager(true)}
              className="flex-1 py-2 px-1.5 sm:px-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[38px] cursor-pointer whitespace-nowrap"
              title="Quản lý hóa đơn & doanh thu"
            >
              <Receipt className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Hóa đơn</span>
            </button>

            {/* 5. Bảo trì */}
            <button
              type="button"
              onClick={() => setShowMaintenance(true)}
              className="flex-1 py-2 px-1.5 sm:px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[38px] cursor-pointer whitespace-nowrap"
              title="Yêu cầu bảo trì & sự cố"
            >
              <Wrench className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>Bảo trì</span>
              {tickets.filter((t) => t.status === 'pending' || t.status === 'in_progress').length > 0 && (
                <span className="bg-amber-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {tickets.filter((t) => t.status === 'pending' || t.status === 'in_progress').length}
                </span>
              )}
            </button>

            {/* 6. Chi phí */}
            <button
              type="button"
              onClick={() => setShowExpenses(true)}
              className="flex-1 py-2 px-1.5 sm:px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[38px] cursor-pointer whitespace-nowrap"
              title="Chi phí vận hành khu trọ"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Chi phí</span>
            </button>

            {/* 7. Sao lưu */}
            <button
              type="button"
              onClick={() => setShowBackup(true)}
              className="flex-1 py-2 px-1.5 sm:px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[38px] cursor-pointer whitespace-nowrap"
              title="Sao lưu và phục hồi dữ liệu"
            >
              <Database className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Sao lưu</span>
            </button>

            {/* 8. Nhật ký - Vị trí ô vuông màu đỏ cạnh Sao lưu */}
            <button
              type="button"
              onClick={() => setShowAudit(true)}
              className="flex-1 py-2 px-1.5 sm:px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-1.5 transition-colors shadow-2xs min-h-[38px] cursor-pointer whitespace-nowrap"
              title="Xem nhật ký lịch sử các thao tác của hệ thống"
            >
              <History className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Nhật ký</span>
            </button>
          </div>
        </div>

        {/* 3. DISPLAYED ROOMS VIEW (GRID, TABLE, OR FLOORPLAN) */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {displayedRooms.map((room) => {
              const inv = invoices.find((i) => i.roomId === room.id && i.periodMonth === currentPeriod);
              const mr = meters.find((m) => m.roomId === room.id && m.period === currentPeriod);
              const stay = tenancies.find((s) => s.id === room.currentStayId);
              const tenantMeta = VIETNAMESE_TENANT_NAMES[room.code];
              const tenant = tenants.find((t) => t.roomId === room.id && t.isRepresentative);
              const tenantName =
                stay?.representativeName && !stay.representativeName.includes('Người Thuê')
                  ? stay.representativeName
                  : tenant?.fullName || tenantMeta?.name || 'Khách thuê';
              const tenantPhone = stay?.representativePhone || tenant?.phone || tenantMeta?.phone || '';

              return (
                <RoomCard
                  key={room.id}
                  room={room}
                  currentInvoice={inv}
                  meterReading={mr}
                  tenantName={tenantName}
                  tenantPhone={tenantPhone}
                  currentStayId={stay?.id}
                  currentPeriod={currentPeriod}
                  onCollect={(rId) => setCollectRoomId(rId)}
                  onViewDetails={(r) => setDetailRoom(r)}
                  onOpenAdjustment={(r) => setAdjustmentRoom(r)}
                  onOpenZalo={(rId) => setZaloCalcRoomId(rId)}
                  onViewTenantPortal={(rId) => handleSwitchTenantPortalForRoom(rId)}
                  onRefresh={loadAllData}
                />
              );
            })}
          </div>
        )}

        {viewMode === 'table' && (
          <RoomSpreadsheetView
            rooms={displayedRooms}
            invoices={invoices}
            meters={meters}
            tenancies={tenancies}
            currentPeriod={currentPeriod}
            onCollect={(rId) => setCollectRoomId(rId)}
            onViewDetails={(r) => setDetailRoom(r)}
            onOpenAdjustment={(r) => setAdjustmentRoom(r)}
            onOpenZalo={(rId) => setZaloCalcRoomId(rId)}
            onWalkthrough={() => setShowWalkthrough(true)}
            onRefresh={loadAllData}
          />
        )}

        {viewMode === 'floorplan' && (
          <RoomFloorPlanView
            rooms={displayedRooms}
            invoices={invoices}
            meters={meters}
            tenancies={tenancies}
            currentPeriod={currentPeriod}
            onCollect={(rId) => setCollectRoomId(rId)}
            onViewDetails={(r) => setDetailRoom(r)}
            onOpenZalo={(rId) => setZaloCalcRoomId(rId)}
          />
        )}
      </main>

      {/* 4. MOBILE STICKY BOTTOM NAVIGATION BAR (Thumb Ergonomics) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 h-16 pb-safe flex items-center justify-around px-2 md:hidden shadow-lg">
        <button
          type="button"
          onClick={() => setViewMode('grid')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] cursor-pointer transition-colors ${
            viewMode === 'grid' ? 'text-indigo-600 font-black' : 'text-slate-500 font-medium'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Phòng trọ</span>
        </button>

        <button
          type="button"
          onClick={() => setShowWalkthrough(true)}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] cursor-pointer text-slate-500 hover:text-amber-600 transition-colors font-medium"
        >
          <Zap className="w-5 h-5 text-amber-500" />
          <span className="text-[10px] mt-0.5">Ghi số Đ/N</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const firstUnpaid = rooms.find((r) => {
              const inv = invoices.find((i) => i.roomId === r.id && i.periodMonth === currentPeriod);
              return r.status === 'rented' && (!inv || inv.remainingBalance > 0);
            });
            if (firstUnpaid) setCollectRoomId(firstUnpaid.id);
            else if (rooms[0]) setCollectRoomId(rooms[0].id);
          }}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] cursor-pointer text-slate-500 hover:text-emerald-600 transition-colors font-medium"
        >
          <Banknote className="w-5 h-5 text-emerald-600" />
          <span className="text-[10px] mt-0.5">Thu tiền</span>
        </button>

        <button
          type="button"
          onClick={() => setShowInvoiceManager(true)}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] cursor-pointer text-slate-500 hover:text-indigo-600 transition-colors font-medium"
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Hóa đơn</span>
        </button>

        <button
          type="button"
          onClick={() => setShowSetup(true)}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] cursor-pointer text-slate-500 hover:text-slate-900 transition-colors font-medium"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Cài đặt</span>
        </button>
      </nav>

      {/* 5. ALL ACTIVE MODALS & DIALOGS */}
      {/* Roll Forward Confirmation In-App Dialog */}
      {showRollForwardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-md p-5 text-white space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 flex items-center justify-center shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg">Kết Chuyển Sang Kỳ Mới</h3>
                <p className="text-xs text-slate-400">Tự động khởi tạo chu kỳ tháng tiếp theo</p>
              </div>
            </div>

            <div className="bg-slate-850 border border-slate-750 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
              <p>Hệ thống sẽ thực hiện các thao tác sau:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-300">
                <li>Lấy <strong className="text-white">Số mới</strong> Điện/Nước kỳ hiện tại gán thành <strong className="text-white">Số cũ</strong> kỳ mới.</li>
                <li>Đặt chỉ số mới bằng số cũ (chưa tiêu thụ).</li>
                <li>Đặt trạng thái tất cả các phòng về <strong className="text-amber-400">Chưa thu</strong>.</li>
                <li>Chuyển ngay giao diện sang tháng tiếp theo.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRollForwardConfirm(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeRollForward}
                className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Xác nhận kết chuyển</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Collect Payment Modal */}
      {collectRoomId && (
        <QuickCollectModal
          initialRoomId={collectRoomId}
          rooms={rooms}
          invoices={invoices}
          payments={payments}
          onClose={() => setCollectRoomId(null)}
          onSuccess={(payment) => {
            setCollectRoomId(null);
            setActiveReceiptPayment(payment);
            loadAllData();
            showToast('Đã ghi nhận thanh toán tiền phòng thành công!', 'success');
          }}
        />
      )}

      {/* Payment Receipt Modal */}
      {activeReceiptPayment && (
        <ReceiptModal
          payment={activeReceiptPayment}
          room={rooms.find((r) => r.id === activeReceiptPayment.roomId)}
          onClose={() => setActiveReceiptPayment(null)}
        />
      )}

      {/* Meter Walkthrough Quick Record Modal */}
      {showWalkthrough && (
        <MeterWalkthroughModal
          rooms={rooms}
          currentPeriod={currentPeriod}
          onClose={() => setShowWalkthrough(false)}
          onSuccess={() => {
            setShowWalkthrough(false);
            loadAllData();
            showToast('Đã lưu chỉ số điện nước thành công!', 'success');
          }}
        />
      )}

      {/* Single-point Billing Adjustment Modal */}
      {adjustmentRoom && (
        <BillingAdjustmentModal
          room={adjustmentRoom}
          currentInvoice={invoices.find(
            (i) => i.roomId === adjustmentRoom.id && i.periodMonth === currentPeriod
          )}
          meterReading={meters.find(
            (m) => m.roomId === adjustmentRoom.id && m.period === currentPeriod
          )}
          tenantName={
            tenancies.find((s) => s.id === adjustmentRoom.currentStayId)?.representativeName ||
            VIETNAMESE_TENANT_NAMES[adjustmentRoom.code]?.name ||
            'Khách thuê'
          }
          tenantPhone={
            tenancies.find((s) => s.id === adjustmentRoom.currentStayId)?.representativePhone ||
            VIETNAMESE_TENANT_NAMES[adjustmentRoom.code]?.phone ||
            ''
          }
          currentPeriod={currentPeriod}
          onClose={() => setAdjustmentRoom(null)}
          onSuccess={() => {
            loadAllData();
            showToast(`Đã cập nhật tiền phòng ${adjustmentRoom.code} thành công!`, 'success');
          }}
          onOpenZalo={(rId) => {
            setAdjustmentRoom(null);
            setZaloCalcRoomId(rId);
          }}
          onCollect={(rId) => {
            setAdjustmentRoom(null);
            setCollectRoomId(rId);
          }}
          onViewHistory={() => {
            const target = adjustmentRoom;
            setAdjustmentRoom(null);
            setDetailRoom(target);
          }}
        />
      )}

      {/* Room Detail Modal */}
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

      {/* Acceptance Test Suite Modal */}
      {showTestSuite && (
        <AcceptanceTestSuiteModal onClose={() => setShowTestSuite(false)} />
      )}

      {/* Day 10 Reminder Modal */}
      {showReminder && profile && (
        <Day10ReminderModal
          profile={profile}
          currentPeriod={currentPeriod}
          onClose={() => setShowReminder(false)}
          onRefresh={loadAllData}
        />
      )}

      {/* Invoice Manager Modal */}
      {showInvoiceManager && (
        <InvoiceManagerModal
          invoices={invoices}
          rooms={rooms}
          currentPeriod={currentPeriod}
          onClose={() => setShowInvoiceManager(false)}
          onRefresh={loadAllData}
        />
      )}

      {/* Maintenance & Repairs Modal */}
      {showMaintenance && currentUser && (
        <MaintenanceModal
          currentUser={currentUser}
          rooms={rooms}
          tickets={tickets}
          onClose={() => setShowMaintenance(false)}
          onRefresh={loadAllData}
        />
      )}

      {/* House Expenses Modal */}
      {showExpenses && (
        <ExpensesModal
          expenses={expenses}
          onClose={() => setShowExpenses(false)}
          onRefresh={loadAllData}
        />
      )}

      {/* Backup & Restore Modal */}
      {showBackup && (
        <BackupRestoreModal
          onClose={() => setShowBackup(false)}
          onRefresh={loadAllData}
          currentPeriod={currentPeriod}
        />
      )}

      {/* Audit Log Modal */}
      {showAudit && (
        <AuditLogModal onClose={() => setShowAudit(false)} />
      )}

      {/* Zalo VietQR Calculator Modal */}
      {zaloCalcRoomId && profile && (
        <ZaloCalculatorModal
          initialRoomId={zaloCalcRoomId}
          rooms={rooms}
          profile={profile}
          currentPeriod={currentPeriod}
          meterReadings={meters}
          invoices={invoices}
          payments={payments}
          onClose={() => setZaloCalcRoomId(null)}
          onSuccess={() => {
            loadAllData();
            showToast('Đã tính toán tiền và tạo mã VietQR thành công!', 'success');
          }}
        />
      )}

      {/* Setup Wizard & Settings Modal */}
      {showSetup && profile && (
        <SetupWizardModal
          currentProfile={profile}
          rooms={rooms}
          onClose={() => setShowSetup(false)}
          onSuccess={() => {
            loadAllData();
            setShowSetup(false);
            showToast('Đã lưu cấu hình Ngân hàng & Đơn giá thành công!', 'success');
          }}
        />
      )}
    </div>
  );
}
