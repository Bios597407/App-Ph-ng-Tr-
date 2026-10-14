import fs from 'fs';
import path from 'path';
import {
  AppDatabase,
  HouseProfile,
  Room,
  TenancyStay,
  Tenant,
  MeterReading,
  Invoice,
  Payment,
  DepositTransaction,
  AdvanceBalanceItem,
  HouseExpense,
  MaintenanceTicket,
  User,
  AuditLogItem,
  PaymentAllocation
} from '../types/index.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');
const DB_FILE_LIVE = path.resolve(DATA_DIR, 'troxanh_db.json');
const DB_FILE_DEMO = path.resolve(DATA_DIR, 'troxanh_demo_db.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export function getDefaultHouseProfile(): HouseProfile {
  return {
    name: 'Hóa Đơn Tiền Nhà',
    address: '123 Đường Công Nhân, Phường Bình An, TP. Dĩ An, Bình Dương',
    ownerName: 'Ban Quản Lý',
    ownerPhone: '0909123456',
    ownerEmail: 'quanly@anbinh.vn',
    defaultDueDay: 10,
    defaultCutoffDay: 5,
    electricityDefaultRate: 3500,
    waterDefaultRate: 20000,
    waterDefaultType: 'meter',
    internetDefaultFee: 50000,
    garbageDefaultFee: 30000,
    bankAccount: {
      bankId: 'MB',
      bankName: 'MBBank - Ngân hàng Quân Đội',
      accountNumber: '99990909123456',
      accountHolder: 'BAN QUAN LY',
      qrTemplate: 'compact',
    },
    reminderMessageTemplate:
      'Thông báo tiền phòng tháng {period} của {roomName}: Tổng còn phải trả {amount} đ. Hạn thanh toán: ngày 10/{month}. Vui lòng chuyển khoản STK: {bankAccount} ({bankName}) với nội dung: {transferNote}. Trân trọng cảm ơn!',
    isInitialSetupCompleted: true,
  };
}

export function generateInitialRooms(): Room[] {
  const rooms: Room[] = [];
  for (let i = 1; i <= 9; i++) {
    const code = `P0${i}`;
    rooms.push({
      id: `room-${code}`,
      code,
      name: `Phòng 0${i}`,
      status: i === 9 ? 'vacant' : 'rented',
      currentRent: 1500000 + (i % 3) * 200000, // 1.5M - 1.9M phù hợp công nhân
      areaM2: 18 + (i % 2) * 4,
      maxOccupants: 3,
      amenities: ['Gác lửng', 'WC riêng', 'Kệ bếp', 'Quạt trần'],
      notes: `Phòng dãy trệt ${code}`,
      currentStayId: i === 9 ? null : `stay-${code}-01`,
      priceHistory: [
        {
          id: `ph-${code}-01`,
          effectiveDate: '2026-01-01',
          baseRent: 1500000 + (i % 3) * 200000,
          electricityRate: 3500,
          waterRate: 20000,
          waterBillingType: 'meter',
          internetFee: 50000,
          wasteFee: 30000,
        },
      ],
      currentMeter: {
        electricNumber: 1200 + i * 45,
        waterNumber: 340 + i * 12,
        electricLastRecordedDate: '2026-10-05',
        waterLastRecordedDate: '2026-10-05',
      },
    });
  }
  return rooms;
}

