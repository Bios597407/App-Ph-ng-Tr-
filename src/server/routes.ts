import express from 'express';
import {
  loadDatabase,
  saveDatabase,
  addAuditLog,
  createAutomaticBackup,
  listBackups,
  restoreBackupFile,
} from './db.ts';
import {
  Invoice,
  InvoiceItem,
  Payment,
  PaymentAllocation,
  MeterReading,
  Room,
  TenancyStay,
  Tenant,
  DepositTransaction,
  AdvanceBalanceItem,
  HouseExpense,
  MaintenanceTicket,
  User,
  AppDatabase,
} from '../types/index.ts';
import { runAll32AcceptanceTests } from './testRunner.ts';

export const apiRouter = express.Router();

// Current active session mock storage (token -> User)
const activeSessions = new Map<string, User>();

// Mode tracking: 'live' or 'demo'
let currentMode: 'live' | 'demo' = 'live';

function getDb(): AppDatabase {
  return loadDatabase(currentMode);
}

function persistDb(db: AppDatabase) {
  saveDatabase(db, currentMode);
}

// Authentication Middleware
function authenticateUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // Default to landlord for quick start if no token is provided in local testing, but return user
    const db = getDb();
    const defaultUser = db.users.find((u) => u.role === 'landlord') || db.users[0];
    (req as any).user = defaultUser;
    return next();
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const sessionUser = activeSessions.get(token);
  if (!sessionUser) {
    // Look up directly in DB users by id or token prefix match (e.g. token-usr_chutro-172...)
    const db = getDb();
    let userId = token;
    if (token.startsWith('token-')) {
      const parts = token.split('-');
      if (parts.length >= 2) {
        userId = parts[1];
      }
    }
    const user = db.users.find(
      (u) => u.id === userId || u.username === userId || u.id === token || u.username === token
    );
    if (user && !user.isRevoked) {
      activeSessions.set(token, user);
      (req as any).user = user;
      return next();
    }
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }

  if (sessionUser.isRevoked) {
    return res.status(403).json({ error: 'Tài khoản đã bị thu hồi quyền truy cập.' });
  }

  (req as any).user = sessionUser;
  next();
}

