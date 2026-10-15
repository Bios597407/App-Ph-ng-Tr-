import {
  AppDatabase,
  HouseProfile,
  Room,
  TenancyStay,
  Tenant,
  User,
  MeterReading,
  Invoice,
  Payment,
  HouseExpense,
  MaintenanceTicket,
} from '../types/index.ts';
import { supabase } from '../services/supabase.ts';

export const LOCAL_STORAGE_DB_KEY = 'troxanh_client_db_v1';

export const VIETNAMESE_TENANT_NAMES: Record<string, { name: string; phone: string; cccd: string }> = {
  P01: { name: 'Lê Văn An', phone: '0911234561', cccd: '079200000001' },
  P02: { name: 'Phạm Thị Bích', phone: '0921234562', cccd: '079200000002' },
  P03: { name: 'Hoàng Văn Cường', phone: '0931234563', cccd: '079200000003' },
  P04: { name: 'Đỗ Thị Dung', phone: '0941234564', cccd: '079200000004' },
  P05: { name: 'Vũ Tuấn Em', phone: '0951234565', cccd: '079200000005' },
  P06: { name: 'Ngô Thị Phương', phone: '0961234566', cccd: '079200000006' },
  P07: { name: 'Bùi Văn Giáp', phone: '0971234567', cccd: '079200000007' },
  P08: { name: 'Đặng Hải Hà', phone: '0981234568', cccd: '079200000008' },
};

