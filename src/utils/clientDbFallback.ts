import { AppDatabase, HouseProfile, Room, TenancyStay, Tenant, User } from '../types/index.ts';

const LOCAL_STORAGE_DB_KEY = 'troxanh_client_db_v1';

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
      currentRent: 1500000 + (i % 3) * 200000,
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
  ];
}

export function getClientFallbackDb(): AppDatabase {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_DB_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.rooms && parsed.rooms.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore localStorage parse error
  }

  const rooms = generateInitialRooms();
  const profile = getDefaultHouseProfile();
  const users = generateInitialUsers();

  const tenancies: TenancyStay[] = [];
  const tenants: Tenant[] = [];

  rooms.forEach((r, idx) => {
    if (r.status === 'rented') {
      const code = r.code;
      const stayId = `stay-${code}-01`;
      tenancies.push({
        id: stayId,
        roomId: r.id,
        representativeName: `Người Thuê ${code}`,
        representativePhone: `0908${code.replace('P', '1')}234`,
        startDate: '2026-01-01',
        status: 'active',
        baseRent: r.currentRent,
        depositAmount: r.currentRent,
        initialDebt: 0,
        initialAdvancePayment: 0,
        paymentDueDay: 10,
        waterBillingType: 'meter',
        electricityRate: 3500,
        waterRate: 20000,
        garbageFee: 30000,
        internetFee: 50000,
        oddDayCalculationRule: 'standard_30_days',
        coOccupantsCount: 2,
      });

      tenants.push({
        id: `tenant-${code}-01`,
        fullName: `Người Thuê ${code}`,
        phone: `0908${code.replace('P', '1')}234`,
        idCardNumber: '079201234567',
        isRepresentative: true,
        roomId: r.id,
        stayId,
        moveInDate: '2026-01-01',
      });
    }
  });

  const freshDb: AppDatabase = {
    version: 1,
    lastBackupDate: new Date().toISOString(),
    profile,
    users,
    rooms,
    tenants,
    tenancies,
    meterReadings: [],
    invoices: [],
    payments: [],
    depositTransactions: [],
    advanceBalances: [],
    expenses: [],
    maintenanceTickets: [],
    auditLogs: [],
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(freshDb));
  } catch {
    // Ignore quota errors
  }

  return freshDb;
}

export function saveClientFallbackDb(db: AppDatabase) {
  try {
    localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(db));
  } catch {
    // Ignore quota errors
  }
}