function requireRole(...allowedRoles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user as User;
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: `Bạn không có quyền thực hiện thao tác này. Quyền yêu cầu: ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
}

// ================= AUTH ROUTES =================
apiRouter.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDb();

  const user = db.users.find((u) => u.username === username);
  if (!user) {
    return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
  }

  if (user.isRevoked) {
    return res.status(403).json({ error: 'Tài khoản này đã bị khóa hoặc thu hồi.' });
  }

  // Generate session token
  const token = `token-${user.id}-${Date.now()}`;
  activeSessions.set(token, user);

  res.json({
    token,
    user,
    mode: currentMode,
  });
});

apiRouter.get('/auth/me', authenticateUser, (req, res) => {
  const user = (req as any).user as User;
  res.json({ user, mode: currentMode });
});

apiRouter.post('/auth/logout', authenticateUser, (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

apiRouter.post('/auth/switch-mode', authenticateUser, requireRole('landlord'), (req, res) => {
  const { mode } = req.body;
  if (mode !== 'live' && mode !== 'demo') {
    return res.status(400).json({ error: 'Chế độ không hợp lệ (chỉ live hoặc demo).' });
  }
  currentMode = mode;
  const db = loadDatabase(currentMode);
  res.json({ success: true, mode: currentMode, roomsCount: db.rooms.length });
});

apiRouter.get('/auth/users', authenticateUser, requireRole('landlord'), (req, res) => {
  const db = getDb();
  res.json(db.users);
});

apiRouter.post('/auth/users', authenticateUser, requireRole('landlord'), (req, res) => {
  const { username, fullName, role, phone, roomId } = req.body;
  const db = getDb();
  const actor = (req as any).user;

  if (db.users.some((u) => u.username === username)) {
    return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại.' });
  }

  const newUser: User = {
    id: `user-${Date.now()}`,
    username,
    fullName,
    role,
    phone,
    roomId,
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'CREATE_USER',
    'settings',
    newUser.id,
    `Tạo tài khoản mới: ${username} (${role})`
  );
  persistDb(db);
  res.json(newUser);
});

// ================= PROPERTY PROFILE & SETUP =================
apiRouter.get('/house', authenticateUser, (req, res) => {
  const db = getDb();
  res.json({ profile: db.profile, mode: currentMode });
});

apiRouter.put('/house', authenticateUser, requireRole('landlord'), (req, res) => {
  const db = getDb();
  const actor = (req as any).user;
  const oldProfile = { ...db.profile };
  db.profile = { ...db.profile, ...req.body };

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'UPDATE_PROFILE',
    'settings',
    'house-profile',
    'Cập nhật thông tin khu trọ & tài khoản ngân hàng',
    oldProfile,
    db.profile
  );
  persistDb(db);
  res.json(db.profile);
});

apiRouter.post('/house/setup-wizard', authenticateUser, requireRole('landlord'), (req, res) => {
  const { profile, rooms, tenancies, initialBalances } = req.body;
  const db = getDb();
  const actor = (req as any).user;

  if (profile) {
    db.profile = { ...db.profile, ...profile, isInitialSetupCompleted: true };
  }
  if (rooms && Array.isArray(rooms)) {
    db.rooms = rooms;
  }

  createAutomaticBackup(db, 'setup_completed');
  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'COMPLETE_SETUP_WIZARD',
    'settings',
    'house-profile',
    'Hoàn tất thiết lập ban đầu khu trọ 9 phòng'
  );
  persistDb(db);
  res.json({ success: true, profile: db.profile });
});

// ================= ROOMS =================
apiRouter.get('/rooms', authenticateUser, (req, res) => {
  const db = getDb();
  const user = (req as any).user as User;

  // RBAC Data Isolation: If tenant, ONLY return their own room!
  if (user.role === 'tenant') {
    const userRoom = db.rooms.filter((r) => r.id === user.roomId);
    return res.json(userRoom);
  }

  res.json(db.rooms);
});

apiRouter.put('/rooms/:id', authenticateUser, requireRole('landlord'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const actor = (req as any).user;
  const roomIndex = db.rooms.findIndex((r) => r.id === id);

  if (roomIndex === -1) {
    return res.status(404).json({ error: 'Không tìm thấy phòng.' });
  }

  const oldRoom = { ...db.rooms[roomIndex] };
  db.rooms[roomIndex] = { ...db.rooms[roomIndex], ...req.body };

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'UPDATE_ROOM',
    'room',
    id,
    `Cập nhật thông tin phòng ${db.rooms[roomIndex].name}`,
    oldRoom,
    db.rooms[roomIndex]
  );
  persistDb(db);
  res.json(db.rooms[roomIndex]);
});

// ================= TENANTS & STAYS =================
apiRouter.get('/tenants', authenticateUser, (req, res) => {
  const db = getDb();
  const user = (req as any).user as User;

  if (user.role === 'tenant') {
    return res.json(db.tenants.filter((t) => t.roomId === user.roomId));
  }
  res.json({ tenants: db.tenants, tenancies: db.tenancies });
});

apiRouter.post('/tenancies/new', authenticateUser, requireRole('landlord'), (req, res) => {
  const {
    roomId,
    representativeName,
    representativePhone,
    startDate,
    baseRent,
    depositAmount,
    initialDebt,
    initialAdvancePayment,
    electricityRate,
    waterRate,
    waterBillingType,
    garbageFee,
    internetFee,
    oddDayCalculationRule,
    coOccupantsCount,
    contractNotes,
  } = req.body;

  const db = getDb();
  const actor = (req as any).user;
  const room = db.rooms.find((r) => r.id === roomId);

  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng.' });
  }

  const stayId = `stay-${room.code}-${Date.now()}`;
  const newStay: TenancyStay = {
    id: stayId,
    roomId,
    representativeName,
    representativePhone,
    startDate: startDate || new Date().toISOString().split('T')[0],
    status: 'active',
    baseRent: baseRent || room.currentRent,
    depositAmount: depositAmount || 0,
    initialDebt: initialDebt || 0,
    initialAdvancePayment: initialAdvancePayment || 0,
    paymentDueDay: 10,
    waterBillingType: waterBillingType || 'meter',
    electricityRate: electricityRate || 3500,
    waterRate: waterRate || 20000,
    garbageFee: garbageFee || 30000,
    internetFee: internetFee || 50000,
    oddDayCalculationRule: oddDayCalculationRule || 'standard_30_days',
    coOccupantsCount: coOccupantsCount || 1,
    contractNotes,
  };

  db.tenancies.push(newStay);
  room.status = 'rented';
  room.currentStayId = stayId;
  room.currentRent = newStay.baseRent;

  // Add primary tenant
  const tenant: Tenant = {
    id: `tenant-${Date.now()}`,
    fullName: representativeName,
    phone: representativePhone,
    isRepresentative: true,
    roomId,
    stayId,
    moveInDate: newStay.startDate,
  };
  db.tenants.push(tenant);

  // Record deposit transaction if deposit was provided
  if (depositAmount && depositAmount > 0) {
    db.depositTransactions.push({
      id: `dep-${Date.now()}`,
      stayId,
      roomId,
      type: 'received',
      amount: depositAmount,
      date: newStay.startDate,
      reason: 'Tiền đặt cọc khi ký hợp đồng thuê',
      recordedBy: actor.fullName,
    });
  }

  // Record advance balance if initial advance payment provided
  if (initialAdvancePayment && initialAdvancePayment > 0) {
    db.advanceBalances.push({
      id: `adv-${Date.now()}`,
      stayId,
      roomId,
      amount: initialAdvancePayment,
      availableAmount: initialAdvancePayment,
      source: 'initial_balance',
      date: newStay.startDate,
      note: 'Tiền trả trước ban đầu khi nhận phòng',
    });
  }

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'NEW_TENANCY',
    'tenancy',
    stayId,
    `Lập hợp đồng thuê mới cho ${representativeName} tại ${room.name}`
  );

  persistDb(db);
  res.json({ stay: newStay, room });
});

apiRouter.post('/tenancies/end', authenticateUser, requireRole('landlord'), (req, res) => {
  const { stayId, finalElectricNumber, finalWaterNumber, deductions, refundedDeposit, note } = req.body;
  const db = getDb();
  const actor = (req as any).user;
  const stay = db.tenancies.find((s) => s.id === stayId);

  if (!stay) {
    return res.status(404).json({ error: 'Không tìm thấy đợt thuê.' });
  }

  const room = db.rooms.find((r) => r.id === stay.roomId);
  stay.status = 'ended';
  stay.endedAt = new Date().toISOString();
  stay.moveOutSettlement = {
    finalElectricNumber,
    finalWaterNumber,
    deductions: deductions || [],
    refundedDeposit: refundedDeposit || 0,
    remainingDebt: 0,
    settledDate: new Date().toISOString(),
    note,
  };

  if (room) {
    room.status = 'vacant';
    room.currentStayId = null;
  }

  // Record deposit refund / deduction
  if (refundedDeposit && refundedDeposit > 0) {
    db.depositTransactions.push({
      id: `dep-ref-${Date.now()}`,
      stayId,
      roomId: stay.roomId,
      type: 'refunded',
      amount: refundedDeposit,
      date: new Date().toISOString(),
      reason: note || 'Hoàn cọc khi kết thúc hợp đồng trả phòng',
      recordedBy: actor.fullName,
    });
  }

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'END_TENANCY',
    'tenancy',
    stayId,
    `Thanh lý hợp đồng và trả phòng cho đợt thuê ${stay.representativeName}`
  );

  persistDb(db);
  res.json({ success: true, stay });
});

apiRouter.put('/tenancies/:id', authenticateUser, requireRole('landlord', 'assistant'), (req, res) => {
  const { id } = req.params;
  const { representativeName, representativePhone } = req.body;
  const db = getDb();
  const stay = db.tenancies.find((s) => s.id === id);

  if (!stay) {
    return res.status(404).json({ error: 'Không tìm thấy đợt thuê.' });
  }

  if (representativeName !== undefined) stay.representativeName = representativeName;
  if (representativePhone !== undefined) stay.representativePhone = representativePhone;

  // Also update corresponding primary tenant record
  const primaryTenant = db.tenants.find((t) => t.stayId === id && t.isRepresentative);
  if (primaryTenant) {
    if (representativeName !== undefined) primaryTenant.fullName = representativeName;
    if (representativePhone !== undefined) primaryTenant.phone = representativePhone;
  }

  persistDb(db);
  res.json({ success: true, stay });
});

// ================= METERS & READINGS =================
apiRouter.get('/meters', authenticateUser, (req, res) => {
  const db = getDb();
  const user = (req as any).user as User;

  if (user.role === 'tenant') {
    return res.json(db.meterReadings.filter((m) => m.roomId === user.roomId));
  }
  res.json(db.meterReadings);
});

apiRouter.post('/meters', authenticateUser, requireRole('landlord', 'assistant'), (req, res) => {
  const {
    roomId,
    period,
    electricStart,
    electricEnd,
    electricRate,
    waterStart,
    waterEnd,
    waterRate,
    waterBillingType,
    photoUrl,
    forceConfirmAnomaly,
  } = req.body;

  const db = getDb();
  const actor = (req as any).user;
  const room = db.rooms.find((r) => r.id === roomId);

  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng.' });
  }

  // Check meter smaller than previous (exception)
  let isAnomaly = false;
  let anomalyReason = '';
  if (electricEnd < electricStart) {
    isAnomaly = true;
    anomalyReason += 'Chỉ số điện mới nhỏ hơn chỉ số cũ (thay đồng hồ hoặc quay vòng). ';
  }
  if (waterEnd < waterStart) {
    isAnomaly = true;
    anomalyReason += 'Chỉ số nước mới nhỏ hơn chỉ số cũ. ';
  }

  // Check abnormal usage (>300 kWh or >30 m3 for a room)
  const eUsage = electricEnd >= electricStart ? electricEnd - electricStart : electricEnd;
  const wUsage = waterEnd >= waterStart ? waterEnd - waterStart : waterEnd;
  if (eUsage > 300) {
    isAnomaly = true;
    anomalyReason += `Lượng điện dùng bất thường (${eUsage} kWh). `;
  }
  if (wUsage > 30) {
    isAnomaly = true;
    anomalyReason += `Lượng nước dùng bất thường (${wUsage} m3). `;
  }

  if (isAnomaly && !forceConfirmAnomaly) {
    return res.status(400).json({
      error: 'Cảnh báo chỉ số bất thường hoặc nhỏ hơn chỉ số cũ!',
      isAnomaly: true,
      anomalyReason,
    });
  }

  const reading: MeterReading = {
    id: `mr-${room.code}-${period}`,
    roomId,
    period,
    recordedDate: new Date().toISOString().split('T')[0],
    recordedBy: actor.fullName,
    electricStart,
    electricEnd,
    electricUsage: eUsage,
    electricRate: electricRate || 3500,
    electricTotal: eUsage * (electricRate || 3500),
    waterStart,
    waterEnd,
    waterUsage: wUsage,
    waterRate: waterRate || 20000,
    waterTotal: wUsage * (waterRate || 20000),
    waterBillingType: waterBillingType || 'meter',
    isAnomaly,
    anomalyReason,
    meterPhotoUrl: photoUrl,
    isConfirmed: true,
  };

  // Upsert reading
  const existingIdx = db.meterReadings.findIndex((m) => m.roomId === roomId && m.period === period);
  if (existingIdx !== -1) {
    db.meterReadings[existingIdx] = reading;
  } else {
    db.meterReadings.push(reading);
  }

  // Update room current meter snapshot
  room.currentMeter = {
    electricNumber: electricEnd,
    waterNumber: waterEnd,
    electricLastRecordedDate: reading.recordedDate,
    waterLastRecordedDate: reading.recordedDate,
  };

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'RECORD_METER',
    'meter',
    reading.id,
    `Ghi chỉ số điện nước tháng ${period} phòng ${room.name}: Điện ${eUsage} kWh, Nước ${wUsage} m3`
  );

  persistDb(db);
  res.json(reading);
});

// "Ghi đồng hồ một vòng" - sequential 9 rooms batch record
apiRouter.post('/meters/batch', authenticateUser, requireRole('landlord', 'assistant'), (req, res) => {
  const { period, readings } = req.body as { period: string; readings: any[] };
  const db = getDb();
  const actor = (req as any).user;
  const savedReadings: MeterReading[] = [];

  for (const item of readings) {
    const room = db.rooms.find((r) => r.id === item.roomId);
    if (!room) continue;

    const eUsage = item.electricEnd >= item.electricStart ? item.electricEnd - item.electricStart : item.electricEnd;
    const wUsage = item.waterEnd >= item.waterStart ? item.waterEnd - item.waterStart : item.waterEnd;

    const reading: MeterReading = {
      id: `mr-${room.code}-${period}`,
      roomId: item.roomId,
      period,
      recordedDate: new Date().toISOString().split('T')[0],
      recordedBy: actor.fullName,
      electricStart: item.electricStart,
      electricEnd: item.electricEnd,
      electricUsage: eUsage,
      electricRate: item.electricRate || 3500,
      electricTotal: eUsage * (item.electricRate || 3500),
      waterStart: item.waterStart,
      waterEnd: item.waterEnd,
      waterUsage: wUsage,
      waterRate: item.waterRate || 20000,
      waterTotal: wUsage * (item.waterRate || 20000),
      waterBillingType: item.waterBillingType || 'meter',
      isAnomaly: Boolean(item.isAnomaly),
      anomalyReason: item.anomalyReason,
      meterPhotoUrl: item.meterPhotoUrl,
      isConfirmed: true,
    };

    const exIdx = db.meterReadings.findIndex((m) => m.roomId === item.roomId && m.period === period);
    if (exIdx !== -1) {
      db.meterReadings[exIdx] = reading;
    } else {
      db.meterReadings.push(reading);
    }

    room.currentMeter = {
      electricNumber: item.electricEnd,
      waterNumber: item.waterEnd,
      electricLastRecordedDate: reading.recordedDate,
      waterLastRecordedDate: reading.recordedDate,
    };
    savedReadings.push(reading);
  }

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'RECORD_METER_BATCH',
    'meter',
    `batch-${period}`,
    `Hoàn tất ghi một vòng đồng hồ điện nước 9 phòng tháng ${period}`
  );

  persistDb(db);
  res.json({ success: true, savedCount: savedReadings.length, readings: savedReadings });
});

// ================= INVOICES =================
apiRouter.get('/invoices', authenticateUser, (req, res) => {
  const db = getDb();
  const user = (req as any).user as User;
  const { period, roomId } = req.query;

  let list = db.invoices;

  // Tenant security isolation
  if (user.role === 'tenant') {
    list = list.filter((i) => i.roomId === user.roomId);
  } else if (roomId) {
    list = list.filter((i) => i.roomId === roomId);
  }

  if (period) {
    list = list.filter((i) => i.periodMonth === period);
  }

  res.json(list);
});

apiRouter.post('/invoices/generate', authenticateUser, requireRole('landlord'), (req, res) => {
  const { periodMonth } = req.body;
  const db = getDb();
  const actor = (req as any).user;

  if (!periodMonth) {
    return res.status(400).json({ error: 'Vui lòng chọn kỳ thu (YYYY-MM).' });
  }

  const generatedInvoices: Invoice[] = [];

  for (const room of db.rooms) {
    if (room.status === 'vacant') continue; // Phòng trống không tự phát sinh tiền

    const activeStay = db.tenancies.find((s) => s.id === room.currentStayId && s.status === 'active');
    if (!activeStay) continue;

    // Check if invoice already exists
    const existing = db.invoices.find((inv) => inv.roomId === room.id && inv.periodMonth === periodMonth);
    if (existing && existing.status === 'locked') {
      // Don't overwrite locked invoice!
      generatedInvoices.push(existing);
      continue;
    }

    // Get meter reading for this period
    const reading = db.meterReadings.find((m) => m.roomId === room.id && m.period === periodMonth);

    const items: InvoiceItem[] = [
      {
        id: `it-rent-${room.code}-${periodMonth}`,
        type: 'rent',
        name: `Tiền thuê phòng tháng ${periodMonth}`,
        amount: activeStay.baseRent,
      },
    ];

    if (reading) {
      items.push({
        id: `it-elec-${room.code}-${periodMonth}`,
        type: 'electricity' as const,
        name: `Điện (${reading.electricUsage} kWh x ${reading.electricRate.toLocaleString('vi-VN')} đ)`,
        quantity: reading.electricUsage,
        unitPrice: reading.electricRate,
        amount: reading.electricTotal,
      });

      items.push({
        id: `it-water-${room.code}-${periodMonth}`,
        type: 'water' as const,
        name: `Nước (${reading.waterUsage} m3 x ${reading.waterRate.toLocaleString('vi-VN')} đ)`,
        quantity: reading.waterUsage,
        unitPrice: reading.waterRate,
        amount: reading.waterTotal,
      });
    }

    if (activeStay.garbageFee > 0) {
      items.push({
        id: `it-garb-${room.code}-${periodMonth}`,
        type: 'garbage' as const,
        name: 'Rác vệ sinh',
        amount: activeStay.garbageFee,
      });
    }

    if (activeStay.internetFee > 0) {
      items.push({
        id: `it-net-${room.code}-${periodMonth}`,
        type: 'internet' as const,
        name: 'Wifi cáp quang',
        amount: activeStay.internetFee,
      });
    }

    const currentCycleTotal = items.reduce((sum, it) => sum + it.amount, 0);

    // Calculate previous unpaid debt from earlier locked invoices or initial contract debt
    let previousDebt = activeStay.initialDebt || 0;
    const earlierInvoices = db.invoices.filter(
      (inv) => inv.roomId === room.id && inv.periodMonth < periodMonth && inv.status === 'locked'
    );
    for (const prevInv of earlierInvoices) {
      previousDebt += prevInv.remainingBalance;
    }

    // Check available advance balance
    const availableAdvances = db.advanceBalances
      .filter((a) => a.stayId === activeStay.id && a.availableAmount > 0)
      .reduce((sum, a) => sum + a.availableAmount, 0);

    const appliedAdvance = Math.min(availableAdvances, currentCycleTotal + previousDebt);
    const paidAmount = existing ? existing.paidAmount : 0;
    const remainingBalance = currentCycleTotal + previousDebt - appliedAdvance - paidAmount;

    const newInvoice: Invoice = {
      id: existing ? existing.id : `inv-${room.code}-${periodMonth}`,
      invoiceCode: `HD-${periodMonth.replace('-', '')}-${room.code}`,
      roomId: room.id,
      stayId: activeStay.id,
      periodMonth,
      utilityPeriodMonth: periodMonth,
      createdDate: new Date().toISOString().split('T')[0],
      dueDate: `${periodMonth}-10`,
      payerName: activeStay.representativeName,
      items,
      currentCycleTotal,
      previousDebt,
      appliedAdvance,
      paidAmount,
      remainingBalance,
      status: existing ? existing.status : 'draft',
      paymentStatus: remainingBalance <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
      version: existing ? existing.version + 1 : 1,
    };

    if (existing) {
      const idx = db.invoices.findIndex((i) => i.id === existing.id);
      db.invoices[idx] = newInvoice;
    } else {
      db.invoices.push(newInvoice);
    }
    generatedInvoices.push(newInvoice);
  }

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'GENERATE_INVOICES',
    'invoice',
    `period-${periodMonth}`,
    `Tạo/cập nhật bảng kê tính tiền tháng ${periodMonth} cho các phòng`
  );

  persistDb(db);
  res.json({ success: true, invoices: generatedInvoices });
});

apiRouter.post('/invoices/:id/lock', authenticateUser, requireRole('landlord'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const actor = (req as any).user;
  const invoice = db.invoices.find((i) => i.id === id);

  if (!invoice) {
    return res.status(404).json({ error: 'Không tìm thấy hóa đơn.' });
  }

  invoice.status = 'locked';
  invoice.lockedAt = new Date().toISOString();
  invoice.lockedBy = actor.fullName;
  invoice.version += 1;

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'LOCK_INVOICE',
    'invoice',
    id,
    `Chốt bảng tiền ${invoice.invoiceCode} phòng ${invoice.roomId}`
  );

  persistDb(db);
  res.json(invoice);
});

apiRouter.post('/invoices/:id/adjust', authenticateUser, requireRole('landlord'), (req, res) => {
  const { id } = req.params;
  const { amount, reason, type } = req.body; // type: 'increase' or 'decrease'
  const db = getDb();
  const actor = (req as any).user;
  const invoice = db.invoices.find((i) => i.id === id);

  if (!invoice) {
    return res.status(404).json({ error: 'Không tìm thấy hóa đơn.' });
  }

  const adjustmentAmount = type === 'decrease' ? -Math.abs(amount) : Math.abs(amount);

  invoice.items.push({
    id: `adj-${Date.now()}`,
    type: 'adjustment',
    name: `Điều chỉnh ${type === 'decrease' ? 'giảm' : 'tăng'}: ${reason}`,
    amount: adjustmentAmount,
    note: reason,
  });

  invoice.currentCycleTotal += adjustmentAmount;

  // Recalculate remaining balance
  const newNetDue = invoice.currentCycleTotal + invoice.previousDebt - invoice.appliedAdvance;
  if (invoice.paidAmount > newNetDue) {
    // Overpayment occurred! Move surplus to advance balances!
    const surplus = invoice.paidAmount - newNetDue;
    invoice.remainingBalance = 0;
    invoice.paymentStatus = 'paid';
    db.advanceBalances.push({
      id: `adv-surplus-${Date.now()}`,
      stayId: invoice.stayId,
      roomId: invoice.roomId,
      amount: surplus,
      availableAmount: surplus,
      source: 'overpayment',
      date: new Date().toISOString(),
      note: `Tiền dư phát sinh sau khi điều chỉnh giảm hóa đơn ${invoice.invoiceCode}`,
    });
  } else {
    invoice.remainingBalance = newNetDue - invoice.paidAmount;
    invoice.paymentStatus = invoice.remainingBalance <= 0 ? 'paid' : invoice.paidAmount > 0 ? 'partial' : 'unpaid';
  }

  invoice.version += 1;

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'ADJUST_INVOICE',
    'invoice',
    id,
    `Điều chỉnh ${type === 'decrease' ? 'giảm' : 'tăng'} ${Math.abs(amount).toLocaleString('vi-VN')} đ cho ${invoice.invoiceCode}. Lý do: ${reason}`
  );

  persistDb(db);
  res.json(invoice);
});

apiRouter.post('/invoices/:id/extend', authenticateUser, requireRole('landlord'), (req, res) => {
  const { id } = req.params;
  const { extendedDate, reason } = req.body;
  const db = getDb();
  const actor = (req as any).user;
  const invoice = db.invoices.find((i) => i.id === id);

  if (!invoice) {
    return res.status(404).json({ error: 'Không tìm thấy hóa đơn.' });
  }

  invoice.extendedDueDate = extendedDate;
  invoice.version += 1;

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'EXTEND_INVOICE_DUE_DATE',
    'invoice',
    id,
    `Gia hạn thanh toán hóa đơn ${invoice.invoiceCode} đến ngày ${extendedDate}. Lý do: ${reason || 'Khách hẹn'}`
  );

  persistDb(db);
  res.json(invoice);
});

// ================= PAYMENTS (THU TIỀN) =================
apiRouter.get('/payments', authenticateUser, (req, res) => {
  const db = getDb();
  const user = (req as any).user as User;

  if (user.role === 'tenant') {
    return res.json(db.payments.filter((p) => p.roomId === user.roomId));
  }
  res.json(db.payments);
});

apiRouter.post('/payments', authenticateUser, requireRole('landlord', 'assistant'), (req, res) => {
  const {
    roomId,
    invoiceId,
    amount,
    payerName,
    method,
    bankTransactionRef,
    notes,
    idempotencyKey,
    allocations,
  } = req.body;

  const db = getDb();
  const actor = (req as any).user;

  // 1. Idempotency Check (Chống bấm 2 lần / mạng thử lại)
  if (idempotencyKey) {
    const existingPayment = db.payments.find((p) => p.idempotencyKey === idempotencyKey);
    if (existingPayment) {
      return res.json({ payment: existingPayment, isDuplicate: true });
    }
  }

  const room = db.rooms.find((r) => r.id === roomId);
  const paymentAmount = Number(amount);

  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Số tiền thu không hợp lệ.' });
  }

  let allocatedTotal = 0;
  const finalAllocations: PaymentAllocation[] = [];

  // If allocations specified explicitly
  if (allocations && Array.isArray(allocations) && allocations.length > 0) {
    for (const alloc of allocations) {
      const inv = db.invoices.find((i) => i.id === alloc.invoiceId);
      if (inv) {
        const allocAmt = Math.min(alloc.amount, inv.remainingBalance);
        inv.paidAmount += allocAmt;
        inv.remainingBalance -= allocAmt;
        inv.paymentStatus = inv.remainingBalance <= 0 ? 'paid' : 'partial';
        inv.version += 1;
        allocatedTotal += allocAmt;
        finalAllocations.push({
          invoiceId: inv.id,
          period: inv.periodMonth,
          amount: allocAmt,
        });
      }
    }
  } else if (invoiceId) {
    // Allocate to specific invoice
    const inv = db.invoices.find((i) => i.id === invoiceId);
    if (inv) {
      const allocAmt = Math.min(paymentAmount, inv.remainingBalance);
      inv.paidAmount += allocAmt;
      inv.remainingBalance -= allocAmt;
      inv.paymentStatus = inv.remainingBalance <= 0 ? 'paid' : 'partial';
      inv.version += 1;
      allocatedTotal += allocAmt;
      finalAllocations.push({
        invoiceId: inv.id,
        period: inv.periodMonth,
        amount: allocAmt,
      });
    }
  } else if (roomId) {
    // Smart sequential allocation: past unpaid invoices first, then current
    const unpaidInvoices = db.invoices
      .filter((i) => i.roomId === roomId && i.remainingBalance > 0 && i.status !== 'cancelled')
      .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));

    let remainingToAllocate = paymentAmount;
    for (const inv of unpaidInvoices) {
      if (remainingToAllocate <= 0) break;
      const allocAmt = Math.min(remainingToAllocate, inv.remainingBalance);
      inv.paidAmount += allocAmt;
      inv.remainingBalance -= allocAmt;
      inv.paymentStatus = inv.remainingBalance <= 0 ? 'paid' : 'partial';
      inv.version += 1;
      allocatedTotal += allocAmt;
      remainingToAllocate -= allocAmt;
      finalAllocations.push({
        invoiceId: inv.id,
        period: inv.periodMonth,
        amount: allocAmt,
      });
    }
  }

  const unallocatedAmount = paymentAmount - allocatedTotal;

  // If there's surplus unallocated money and room is identified, add to advance balances!
  if (unallocatedAmount > 0 && room && room.currentStayId) {
    db.advanceBalances.push({
      id: `adv-pay-${Date.now()}`,
      stayId: room.currentStayId,
      roomId: room.id,
      amount: unallocatedAmount,
      availableAmount: unallocatedAmount,
      source: 'overpayment',
      date: new Date().toISOString(),
      note: `Tiền thu dư từ phiếu thu`,
    });
  }

  const paymentCode = `PT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
  const payment: Payment = {
    id: `pay-${Date.now()}`,
    paymentCode,
    roomId: roomId || '',
    stayId: room ? room.currentStayId || undefined : undefined,
    invoiceId,
    amount: paymentAmount,
    receivedAt: new Date().toISOString(),
    payerName: payerName || (room ? room.name : 'Khách'),
    receivedBy: actor.fullName,
    method: method || 'transfer',
    bankTransactionRef,
    allocations: finalAllocations,
    unallocatedAmount,
    isReconciled: Boolean(roomId),
    status: 'valid',
    notes,
    idempotencyKey,
  };

  db.payments.unshift(payment);

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'RECORD_PAYMENT',
    'payment',
    payment.id,
    `Ghi nhận thu tiền ${payment.amount.toLocaleString('vi-VN')} đ từ ${payment.payerName} (${payment.method})`
  );

  persistDb(db);
  res.json({ payment, isDuplicate: false });
});