export function getDefaultHouseProfile(): HouseProfile {
  return {
    name: 'Hóa Đơn Tiền Nhà',
    address: '123 Đường Công Nhân, Phường Bình An, TP. Dĩ An, Bình Dương',
    ownerName: 'Nguyễn Văn Chủ',
    ownerPhone: '0909123456',
    ownerEmail: 'chutro@anbinh.vn',
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
      accountHolder: 'NGUYEN VAN CHU',
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
    const isVacant = i === 9;
    const rent = 1500000 + (i % 3) * 200000;
    const baseElec = 1100 + i * 55;
    const baseWater = 330 + i * 12;

    rooms.push({
      id: `room-${code}`,
      code,
      name: `Phòng 0${i}`,
      status: isVacant ? 'vacant' : 'rented',
      currentRent: rent,
      areaM2: 18 + (i % 2) * 4,
      maxOccupants: 3,
      amenities: ['Gác lửng', 'WC riêng', 'Kệ bếp', 'Quạt trần'],
      notes: `Phòng dãy trệt ${code}`,
      currentStayId: isVacant ? null : `stay-${code}-01`,
      priceHistory: [
        {
          id: `ph-${code}-01`,
          effectiveDate: '2026-01-01',
          baseRent: rent,
          electricityRate: 3500,
          waterRate: 20000,
          waterBillingType: 'meter',
          internetFee: 50000,
          wasteFee: 30000,
        },
      ],
      currentMeter: {
        electricNumber: baseElec,
        waterNumber: baseWater,
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
  ];
}

/**
 * Builds a complete initial database with 9 rooms, authentic Vietnamese tenants,
 * meter readings, and invoices for 2026-10.
 */
export function buildFullInitialDatabase(): AppDatabase {
  const rooms = generateInitialRooms();
  const profile = getDefaultHouseProfile();
  const users = generateInitialUsers();

  const tenancies: TenancyStay[] = [];
  const tenants: Tenant[] = [];
  const meterReadings: MeterReading[] = [];
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];

  for (let i = 1; i <= 8; i++) {
    const code = `P0${i}`;
    const stayId = `stay-${code}-01`;
    const room = rooms.find((r) => r.code === code)!;
    const tenantMeta = VIETNAMESE_TENANT_NAMES[code];

    tenancies.push({
      id: stayId,
      roomId: room.id,
      representativeName: tenantMeta.name,
      representativePhone: tenantMeta.phone,
      startDate: '2026-01-01',
      status: 'active',
      baseRent: room.currentRent,
      depositAmount: room.currentRent,
      initialDebt: i === 2 ? 300000 : 0,
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
      contractNotes: 'Hợp đồng thuê 1 năm từ 01/01/2026',
    });

    tenants.push({
      id: `tenant-${code}-01`,
      fullName: tenantMeta.name,
      phone: tenantMeta.phone,
      idCardNumber: tenantMeta.cccd,
      isRepresentative: true,
      roomId: room.id,
      stayId,
      moveInDate: '2026-01-01',
    });

    // Readings for period 2026-10
    const eEnd = room.currentMeter.electricNumber;
    const eStart = eEnd - 80;
    const wEnd = room.currentMeter.waterNumber;
    const wStart = wEnd - 10;
    const eUsage = 80;
    const wUsage = 10;
    const eRate = 3500;
    const wRate = 20000;
    const eTotal = eUsage * eRate;
    const wTotal = wUsage * wRate;

    meterReadings.push({
      id: `mr-${code}-202610`,
      roomId: room.id,
      period: '2026-10',
      recordedDate: '2026-10-05',
      recordedBy: 'Nguyễn Văn Chủ',
      electricStart: eStart,
      electricEnd: eEnd,
      electricUsage: eUsage,
      electricRate: eRate,
      electricTotal: eTotal,
      waterStart: wStart,
      waterEnd: wEnd,
      waterUsage: wUsage,
      waterRate: wRate,
      waterTotal: wTotal,
      waterBillingType: 'meter',
      isAnomaly: false,
      isConfirmed: true,
    });

    const rentItem = {
      id: `item-${code}-rent`,
      type: 'rent' as const,
      name: 'Tiền thuê phòng tháng 10/2026',
      amount: room.currentRent,
    };
    const elecItem = {
      id: `item-${code}-elec`,
      type: 'electricity' as const,
      name: `Điện (${eUsage} kWh x 3.500 đ)`,
      quantity: eUsage,
      unitPrice: 3500,
      amount: eTotal,
    };
    const waterItem = {
      id: `item-${code}-water`,
      type: 'water' as const,
      name: `Nước (${wUsage} m³ x 20.000 đ)`,
      quantity: wUsage,
      unitPrice: 20000,
      amount: wTotal,
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

    const currentCycleTotal = rentItem.amount + elecItem.amount + waterItem.amount + garbageItem.amount + netItem.amount;

    // Room P04 is paid, P01 is partial (1M), others unpaid
    let paidAmt = 0;
    let invStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';

    if (i === 1) {
      paidAmt = 1000000;
      invStatus = 'partial';
      payments.push({
        id: `pay-P01-01`,
        paymentCode: `PT-20261008-P01`,
        roomId: room.id,
        stayId,
        invoiceId: `inv-P01-202610`,
        amount: 1000000,
        receivedAt: '2026-10-08T09:30:00.000Z',
        payerName: tenantMeta.name,
        receivedBy: 'Nguyễn Văn Chủ',
        method: 'transfer',
        bankTransactionRef: 'MB-TX-883719',
        allocations: [{ invoiceId: `inv-P01-202610`, period: '2026-10', amount: 1000000 }],
        unallocatedAmount: 0,
        isReconciled: true,
        status: 'valid',
        notes: 'Chuyển khoản thanh toán đợt 1',
      });
    } else if (i === 4) {
      paidAmt = currentCycleTotal;
      invStatus = 'paid';
      payments.push({
        id: `pay-P04-01`,
        paymentCode: `PT-20261007-P04`,
        roomId: room.id,
        stayId,
        invoiceId: `inv-P04-202610`,
        amount: currentCycleTotal,
        receivedAt: '2026-10-07T14:20:00.000Z',
        payerName: tenantMeta.name,
        receivedBy: 'Nguyễn Văn Chủ',
        method: 'transfer',
        bankTransactionRef: 'MB-TX-774912',
        allocations: [{ invoiceId: `inv-P04-202610`, period: '2026-10', amount: currentCycleTotal }],
        unallocatedAmount: 0,
        isReconciled: true,
        status: 'valid',
        notes: 'Chuyển khoản toàn bộ tiền phòng tháng 10',
      });
    }

    invoices.push({
      id: `inv-${code}-202610`,
      invoiceCode: `HD-202610-${code}`,
      roomId: room.id,
      stayId,
      periodMonth: '2026-10',
      status: 'draft',
      paymentStatus: invStatus,
      createdDate: '2026-10-05',
      dueDate: '2026-10-10',
      items: [rentItem, elecItem, waterItem, garbageItem, netItem],
      currentCycleTotal,
      previousDebt: 0,
      appliedAdvance: 0,
      paidAmount: paidAmt,
      remainingBalance: currentCycleTotal - paidAmt,
      payerName: tenantMeta.name,
      version: 1,
    });
  }

  const maintenanceTickets: MaintenanceTicket[] = [
    {
      id: 'maint-01',
      roomId: 'room-P02',
      tenantName: 'Phạm Thị Bích',
      title: 'Vòi sen bị rỉ nước',
      description: 'Vòi sen phòng tắm nhỏ giọt liên tục, nhờ chủ trọ kiểm tra giúp.',
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

  return {
    profile,
    rooms,
    tenancies,
    tenants,
    meterReadings,
    invoices,
    payments,
    depositTransactions: [],
    advanceBalances: [],
    expenses,
    maintenanceTickets,
    users,
    auditLogs: [],
    lastBackupDate: new Date().toISOString(),
    version: 1,
  };
}

export function getClientFallbackDb(): AppDatabase {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_DB_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Validate that database is populated with valid tenant names and invoices
      if (parsed.rooms && parsed.rooms.length > 0) {
        // Migration check: if representativeName has "Người Thuê P", upgrade to full names
        const hasOldPlaceholder = (parsed.tenancies || []).some((t: any) =>
          typeof t.representativeName === 'string' && t.representativeName.includes('Người Thuê P')
        );
        const hasNoInvoices = !parsed.invoices || parsed.invoices.length === 0;

        if (hasOldPlaceholder || hasNoInvoices) {
          const fresh = buildFullInitialDatabase();
          saveClientFallbackDb(fresh);
          return fresh;
        }

        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading localStorage DB:', e);
  }

  const freshDb = buildFullInitialDatabase();
  saveClientFallbackDb(freshDb);
  return freshDb;
}

export function saveClientFallbackDb(db: AppDatabase): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('localStorage quota warning:', e);
  }

  // Non-blocking background sync to Supabase if configured
  syncToSupabaseDirect(db);
}

export async function syncToSupabaseDirect(db: AppDatabase): Promise<void> {
  try {
    await supabase
      .from('troxanh_state')
      .upsert({ id: 'app_state_live', data: db, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  } catch (err) {
    // Non-blocking: application functions entirely offline or on localStorage
    console.warn('[Supabase Sync Notice]:', err);
  }
}

/**
 * Executes month roll-forward entirely on client-side:
 * From currentPeriod (e.g. 2026-10) to nextPeriod (e.g. 2026-11):
 * - Takes new electric/water reading of Oct and assigns it as old electric/water of Nov.
 * - Sets new electric/water reading of Nov equal to old reading (usage = 0).
 * - Creates fresh invoices with status "unpaid" ("Chưa thu").
 * - Returns updated database and nextPeriod string.
 */
export function rollForwardPeriodClient(db: AppDatabase, currentPeriod: string): { db: AppDatabase; nextPeriod: string } {
  const [year, month] = currentPeriod.split('-').map(Number);
  const nextDate = new Date(year, month, 1);
  const nextY = nextDate.getFullYear();
  const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
  const nextPeriod = `${nextY}-${nextM}`;

  const updatedRooms = [...db.rooms];
  const updatedMeters = [...db.meterReadings];
  const updatedInvoices = [...db.invoices];

  const profile = db.profile || getDefaultHouseProfile();
  const eRateDefault = profile.electricityDefaultRate ?? 3500;
  const wRateDefault = profile.waterDefaultRate ?? 20000;
  const garbDefault = profile.garbageDefaultFee ?? 30000;
  const netDefault = profile.internetDefaultFee ?? 50000;

  for (const room of updatedRooms) {
    if (room.status === 'rented') {
      const code = room.code;
      const stay = (db.tenancies || []).find((s) => s.id === room.currentStayId);
      const tenantMeta = VIETNAMESE_TENANT_NAMES[code];
      const repName = stay?.representativeName || tenantMeta?.name || `Phòng ${code}`;
      const repPhone = stay?.representativePhone || tenantMeta?.phone || '';

      // Find current reading from previous period
      const curReading = updatedMeters.find((m) => m.roomId === room.id && m.period === currentPeriod);
      const curEEnd = curReading ? curReading.electricEnd : (room.currentMeter?.electricNumber ?? 1280);
      const curWEnd = curReading ? curReading.waterEnd : (room.currentMeter?.waterNumber ?? 350);

      // New period: Số mới tháng 10 trở thành Số cũ tháng 11, Số mới tháng 11 = Số cũ tháng 11
      const nextEStart = curEEnd;
      const nextEEnd = curEEnd;
      const nextWStart = curWEnd;
      const nextWEnd = curWEnd;

      // Update room current meter
      room.currentMeter = {
        electricNumber: nextEEnd,
        waterNumber: nextWEnd,
        electricLastRecordedDate: new Date().toISOString().slice(0, 10),
        waterLastRecordedDate: new Date().toISOString().slice(0, 10),
      };

      // Add or update meter reading for new period
      const existingMeterIdx = updatedMeters.findIndex((m) => m.roomId === room.id && m.period === nextPeriod);
      const newMeter: MeterReading = {
        id: `mr-${code}-${nextPeriod.replace('-', '')}`,
        roomId: room.id,
        period: nextPeriod,
        recordedDate: new Date().toISOString().slice(0, 10),
        recordedBy: 'Nguyễn Văn Chủ',
        electricStart: nextEStart,
        electricEnd: nextEEnd,
        electricUsage: 0,
        electricRate: eRateDefault,
        electricTotal: 0,
        waterStart: nextWStart,
        waterEnd: nextWEnd,
        waterUsage: 0,
        waterRate: wRateDefault,
        waterTotal: 0,
        waterBillingType: 'meter',
        isAnomaly: false,
        isConfirmed: true,
      };

      if (existingMeterIdx !== -1) {
        updatedMeters[existingMeterIdx] = newMeter;
      } else {
        updatedMeters.push(newMeter);
      }

      // Create new invoice for new period with status "unpaid"
      const rentItem = {
        id: `item-${code}-rent-${nextPeriod}`,
        type: 'rent' as const,
        name: `Tiền thuê phòng tháng ${nextM}/${nextY}`,
        amount: room.currentRent,
      };
      const elecItem = {
        id: `item-${code}-elec-${nextPeriod}`,
        type: 'electricity' as const,
        name: `Điện (0 kWh x 3.500 đ)`,
        quantity: 0,
        unitPrice: eRateDefault,
        amount: 0,
      };
      const waterItem = {
        id: `item-${code}-water-${nextPeriod}`,
        type: 'water' as const,
        name: `Nước (0 m³ x 20.000 đ)`,
        quantity: 0,
        unitPrice: wRateDefault,
        amount: 0,
      };
      const garbageItem = {
        id: `item-${code}-garb-${nextPeriod}`,
        type: 'garbage' as const,
        name: 'Rác vệ sinh',
        amount: garbDefault,
      };
      const netItem = {
        id: `item-${code}-net-${nextPeriod}`,
        type: 'internet' as const,
        name: 'Wifi Internet',
        amount: netDefault,
      };

      const currentCycleTotal = rentItem.amount + elecItem.amount + waterItem.amount + garbageItem.amount + netItem.amount;

      const existingInvIdx = updatedInvoices.findIndex((i) => i.roomId === room.id && i.periodMonth === nextPeriod);
      const newInvoice: Invoice = {
        id: `inv-${code}-${nextPeriod.replace('-', '')}`,
        invoiceCode: `HD-${nextPeriod.replace('-', '')}-${code}`,
        roomId: room.id,
        stayId: room.currentStayId || `stay-${code}-01`,
        periodMonth: nextPeriod,
        status: 'draft',
        paymentStatus: 'unpaid',
        createdDate: new Date().toISOString().slice(0, 10),
        dueDate: `${nextY}-${nextM}-10`,
        items: [rentItem, elecItem, waterItem, garbageItem, netItem],
        currentCycleTotal,
        previousDebt: 0,
        appliedAdvance: 0,
        paidAmount: 0,
        remainingBalance: currentCycleTotal,
        payerName: repName,
        version: 1,
      };

      if (existingInvIdx !== -1) {
        updatedInvoices[existingInvIdx] = newInvoice;
      } else {
        updatedInvoices.push(newInvoice);
      }
    }
  }

  const newDb: AppDatabase = {
    ...db,
    rooms: updatedRooms,
    meterReadings: updatedMeters,
    invoices: updatedInvoices,
    version: (db.version || 1) + 1,
    lastBackupDate: new Date().toISOString(),
  };

  saveClientFallbackDb(newDb);
  return { db: newDb, nextPeriod };
}
