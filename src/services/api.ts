import {
  AppDatabase,
  HouseProfile,
  Invoice,
  MeterReading,
  Payment,
  Room,
  TenancyStay,
  Tenant,
  User,
  DepositTransaction,
  AdvanceBalanceItem,
  HouseExpense,
  MaintenanceTicket,
  AuditLogItem,
} from '../types/index.ts';
import {
  getClientFallbackDb,
  saveClientFallbackDb,
  updateRoomBillingClient,
  RoomBillingUpdatePayload,
} from '../utils/clientDbFallback.ts';

const TOKEN_KEY = 'troxanh_auth_token';
const OFFLINE_CACHE_KEY = 'troxanh_offline_cache';

export class ApiClient {
  private token: string | null = null;
  public currentUser: User | null = null;
  public mode: 'live' | 'demo' = 'live';

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & { silent?: boolean } = {}
  ): Promise<T> {
    const { silent, ...fetchOptions } = options;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`/api${endpoint}`, {
        ...fetchOptions,
        headers,
      });

      if (!response.ok) {
        let errorMsg = `Lỗi máy chủ (${response.status})`;
        try {
          const errData = await response.json();
          if (errData.error) errorMsg = errData.error;
        } catch {
          // ignore
        }
        if (response.status === 401) {
          this.setToken(null);
        }
        throw new Error(errorMsg);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (!silent) {
        console.error(`API Error [${endpoint}]:`, err);
      }
      throw err;
    }
  }

  // Auth
  async login(username: string, password?: string) {
    const res = await this.request<{ token: string; user: User; mode: 'live' | 'demo' }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(res.token);
    this.currentUser = res.user;
    this.mode = res.mode;
    return res;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST', silent: true });
    } catch {
      // ignore
    }
    this.setToken(null);
    this.currentUser = null;
  }

  async getMe() {
    const landlordUser: User = {
      id: 'user-landlord',
      username: 'chutro',
      fullName: 'Quản Lý Phòng',
      role: 'landlord',
      phone: '0909123456',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    if (!this.token) {
      this.currentUser = landlordUser;
      return { user: landlordUser, mode: 'live' as const };
    }
    try {
      const res = await this.request<{ user: User; mode: 'live' | 'demo' }>('/auth/me', { silent: true });
      this.currentUser = res.user;
      this.mode = res.mode;
      return res;
    } catch {
      this.setToken(null);
      this.currentUser = landlordUser;
      return { user: landlordUser, mode: 'live' as const };
    }
  }

  async switchMode(mode: 'live' | 'demo') {
    try {
      const res = await this.request<{ success: boolean; mode: 'live' | 'demo' }>('/auth/switch-mode', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      this.mode = res.mode;
      return res;
    } catch {
      this.mode = mode;
      return { success: true, mode };
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      return await this.request<User[]>('/auth/users');
    } catch {
      const db = getClientFallbackDb();
      return db.users;
    }
  }

  async createUser(data: Partial<User>): Promise<User> {
    try {
      return await this.request<User>('/auth/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      const newUser: User = {
        id: `user-${Date.now()}`,
        username: data.username || 'user',
        fullName: data.fullName || 'Người Dùng',
        role: data.role || 'tenant',
        createdAt: new Date().toISOString(),
      };
      db.users.push(newUser);
      saveClientFallbackDb(db);
      return newUser;
    }
  }

  // House Profile
  async getHouse(): Promise<{ profile: HouseProfile; mode: 'live' | 'demo' }> {
    try {
      return await this.request('/house');
    } catch {
      const db = getClientFallbackDb();
      return { profile: db.profile, mode: 'live' };
    }
  }

  async updateHouse(profile: Partial<HouseProfile>): Promise<HouseProfile> {
    try {
      return await this.request('/house', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
    } catch {
      const db = getClientFallbackDb();
      db.profile = { ...db.profile, ...profile };
      saveClientFallbackDb(db);
      return db.profile;
    }
  }

  async submitSetupWizard(data: any): Promise<{ success: boolean; profile: HouseProfile }> {
    try {
      return await this.request('/house/setup-wizard', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      if (data.profile) db.profile = { ...db.profile, ...data.profile };
      saveClientFallbackDb(db);
      return { success: true, profile: db.profile };
    }
  }

  // Rooms
  async getRooms(): Promise<Room[]> {
    try {
      const rooms = await this.request<Room[]>('/rooms');
      if (rooms && rooms.length > 0) return rooms;
      const db = getClientFallbackDb();
      return db.rooms;
    } catch {
      const db = getClientFallbackDb();
      return db.rooms;
    }
  }

  async updateRoom(id: string, data: Partial<Room>): Promise<Room> {
    try {
      return await this.request<Room>(`/rooms/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      const idx = db.rooms.findIndex((r) => r.id === id);
      if (idx !== -1) {
        db.rooms[idx] = { ...db.rooms[idx], ...data };
        saveClientFallbackDb(db);
        return db.rooms[idx];
      }
      throw new Error('Phòng không tồn tại');
    }
  }

  // Tenants & Stays
  async getTenants(): Promise<{ tenants: Tenant[]; tenancies: TenancyStay[] }> {
    try {
      return await this.request('/tenants');
    } catch {
      const db = getClientFallbackDb();
      return { tenants: db.tenants, tenancies: db.tenancies };
    }
  }

  async newTenancy(data: any): Promise<{ stay: TenancyStay; room: Room }> {
    try {
      return await this.request('/tenancies/new', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      const stayId = `stay-${data.roomId}-${Date.now()}`;
      const stay: TenancyStay = {
        id: stayId,
        roomId: data.roomId,
        representativeName: data.representativeName || 'Người Thuê Mới',
        representativePhone: data.representativePhone || '0900000000',
        startDate: data.startDate || new Date().toISOString().slice(0, 10),
        status: 'active',
        baseRent: data.baseRent || 1500000,
        depositAmount: data.depositAmount || 1500000,
        initialDebt: 0,
        initialAdvancePayment: 0,
        paymentDueDay: 10,
        waterBillingType: 'meter',
        electricityRate: 3500,
        waterRate: 20000,
        garbageFee: 30000,
        internetFee: 50000,
        oddDayCalculationRule: 'standard_30_days',
        coOccupantsCount: 1,
      };
      db.tenancies.push(stay);
      const roomIdx = db.rooms.findIndex((r) => r.id === data.roomId);
      if (roomIdx !== -1) {
        db.rooms[roomIdx].status = 'rented';
        db.rooms[roomIdx].currentStayId = stayId;
      }
      saveClientFallbackDb(db);
      return { stay, room: db.rooms[roomIdx] };
    }
  }

  async endTenancy(data: any): Promise<{ success: boolean; stay: TenancyStay }> {
    try {
      return await this.request('/tenancies/end', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      const stay = db.tenancies.find((s) => s.id === data.stayId);
      if (stay) {
        stay.status = 'ended';
        const room = db.rooms.find((r) => r.id === stay.roomId);
        if (room) {
          room.status = 'vacant';
          room.currentStayId = null;
        }
        saveClientFallbackDb(db);
        return { success: true, stay };
      }
      throw new Error('Hợp đồng không tồn tại');
    }
  }

  async updateTenancy(stayId: string, data: Partial<TenancyStay>): Promise<{ success: boolean; stay: TenancyStay }> {
    try {
      return await this.request(`/tenancies/${stayId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      const stay = db.tenancies.find((s) => s.id === stayId);
      if (stay) {
        Object.assign(stay, data);
        saveClientFallbackDb(db);
        return { success: true, stay };
      }
      throw new Error('Hợp đồng không tồn tại');
    }
  }

  // Meters
  async getMeters(): Promise<MeterReading[]> {
    try {
      const meters = await this.request<MeterReading[]>('/meters');
      if (meters) return meters;
      const db = getClientFallbackDb();
      return db.meterReadings;
    } catch {
      const db = getClientFallbackDb();
      return db.meterReadings;
    }
  }

  async recordMeter(data: any): Promise<MeterReading> {
    try {
      return await this.request<MeterReading>('/meters', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      const existingIdx = db.meterReadings.findIndex(
        (m) => m.roomId === data.roomId && m.period === data.period
      );
      const eUsage = Math.max(0, (data.electricEnd || 0) - (data.electricStart || 0));
      const wUsage = Math.max(0, (data.waterEnd || 0) - (data.waterStart || 0));
      const eRate = data.electricRate || 3500;
      const wRate = data.waterRate || 20000;
      const newMeter: MeterReading = {
        id: existingIdx !== -1 ? db.meterReadings[existingIdx].id : `meter-${data.roomId}-${data.period}`,
        roomId: data.roomId,
        period: data.period,
        electricStart: data.electricStart || 0,
        electricEnd: data.electricEnd || 0,
        electricUsage: eUsage,
        electricRate: eRate,
        electricTotal: eUsage * eRate,
        waterStart: data.waterStart || 0,
        waterEnd: data.waterEnd || 0,
        waterUsage: wUsage,
        waterRate: wRate,
        waterTotal: wUsage * wRate,
        waterBillingType: 'meter',
        isAnomaly: false,
        isConfirmed: true,
        recordedBy: 'user-landlord',
        recordedDate: new Date().toISOString(),
      };

      if (existingIdx !== -1) {
        db.meterReadings[existingIdx] = newMeter;
      } else {
        db.meterReadings.push(newMeter);
      }

      // Update room current meter
      const room = db.rooms.find((r) => r.id === data.roomId);
      if (room) {
        room.currentMeter = {
          electricNumber: data.electricEnd,
          waterNumber: data.waterEnd,
          electricLastRecordedDate: new Date().toISOString().slice(0, 10),
          waterLastRecordedDate: new Date().toISOString().slice(0, 10),
        };
      }

      saveClientFallbackDb(db);
      return newMeter;
    }
  }

  async recordMeterBatch(period: string, readings: any[]): Promise<{ success: boolean; savedCount: number }> {
    try {
      return await this.request('/meters/batch', {
        method: 'POST',
        body: JSON.stringify({ period, readings }),
      });
    } catch {
      for (const r of readings) {
        await this.recordMeter({ ...r, period });
      }
      return { success: true, savedCount: readings.length };
    }
  }

  async updateRoomBilling(payload: RoomBillingUpdatePayload): Promise<{ success: boolean; meter: MeterReading; invoice: Invoice }> {
    try {
      const res = await this.request<{ success: boolean; meter: MeterReading; invoice: Invoice }>('/meters/billing-update', {
        method: 'POST',
        body: JSON.stringify(payload),
        silent: true,
      });
      if (res && res.meter) return res;
      const db = getClientFallbackDb();
      const updated = updateRoomBillingClient(db, payload);
      return { success: true, meter: updated.meter, invoice: updated.invoice };
    } catch {
      const db = getClientFallbackDb();
      const updated = updateRoomBillingClient(db, payload);
      return { success: true, meter: updated.meter, invoice: updated.invoice };
    }
  }

  // Invoices
  async getInvoices(params?: { period?: string; roomId?: string }): Promise<Invoice[]> {
    try {
      const q = new URLSearchParams(params as any).toString();
      const invoices = await this.request<Invoice[]>(`/invoices${q ? `?${q}` : ''}`);
      if (invoices) return invoices;
      const db = getClientFallbackDb();
      if (params?.period) {
        return db.invoices.filter((i) => i.periodMonth === params.period);
      }
      return db.invoices;
    } catch {
      const db = getClientFallbackDb();
      if (params?.period) {
        return db.invoices.filter((i) => i.periodMonth === params.period);
      }
      return db.invoices;
    }
  }

  async generateInvoices(periodMonth: string): Promise<{ success: boolean; invoices: Invoice[] }> {
    try {
      return await this.request('/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({ periodMonth }),
      });
    } catch {
      const db = getClientFallbackDb();
      const [y, m] = periodMonth.split('-');
      const generated: Invoice[] = [];

      for (const room of db.rooms) {
        if (room.status === 'rented') {
          const code = room.code;
          const stay = db.tenancies.find((s) => s.id === room.currentStayId);
          const repName = stay?.representativeName || `Phòng ${code}`;
          const repPhone = stay?.representativePhone || '';

          const reading = db.meterReadings.find((mr) => mr.roomId === room.id && mr.period === periodMonth);
          const eUsage = reading ? reading.electricUsage : 0;
          const wUsage = reading ? reading.waterUsage : 0;
          const eRate = reading ? reading.electricRate : (db.profile?.electricityDefaultRate ?? 3500);
          const wRate = reading ? reading.waterRate : (db.profile?.waterDefaultRate ?? 20000);

          const items = [
            { id: `item-${code}-rent-${periodMonth}`, type: 'rent' as const, name: `Tiền thuê phòng tháng ${m}/${y}`, amount: room.currentRent },
            { id: `item-${code}-elec-${periodMonth}`, type: 'electricity' as const, name: `Điện (${eUsage} kWh)`, quantity: eUsage, unitPrice: eRate, amount: eUsage * eRate },
            { id: `item-${code}-water-${periodMonth}`, type: 'water' as const, name: `Nước (${wUsage} m³)`, quantity: wUsage, unitPrice: wRate, amount: wUsage * wRate },
            { id: `item-${code}-garb-${periodMonth}`, type: 'garbage' as const, name: 'Rác vệ sinh', amount: db.profile?.garbageDefaultFee ?? 30000 },
            { id: `item-${code}-net-${periodMonth}`, type: 'internet' as const, name: 'Wifi Internet', amount: db.profile?.internetDefaultFee ?? 50000 },
          ];

          const total = items.reduce((s, it) => s + it.amount, 0);

          const existingIdx = db.invoices.findIndex((inv) => inv.roomId === room.id && inv.periodMonth === periodMonth);
          const inv: Invoice = {
            id: `inv-${code}-${periodMonth.replace('-', '')}`,
            invoiceCode: `HD-${periodMonth.replace('-', '')}-${code}`,
            roomId: room.id,
            stayId: room.currentStayId || `stay-${code}-01`,
            periodMonth,
            status: 'draft',
            paymentStatus: 'unpaid',
            createdDate: new Date().toISOString().slice(0, 10),
            dueDate: `${y}-${m}-10`,
            items,
            currentCycleTotal: total,
            previousDebt: 0,
            appliedAdvance: 0,
            paidAmount: 0,
            remainingBalance: total,
            payerName: repName,
            version: 1,
          };

          if (existingIdx !== -1) {
            db.invoices[existingIdx] = inv;
          } else {
            db.invoices.push(inv);
          }
          generated.push(inv);
        }
      }

      saveClientFallbackDb(db);
      return { success: true, invoices: generated };
    }
  }

  async lockInvoice(id: string): Promise<Invoice> {
    try {
      return await this.request(`/invoices/${id}/lock`, { method: 'POST' });
    } catch {
      const db = getClientFallbackDb();
      const inv = db.invoices.find((i) => i.id === id);
      if (inv) {
        inv.status = 'locked';
        inv.lockedAt = new Date().toISOString();
        saveClientFallbackDb(db);
        return inv;
      }
      throw new Error('Hóa đơn không tồn tại');
    }
  }

  async adjustInvoice(id: string, data: { amount: number; reason: string; type: 'increase' | 'decrease' }): Promise<Invoice> {
    try {
      return await this.request(`/invoices/${id}/adjust`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      const inv = db.invoices.find((i) => i.id === id);
      if (inv) {
        if (data.type === 'increase') {
          inv.remainingBalance += data.amount;
          inv.currentCycleTotal += data.amount;
        } else {
          inv.remainingBalance = Math.max(0, inv.remainingBalance - data.amount);
          inv.currentCycleTotal = Math.max(0, inv.currentCycleTotal - data.amount);
        }
        saveClientFallbackDb(db);
        return inv;
      }
      throw new Error('Hóa đơn không tồn tại');
    }
  }

  async extendInvoice(id: string, data: { extendedDate: string; reason?: string }): Promise<Invoice> {
    try {
      return await this.request(`/invoices/${id}/extend`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      const inv = db.invoices.find((i) => i.id === id);
      if (inv) {
        inv.dueDate = data.extendedDate;
        saveClientFallbackDb(db);
        return inv;
      }
      throw new Error('Hóa đơn không tồn tại');
    }
  }

  // Payments
  async getPayments(): Promise<Payment[]> {
    try {
      const pays = await this.request<Payment[]>('/payments');
      if (pays) return pays;
      const db = getClientFallbackDb();
      return db.payments;
    } catch {
      const db = getClientFallbackDb();
      return db.payments;
    }
  }

  async recordPayment(data: {
    roomId?: string;
    invoiceId?: string;
    amount: number;
    payerName?: string;
    method: 'cash' | 'transfer';
    bankTransactionRef?: string;
    notes?: string;
    idempotencyKey?: string;
    allocations?: any[];
  }): Promise<{ payment: Payment; isDuplicate: boolean }> {
    try {
      return await this.request('/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      const paymentId = `pay-${data.roomId || 'gen'}-${Date.now()}`;
      const payment: Payment = {
        id: paymentId,
        paymentCode: `PT-${Date.now().toString().slice(-6)}`,
        roomId: data.roomId || '',
        invoiceId: data.invoiceId,
        amount: data.amount,
        receivedAt: new Date().toISOString(),
        payerName: data.payerName || 'Khách thuê',
        receivedBy: 'Nguyễn Văn Chủ',
        method: data.method,
        bankTransactionRef: data.bankTransactionRef,
        allocations: data.allocations || [],
        unallocatedAmount: 0,
        isReconciled: true,
        status: 'valid',
        notes: data.notes,
      };

      db.payments.push(payment);

      // Allocate payment to invoice
      if (data.invoiceId) {
        const inv = db.invoices.find((i) => i.id === data.invoiceId);
        if (inv) {
          inv.paidAmount = (inv.paidAmount || 0) + data.amount;
          inv.remainingBalance = Math.max(0, inv.remainingBalance - data.amount);
          inv.paymentStatus = inv.remainingBalance <= 0 ? 'paid' : 'partial';
        }
      } else if (data.roomId) {
        const roomInvs = db.invoices
          .filter((i) => i.roomId === data.roomId && i.remainingBalance > 0 && i.status !== 'cancelled')
          .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));

        let remToAlloc = data.amount;
        for (const inv of roomInvs) {
          if (remToAlloc <= 0) break;
          const alloc = Math.min(remToAlloc, inv.remainingBalance);
          inv.paidAmount = (inv.paidAmount || 0) + alloc;
          inv.remainingBalance = Math.max(0, inv.remainingBalance - alloc);
          inv.paymentStatus = inv.remainingBalance <= 0 ? 'paid' : 'partial';
          remToAlloc -= alloc;
        }
      }

      saveClientFallbackDb(db);
      return { payment, isDuplicate: false };
    }
  }

  async reversePayment(id: string, reason: string): Promise<{ success: boolean; payment: Payment }> {
    try {
      return await this.request(`/payments/${id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch {
      const db = getClientFallbackDb();
      const pay = db.payments.find((p) => p.id === id);
      if (pay) {
        pay.status = 'reversed';
        pay.notes = `${pay.notes || ''} [Hủy: ${reason}]`;
        saveClientFallbackDb(db);
        return { success: true, payment: pay };
      }
      throw new Error('Phiếu thu không tồn tại');
    }
  }

  async reconcilePayment(id: string, data: { roomId: string; invoiceId?: string }): Promise<{ success: boolean; payment: Payment }> {
    try {
      return await this.request(`/payments/${id}/reconcile`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      const pay = db.payments.find((p) => p.id === id);
      if (pay) {
        pay.isReconciled = true;
        saveClientFallbackDb(db);
        return { success: true, payment: pay };
      }
      throw new Error('Phiếu thu không tồn tại');
    }
  }

  // Deposits & Advances
  async getDeposits(): Promise<DepositTransaction[]> {
    try {
      const d = await this.request<DepositTransaction[]>('/deposits');
      if (d) return d;
      return getClientFallbackDb().depositTransactions;
    } catch {
      return getClientFallbackDb().depositTransactions;
    }
  }

  async addDeposit(data: any): Promise<DepositTransaction> {
    try {
      return await this.request('/deposits', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const db = getClientFallbackDb();
      const dep: DepositTransaction = {
        id: `dep-${Date.now()}`,
        roomId: data.roomId,
        stayId: data.stayId || `stay-${data.roomId}-01`,
        type: data.type || 'received',
        amount: data.amount,
        date: new Date().toISOString().slice(0, 10),
        reason: data.reason || 'Tiền cọc',
        recordedBy: 'Nguyễn Văn Chủ',
      };
      db.depositTransactions.push(dep);
      saveClientFallbackDb(db);
      return dep;
    }
  }

  async getAdvances(): Promise<AdvanceBalanceItem[]> {
    try {
      const a = await this.request<AdvanceBalanceItem[]>('/advances');
      if (a) return a;
      return getClientFallbackDb().advanceBalances;
    } catch {
      return getClientFallbackDb().advanceBalances;
    }
  }

  async refundAdvance(advanceId: string, refundAmount: number, reason: string): Promise<{ success: boolean }> {
    return this.request('/advances/refund', {
      method: 'POST',
      body: JSON.stringify({ advanceId, refundAmount, reason }),
    });
  }

  // Day 10 Reminders
  async getPendingReminders(): Promise<any[]> {
    return this.request('/reminders/pending');
  }

  async logReminderSent(data: { invoiceId: string; channel: string; content: string }): Promise<{ success: boolean }> {
    return this.request('/reminders/log-sent', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Maintenance & Expenses
  async getMaintenance(): Promise<MaintenanceTicket[]> {
    return this.request<MaintenanceTicket[]>('/maintenance');
  }

  async createMaintenance(data: { roomId?: string; title: string; description: string; photoUrl?: string }): Promise<MaintenanceTicket> {
    return this.request('/maintenance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMaintenance(id: string, data: any): Promise<MaintenanceTicket> {
    return this.request(`/maintenance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getExpenses(): Promise<HouseExpense[]> {
    return this.request<HouseExpense[]>('/expenses');
  }

  async createExpense(data: any): Promise<HouseExpense> {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Reports & Logs
  async getReports(period?: string): Promise<any> {
    return this.request(`/reports${period ? `?period=${period}` : ''}`);
  }

  async getAuditLogs(): Promise<AuditLogItem[]> {
    return this.request<AuditLogItem[]>('/audit-logs');
  }

  // Backup & Restore
  async exportBackup(): Promise<any> {
    const res = await fetch('/api/backup/export', {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return res.json();
  }

  async restoreBackup(data: any): Promise<any> {
    return this.request('/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  async listBackups(): Promise<any[]> {
    return this.request('/backup/list');
  }

  async triggerBackup(): Promise<any> {
    return this.request('/backup/trigger-now', { method: 'POST' });
  }

  // Acceptance Test Suite (32 cases)
  async runTestSuite(): Promise<any> {
    return this.request('/test-suite/run');
  }
}

export const api = new ApiClient();