// Reversal (Hủy thu tiền sai - đảo số dư và phân bổ)
apiRouter.post('/payments/:id/reverse', authenticateUser, requireRole('landlord'), (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const db = getDb();
  const actor = (req as any).user;
  const payment = db.payments.find((p) => p.id === id);

  if (!payment) {
    return res.status(404).json({ error: 'Không tìm thấy phiếu thu.' });
  }

  if (payment.status === 'reversed') {
    return res.status(400).json({ error: 'Phiếu thu này đã được hủy trước đó.' });
  }

  // Reverse allocations across all affected invoices
  for (const alloc of payment.allocations) {
    const inv = db.invoices.find((i) => i.id === alloc.invoiceId);
    if (inv) {
      inv.paidAmount -= alloc.amount;
      inv.remainingBalance += alloc.amount;
      inv.paymentStatus = inv.paidAmount <= 0 ? 'unpaid' : 'partial';
      inv.version += 1;
    }
  }

  // Deduct unallocated advance balance if surplus was added
  if (payment.unallocatedAmount > 0) {
    const advIndex = db.advanceBalances.findIndex((a) => a.relatedPaymentId === payment.id);
    if (advIndex !== -1) {
      db.advanceBalances.splice(advIndex, 1);
    }
  }

  payment.status = 'reversed';
  payment.reversedAt = new Date().toISOString();
  payment.reversedBy = actor.fullName;
  payment.reversedReason = reason || 'Hủy ghi nhận thu sai';

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'REVERSE_PAYMENT',
    'payment',
    payment.id,
    `Hủy phiếu thu ${payment.paymentCode} (${payment.amount.toLocaleString('vi-VN')} đ). Lý do: ${payment.reversedReason}`
  );

  persistDb(db);
  res.json({ success: true, payment });
});