export function generateInitialUsers(): User[] {
  return [
    {
      id: 'user-landlord',
      username: 'chutro',
      fullName: 'Quản Lý Phòng',
      role: 'landlord',
      phone: '0909123456',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'user-assistant',
      username: 'hotro',
      fullName: 'Trần Thị Thu (Người Hỗ Trợ Ghi Số)',
      role: 'assistant',
      phone: '0908888999',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'user-tenant-p01',
      username: 'khach_p01',
      fullName: 'Lê Văn An (Người Thuê P01)',
      role: 'tenant',
      phone: '0912345678',
      roomId: 'room-P01',
      activeStayId: 'stay-P01-01',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'user-tenant-p02',
      username: 'khach_p02',
      fullName: 'Phạm Thị Bích (Người Thuê P02)',
      role: 'tenant',
      phone: '0933445566',
      roomId: 'room-P02',
      activeStayId: 'stay-P02-01',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];
}

export function generateInitialDatabase(isDemo = false): AppDatabase {
  const rooms = generateInitialRooms();
  const users = generateInitialUsers();
  const profile = getDefaultHouseProfile();

  const tenancies: TenancyStay[] = [];
  const tenants: Tenant[] = [];
  const meterReadings: MeterReading[] = [];
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const depositTransactions: DepositTransaction[] = [];
  const advanceBalances: AdvanceBalanceItem[] = [];

  const tenantNames = [
    'Lê Văn An',
    'Phạm Thị Bích',
    'Hoàng Văn Cường',
    'Đỗ Thị Dung',
    'Vũ Tuấn Em',
    'Ngô Thị Phương',
    'Bùi Văn Giáp',
    'Đặng Hải Hà',
  ];

  // Populate 8 active tenancies for P01-P08
  for (let i = 1; i <= 8; i++) {
    const code = `P0${i}`;
    const stayId = `stay-${code}-01`;
    const room = rooms.find((r) => r.code === code)!;
    const repName = tenantNames[i - 1];

    tenancies.push({
      id: stayId,
      roomId: room.id,
      representativeName: repName,
      representativePhone: `09${i}123456${i}`,
      startDate: '2026-01-01',
      status: 'active',
      baseRent: room.currentRent,
      depositAmount: room.currentRent, // 1 tháng cọc
      initialDebt: i === 2 ? 300000 : 0, // P02 has 300,000 previous debt as in spec example!
      initialDebtNote: i === 2 ? 'Nợ tiền điện nước tháng trước chưa nộp đủ' : undefined,
      initialAdvancePayment: i === 3 ? 500000 : 0,
      paymentDueDay: 10,
      waterBillingType: 'meter',
      electricityRate: 3500,
      waterRate: 20000,
      garbageFee: 30000,
      internetFee: 50000,
      oddDayCalculationRule: 'standard_30_days',
      coOccupantsCount: 2,
      contractNotes: `Hợp đồng thuê 1 năm từ 01/01/2026`,
    });

    depositTransactions.push({
      id: `dep-${code}-01`,
      stayId,
      roomId: room.id,
      type: 'received',
      amount: room.currentRent,
      date: '2026-01-01',
      reason: 'Tiền cọc ban đầu khi ký hợp đồng',
      recordedBy: 'Nguyễn Văn Chủ',
    });

    tenants.push({
      id: `tenant-${code}-01`,
      fullName: repName,
      phone: `09${i}123456${i}`,
      idCardNumber: `07920000000${i}`,
      isRepresentative: true,
      roomId: room.id,
      stayId,
      moveInDate: '2026-01-01',
    });

    // Readings for period 2026-10
    const eStart = room.currentMeter.electricNumber - 80;
    const eEnd = room.currentMeter.electricNumber;
    const wStart = room.currentMeter.waterNumber - 10;
    const wEnd = room.currentMeter.waterNumber;

    meterReadings.push({
      id: `mr-${code}-202610`,
      roomId: room.id,
      period: '2026-10',
      recordedDate: '2026-10-05',
      recordedBy: 'Trần Thị Thu',
      electricStart: eStart,
      electricEnd: eEnd,
      electricUsage: eEnd - eStart,
      electricRate: 3500,
      electricTotal: (eEnd - eStart) * 3500,
      waterStart: wStart,
      waterEnd: wEnd,
      waterUsage: wEnd - wStart,
      waterRate: 20000,
      waterTotal: (wEnd - wStart) * 20000,
      waterBillingType: 'meter',
      isAnomaly: false,
      isConfirmed: true,
    });

    // Invoices for period 2026-10
    const rentItem = {
      id: `item-${code}-rent`,
      type: 'rent' as const,
      name: 'Tiền thuê phòng tháng 10/2026',
      amount: room.currentRent,
    };
    const elecItem = {
      id: `item-${code}-elec`,
      type: 'electricity' as const,
      name: `Điện (${eEnd - eStart} kWh x 3.500 đ)`,
      quantity: eEnd - eStart,
      unitPrice: 3500,
      amount: (eEnd - eStart) * 3500,
    };
    const waterItem = {
      id: `item-${code}-water`,
      type: 'water' as const,
      name: `Nước (${wEnd - wStart} m3 x 20.000 đ)`,
      quantity: wEnd - wStart,
      unitPrice: 20000,
      amount: (wEnd - wStart) * 20000,
    };
    const garbageItem = {
      id: `item-${code}-garb`,
      type: 'garbage' as const,
      name: 'Rác vệ sinh',
      amount: 30000,
    };
    const netItem = {
      id: `item-${code}-net`,
      type: 'internet' as const,
      name: 'Wifi Internet',
      amount: 50000,
    };

    const currentTotal =
      rentItem.amount + elecItem.amount + waterItem.amount + garbageItem.amount + netItem.amount;
    const prevDebt = i === 2 ? 300000 : 0;
    const appliedAdv = i === 3 ? 500000 : 0;

    // For room P01, mark as partially paid (1.000.000) or paid depending on room
    let paidAmt = 0;
    let paymentStat: 'unpaid' | 'partial' | 'paid' = 'unpaid';

    if (i === 1) {
      paidAmt = 1000000;
      paymentStat = 'partial';
      payments.push({
        id: `pay-P01-01`,
        paymentCode: `PT-20261008-P01`,
        roomId: room.id,
        stayId,
        invoiceId: `inv-P01-202610`,
        amount: 1000000,
        receivedAt: '2026-10-08T09:30:00.000Z',
        payerName: repName,
        receivedBy: 'Nguyễn Văn Chủ',
        method: 'transfer',
        bankTransactionRef: 'MB-TX-883719',
        allocations: [{ invoiceId: `inv-P01-202610`, period: '2026-10', amount: 1000000 }],
        unallocatedAmount: 0,
        isReconciled: true,
        status: 'valid',
        notes: 'Chuyển khoản cọc tiền đợt 1',
      });
    } else if (i === 4) {
      paidAmt = currentTotal;
      paymentStat = 'paid';
      payments.push({
        id: `pay-P04-01`,
        paymentCode: `PT-20261009-P04`,
        roomId: room.id,
        stayId,
        invoiceId: `inv-P04-202610`,
        amount: currentTotal,
        receivedAt: '2026-10-09T14:15:00.000Z',
        payerName: repName,
        receivedBy: 'Nguyễn Văn Chủ',
        method: 'transfer',
        bankTransactionRef: 'VCB-992144',
        allocations: [{ invoiceId: `inv-P04-202610`, period: '2026-10', amount: currentTotal }],
        unallocatedAmount: 0,
        isReconciled: true,
        status: 'valid',
        notes: 'Thanh toán tiền trọ đủ tháng 10',
      });
    }

    const remaining = currentTotal + prevDebt - appliedAdv - paidAmt;

    invoices.push({
      id: `inv-${code}-202610`,
      invoiceCode: `HD-202610-${code}`,
      roomId: room.id,
      stayId,
      periodMonth: '2026-10',
      utilityPeriodMonth: '2026-10',
      createdDate: '2026-10-06',
      dueDate: '2026-10-10',
      payerName: repName,
      items: [rentItem, elecItem, waterItem, garbageItem, netItem],
      currentCycleTotal: currentTotal,
      previousDebt: prevDebt,
      appliedAdvance: appliedAdv,
      paidAmount: paidAmt,
      remainingBalance: remaining,
      status: 'locked',
      paymentStatus: paymentStat,
      version: 1,
    });
  }

  const maintenanceTickets: MaintenanceTicket[] = [
    {
      id: 'maint-01',
      roomId: 'room-P02',
      tenantName: 'Phạm Thị Bích',
      title: 'Vòi sen bị rỉ nước',
      description: 'Vòi sen phòng tắm nhỏ giọt liên tục từ hôm qua, nhờ chủ trọ kiểm tra giúp.',
      status: 'pending',
      createdAt: '2026-10-11T08:00:00.000Z',
    },
  ];

  const expenses: HouseExpense[] = [
    {
      id: 'exp-01',
      date: '2026-10-01',
      category: 'internet_master',
      title: 'Cước gói mạng cáp quang tổng khu trọ tháng 10',
      amount: 450000,
      paidBy: 'Nguyễn Văn Chủ',
      notes: 'Thanh toán Viettel 1Gbps',
    },
    {
      id: 'exp-02',
      date: '2026-10-02',
      category: 'repairs',
      title: 'Thay bóng đèn Led hành lang dãy trọ',
      amount: 120000,
      paidBy: 'Nguyễn Văn Chủ',
      notes: 'Mua 2 bóng Philips',
    },
  ];

  const auditLogs: AuditLogItem[] = [
    {
      id: 'audit-init',
      timestamp: new Date().toISOString(),
      actorId: 'user-landlord',
      actorName: 'Nguyễn Văn Chủ',
      role: 'landlord',
      action: 'INITIALIZE_SYSTEM',
      targetType: 'settings',
      targetId: 'house-profile',
      description: `Khởi tạo hệ thống quản lý 9 phòng trọ (${isDemo ? 'Môi trường minh họa' : 'Môi trường vận hành'}).`,
    },
  ];

  return {
    profile,
    rooms,
    tenancies,
    tenants,
    meterReadings,
    invoices,
    payments,
    depositTransactions,
    advanceBalances,
    expenses,
    maintenanceTickets,
    users,
    auditLogs,
    lastBackupDate: new Date().toISOString(),
    version: 1,
  };
}

// In-memory cache & write helpers
let activeDb: AppDatabase | null = null;
let currentEnvMode: 'live' | 'demo' = 'live';

export function getDbFilePath(mode = currentEnvMode): string {
  return mode === 'demo' ? DB_FILE_DEMO : DB_FILE_LIVE;
}

export function loadDatabase(mode: 'live' | 'demo' = 'live'): AppDatabase {
  currentEnvMode = mode;
  const filePath = getDbFilePath(mode);

  if (!fs.existsSync(filePath)) {
    const initial = generateInitialDatabase(mode === 'demo');
    saveDatabase(initial, mode);
    activeDb = initial;
    return initial;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    activeDb = parsed;
    return parsed;
  } catch (err) {
    console.error(`Error loading database from ${filePath}:`, err);
    const initial = generateInitialDatabase(mode === 'demo');
    saveDatabase(initial, mode);
    activeDb = initial;
    return initial;
  }
}

export function saveDatabase(db: AppDatabase, mode = currentEnvMode): void {
  const filePath = getDbFilePath(mode);
  const tempPath = `${filePath}.tmp.${Date.now()}`;

  db.version = (db.version || 0) + 1;
  const serialized = JSON.stringify(db, null, 2);

  // Atomic write via temp file
  fs.writeFileSync(tempPath, serialized, 'utf-8');
  fs.renameSync(tempPath, filePath);
  activeDb = db;
}

export function createAutomaticBackup(db: AppDatabase, label = 'auto'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${currentEnvMode}_${label}_${timestamp}.json`;
  const targetPath = path.resolve(BACKUPS_DIR, filename);

  fs.writeFileSync(targetPath, JSON.stringify(db, null, 2), 'utf-8');
  db.lastBackupDate = new Date().toISOString();

  // Rotate backups: keep maximum 20 backups
  try {
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));

    if (files.length > 20) {
      for (let i = 20; i < files.length; i++) {
        fs.unlinkSync(path.resolve(BACKUPS_DIR, files[i]));
      }
    }
  } catch (e) {
    console.warn('Backup rotation warning:', e);
  }

  return filename;
}

export function listBackups(): { filename: string; size: number; createdAt: string }[] {
  try {
    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.json'));
    return files
      .map((f) => {
        const full = path.resolve(BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function restoreBackupFile(filename: string): { success: boolean; message: string; data?: AppDatabase } {
  const full = path.resolve(BACKUPS_DIR, filename);
  if (!fs.existsSync(full)) {
    return { success: false, message: 'Tệp sao lưu không tồn tại trên hệ thống.' };
  }

  try {
    const content = fs.readFileSync(full, 'utf-8');
    const parsed = JSON.parse(content) as AppDatabase;

    // Validate structure
    if (!parsed.rooms || parsed.rooms.length === 0 || !parsed.profile) {
      return { success: false, message: 'Dữ liệu sao lưu không hợp lệ hoặc thiếu cấu trúc bắt buộc.' };
    }

    saveDatabase(parsed, currentEnvMode);
    return { success: true, message: `Phục hồi sao lưu thành công từ ${filename}`, data: parsed };
  } catch (err: any) {
    return { success: false, message: `Lỗi phục hồi: ${err.message}` };
  }
}

export function addAuditLog(
  actor: { id: string; name: string; role: string },
  action: string,
  targetType: AuditLogItem['targetType'],
  targetId: string,
  description: string,
  beforeSnapshot?: any,
  afterSnapshot?: any
) {
  const db = activeDb || loadDatabase();
  const log: AuditLogItem = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    role: actor.role,
    action,
    targetType,
    targetId,
    description,
    beforeSnapshot: beforeSnapshot ? JSON.parse(JSON.stringify(beforeSnapshot)) : undefined,
    afterSnapshot: afterSnapshot ? JSON.parse(JSON.stringify(afterSnapshot)) : undefined,
  };
  db.auditLogs.unshift(log);
  // Keep last 500 audit logs
  if (db.auditLogs.length > 500) {
    db.auditLogs.length = 500;
  }
  saveDatabase(db);
}