// Reconcile unidentified payment (Gán phòng cho khoản chờ đối soát)
apiRouter.post('/payments/:id/reconcile', authenticateUser, requireRole('landlord'), (req, res) => {
  const { id } = req.params;
  const { roomId, invoiceId } = req.body;
  const db = getDb();
  const actor = (req as any).user;
  const payment = db.payments.find((p) => p.id === id);

  if (!payment) {
    return res.status(404).json({ error: 'Không tìm thấy phiếu thu.' });
  }

  const room = db.rooms.find((r) => r.id === roomId);
  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng tương ứng.' });
  }

  payment.roomId = roomId;
  payment.stayId = room.currentStayId || undefined;
  payment.isReconciled = true;

  // Allocate to invoice if available
  if (invoiceId) {
    const inv = db.invoices.find((i) => i.id === invoiceId);
    if (inv) {
      const allocAmt = Math.min(payment.amount, inv.remainingBalance);
      inv.paidAmount += allocAmt;
      inv.remainingBalance -= allocAmt;
      inv.paymentStatus = inv.remainingBalance <= 0 ? 'paid' : 'partial';
      inv.version += 1;
      payment.allocations = [{ invoiceId: inv.id, period: inv.periodMonth, amount: allocAmt }];
      payment.unallocatedAmount = payment.amount - allocAmt;
    }
  }

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'RECONCILE_PAYMENT',
    'payment',
    payment.id,
    `Đối soát và gán khoản thu ${payment.paymentCode} cho ${room.name}`
  );

  persistDb(db);
  res.json({ success: true, payment });
});

// ================= DEPOSITS & ADVANCES =================
apiRouter.get('/deposits', authenticateUser, (req, res) => {
  const db = getDb();
  const user = (req as any).user as User;

  if (user.role === 'tenant') {
    return res.json(db.depositTransactions.filter((d) => d.roomId === user.roomId));
  }
  res.json(db.depositTransactions);
});

apiRouter.post('/deposits', authenticateUser, requireRole('landlord'), (req, res) => {
  const { roomId, stayId, type, amount, reason } = req.body;
  const db = getDb();
  const actor = (req as any).user;

  const tx: DepositTransaction = {
    id: `dep-${Date.now()}`,
    roomId,
    stayId,
    type,
    amount: Number(amount),
    date: new Date().toISOString(),
    reason,
    recordedBy: actor.fullName,
  };

  db.depositTransactions.push(tx);

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'DEPOSIT_TRANSACTION',
    'deposit',
    tx.id,
    `Biến động tiền cọc: ${type} ${tx.amount.toLocaleString('vi-VN')} đ. Lý do: ${reason}`
  );

  persistDb(db);
  res.json(tx);
});

apiRouter.get('/advances', authenticateUser, (req, res) => {
  const db = getDb();
  const user = (req as any).user as User;

  if (user.role === 'tenant') {
    return res.json(db.advanceBalances.filter((a) => a.roomId === user.roomId));
  }
  res.json(db.advanceBalances);
});

apiRouter.post('/advances/refund', authenticateUser, requireRole('landlord'), (req, res) => {
  const { advanceId, refundAmount, reason } = req.body;
  const db = getDb();
  const actor = (req as any).user;
  const adv = db.advanceBalances.find((a) => a.id === advanceId);

  if (!adv) {
    return res.status(404).json({ error: 'Không tìm thấy số dư trả trước.' });
  }

  const amt = Number(refundAmount);
  if (amt > adv.availableAmount) {
    return res.status(400).json({ error: 'Số tiền hoàn trả vượt quá số dư khả dụng.' });
  }

  adv.availableAmount -= amt;

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'REFUND_ADVANCE',
    'settings',
    adv.id,
    `Hoàn tiền trả trước ${amt.toLocaleString('vi-VN')} đ cho khách. Lý do: ${reason}`
  );

  persistDb(db);
  res.json({ success: true, remainingAvailable: adv.availableAmount });
});

// ================= DAY-10 REMINDERS =================
apiRouter.get('/reminders/pending', authenticateUser, requireRole('landlord', 'assistant'), (req, res) => {
  const db = getDb();
  const currentPeriod = new Date().toISOString().slice(0, 7);

  // Filter rooms that still owe money
  const pendingInvoices = db.invoices.filter(
    (inv) => inv.periodMonth === currentPeriod && inv.remainingBalance > 0 && inv.status === 'locked'
  );

  const pendingList = pendingInvoices.map((inv) => {
    const room = db.rooms.find((r) => r.id === inv.roomId);
    const stay = db.tenancies.find((s) => s.id === inv.stayId);
    const reading = db.meterReadings.find((m) => m.roomId === inv.roomId && m.period === currentPeriod);

    const rentItem = inv.items.find((it) => it.type === 'rent');
    const elecItem = inv.items.find((it) => it.type === 'electricity');
    const waterItem = inv.items.find((it) => it.type === 'water');
    const otherSum = inv.items
      .filter((it) => it.type !== 'rent' && it.type !== 'electricity' && it.type !== 'water')
      .reduce((sum, it) => sum + it.amount, 0);

    return {
      invoiceId: inv.id,
      invoiceCode: inv.invoiceCode,
      roomId: inv.roomId,
      roomName: room ? room.name : inv.roomId,
      roomCode: room ? room.code : '',
      payerName: inv.payerName,
      phone: stay ? stay.representativePhone : '',
      remainingBalance: inv.remainingBalance,
      dueDate: inv.extendedDueDate || inv.dueDate,
      isExtended: Boolean(inv.extendedDueDate),
      formattedAmount: `${inv.remainingBalance.toLocaleString('vi-VN')} đ`,
      // Rich Zalo meter breakdown
      electricStart: reading ? reading.electricStart : 1200,
      electricEnd: reading ? reading.electricEnd : 1280,
      electricRate: reading ? reading.electricRate : (stay ? stay.electricityRate : 5000),
      waterStart: reading ? reading.waterStart : 340,
      waterEnd: reading ? reading.waterEnd : 350,
      waterRate: reading ? reading.waterRate : (stay ? stay.waterRate : 4000),
      baseRent: rentItem ? rentItem.amount : (stay ? stay.baseRent : room ? room.currentRent : 1500000),
      otherFees: otherSum,
      previousDebt: inv.previousDebt,
      appliedAdvance: inv.appliedAdvance,
    };
  });

  res.json(pendingList);
});

apiRouter.post('/reminders/log-sent', authenticateUser, requireRole('landlord', 'assistant'), (req, res) => {
  const { invoiceId, channel, content } = req.body;
  const db = getDb();
  const actor = (req as any).user;
  const inv = db.invoices.find((i) => i.id === invoiceId);

  if (inv) {
    if (!inv.reminderLogs) inv.reminderLogs = [];
    inv.reminderLogs.push({
      sentAt: new Date().toISOString(),
      channel: channel || 'zalo',
      content,
      status: 'sent',
    });
    addAuditLog(
      { id: actor.id, name: actor.fullName, role: actor.role },
      'SEND_REMINDER',
      'invoice',
      inv.id,
      `Gửi nhắc tiền qua ${channel} cho phòng ${inv.roomId}`
    );
    persistDb(db);
  }

  res.json({ success: true });
});

// ================= MAINTENANCE & EXPENSES =================
apiRouter.get('/maintenance', authenticateUser, (req, res) => {
  const db = getDb();
  const user = (req as any).user as User;

  if (user.role === 'tenant') {
    return res.json(db.maintenanceTickets.filter((t) => t.roomId === user.roomId));
  }
  res.json(db.maintenanceTickets);
});

apiRouter.post('/maintenance', authenticateUser, (req, res) => {
  const { roomId, title, description, photoUrl } = req.body;
  const db = getDb();
  const user = (req as any).user as User;

  const targetRoomId = user.role === 'tenant' ? user.roomId : roomId;
  const room = db.rooms.find((r) => r.id === targetRoomId);

  const ticket: MaintenanceTicket = {
    id: `maint-${Date.now()}`,
    roomId: targetRoomId || 'room-P01',
    tenantName: user.fullName,
    title,
    description,
    photoUrl,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  db.maintenanceTickets.unshift(ticket);
  addAuditLog(
    { id: user.id, name: user.fullName, role: user.role },
    'CREATE_MAINTENANCE_TICKET',
    'settings',
    ticket.id,
    `Tạo báo cáo sự cố hư hỏng: ${title} tại ${room ? room.name : targetRoomId}`
  );

  persistDb(db);
  res.json(ticket);
});

apiRouter.put('/maintenance/:id', authenticateUser, requireRole('landlord'), (req, res) => {
  const { id } = req.params;
  const { status, resolutionNote, cost, handler } = req.body;
  const db = getDb();
  const actor = (req as any).user;
  const ticket = db.maintenanceTickets.find((t) => t.id === id);

  if (!ticket) {
    return res.status(404).json({ error: 'Không tìm thấy sự cố bảo trì.' });
  }

  ticket.status = status;
  ticket.resolutionNote = resolutionNote;
  ticket.cost = cost ? Number(cost) : undefined;
  ticket.handler = handler;
  ticket.updatedAt = new Date().toISOString();

  // If cost incurred, auto record expense
  if (cost && Number(cost) > 0) {
    db.expenses.push({
      id: `exp-maint-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      category: 'repairs',
      title: `Chi phí sửa chữa sự cố: ${ticket.title} (${ticket.roomId})`,
      amount: Number(cost),
      paidBy: actor.fullName,
      notes: resolutionNote,
    });
  }

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'RESOLVE_MAINTENANCE_TICKET',
    'settings',
    ticket.id,
    `Cập nhật tiến độ bảo trì ${ticket.title}: ${status}`
  );

  persistDb(db);
  res.json(ticket);
});

apiRouter.get('/expenses', authenticateUser, requireRole('landlord'), (req, res) => {
  const db = getDb();
  res.json(db.expenses);
});

apiRouter.post('/expenses', authenticateUser, requireRole('landlord'), (req, res) => {
  const { category, title, amount, paidBy, notes } = req.body;
  const db = getDb();
  const actor = (req as any).user;

  const expense: HouseExpense = {
    id: `exp-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    category,
    title,
    amount: Number(amount),
    paidBy: paidBy || actor.fullName,
    notes,
  };

  db.expenses.unshift(expense);
  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'CREATE_EXPENSE',
    'expense',
    expense.id,
    `Ghi nhận chi phí khu trọ: ${title} (${expense.amount.toLocaleString('vi-VN')} đ)`
  );

  persistDb(db);
  res.json(expense);
});

// ================= REPORTS =================
apiRouter.get('/reports', authenticateUser, requireRole('landlord'), (req, res) => {
  const db = getDb();
  const { period } = req.query as { period?: string };

  const targetPeriod = period || new Date().toISOString().slice(0, 7);

  const periodInvoices = db.invoices.filter((i) => i.periodMonth === targetPeriod && i.status !== 'cancelled');
  const periodPayments = db.payments.filter((p) => p.status === 'valid' && p.receivedAt.startsWith(targetPeriod));
  const periodExpenses = db.expenses.filter((e) => e.date.startsWith(targetPeriod));

  const totalBilled = periodInvoices.reduce((sum, i) => sum + i.currentCycleTotal, 0);
  const totalDebtBroughtForward = periodInvoices.reduce((sum, i) => sum + i.previousDebt, 0);
  const totalCashCollected = periodPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalAllocatedToInvoices = periodInvoices.reduce((sum, i) => sum + i.paidAmount, 0);
  const totalRemainingDebt = periodInvoices.reduce((sum, i) => sum + i.remainingBalance, 0);
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalDepositsHeld = db.depositTransactions.reduce((sum, d) => {
    if (d.type === 'received') return sum + d.amount;
    if (d.type === 'refunded' || d.type === 'transferred_to_payment') return sum - d.amount;
    return sum;
  }, 0);

  // Breakdown per room
  const roomBreakdown = db.rooms.map((r) => {
    const inv = periodInvoices.find((i) => i.roomId === r.id);
    return {
      roomId: r.id,
      roomCode: r.code,
      roomName: r.name,
      status: r.status,
      currentCycleTotal: inv ? inv.currentCycleTotal : 0,
      previousDebt: inv ? inv.previousDebt : 0,
      paidAmount: inv ? inv.paidAmount : 0,
      remainingBalance: inv ? inv.remainingBalance : 0,
      paymentStatus: inv ? inv.paymentStatus : r.status === 'vacant' ? 'vacant' : 'unpaid',
    };
  });

  res.json({
    period: targetPeriod,
    summary: {
      totalBilled, // Phát sinh phải thu kỳ này
      totalDebtBroughtForward, // Nợ trước mang sang
      totalCashCollected, // Tiền thực nhận trong kỳ theo ngày giao dịch
      totalAllocatedToInvoices, // Đã phân bổ vào hóa đơn
      totalRemainingDebt, // Còn thiếu phải thu
      totalExpenses, // Chi phí vận hành khu trọ
      totalDepositsHeld, // Tiền cọc đang giữ
      netCashFlow: totalCashCollected - totalExpenses, // Dòng tiền thực nhận trừ chi phí
    },
    roomBreakdown,
  });
});

// ================= AUDIT LOGS =================
apiRouter.get('/audit-logs', authenticateUser, requireRole('landlord'), (req, res) => {
  const db = getDb();
  res.json(db.auditLogs);
});

// ================= BACKUP & RESTORE =================
apiRouter.get('/backup/export', authenticateUser, requireRole('landlord'), (req, res) => {
  const db = getDb();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="troxanh_backup_${Date.now()}.json"`);
  res.send(JSON.stringify(db, null, 2));
});

apiRouter.post('/backup/restore', authenticateUser, requireRole('landlord'), (req, res) => {
  const { data } = req.body;
  const actor = (req as any).user;

  if (!data || !data.rooms || !data.profile) {
    return res.status(400).json({ error: 'Cấu trúc tệp sao lưu không hợp lệ.' });
  }

  // Pre-restore verification
  const roomCount = data.rooms.length;
  const invoiceCount = (data.invoices || []).length;
  const paymentCount = (data.payments || []).length;

  persistDb(data);

  addAuditLog(
    { id: actor.id, name: actor.fullName, role: actor.role },
    'RESTORE_BACKUP',
    'backup',
    `restore-${Date.now()}`,
    `Phục hồi cơ sở dữ liệu thành công (${roomCount} phòng, ${invoiceCount} hóa đơn, ${paymentCount} phiếu thu)`
  );

  res.json({
    success: true,
    message: 'Phục hồi dữ liệu thành công!',
    metrics: { roomCount, invoiceCount, paymentCount },
  });
});

apiRouter.get('/backup/list', authenticateUser, requireRole('landlord'), (req, res) => {
  const backups = listBackups();
  res.json(backups);
});

apiRouter.post('/backup/trigger-now', authenticateUser, requireRole('landlord'), (req, res) => {
  const db = getDb();
  const filename = createAutomaticBackup(db, 'manual');
  res.json({ success: true, filename });
});

// ================= ACCEPTANCE TEST SUITE =================
apiRouter.get('/test-suite/run', authenticateUser, (req, res) => {
  const results = runAll32AcceptanceTests();
  res.json(results);
});
