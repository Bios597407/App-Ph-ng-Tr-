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
import { getClientFallbackDb, saveClientFallbackDb } from '../utils/clientDbFallback.ts';

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
    return this.request('/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({ periodMonth }),
    });
  }

  async lockInvoice(id: string): Promise<Invoice> {
    return this.request(`/invoices/${id}/lock`, { method: 'POST' });
  }

  async adjustInvoice(id: string, data: { amount: number; reason: string; type: 'increase' | 'decrease' }): Promise<Invoice> {
    return this.request(`/invoices/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async extendInvoice(id: string, data: { extendedDate: string; reason?: string }): Promise<Invoice> {
    return this.request(`/invoices/${id}/extend`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Payments
  async getPayments(): Promise<Payment[]> {
    return this.request<Payment[]>('/payments');
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
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reversePayment(id: string, reason: string): Promise<{ success: boolean; payment: Payment }> {
    return this.request(`/payments/${id}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async reconcilePayment(id: string, data: { roomId: string; invoiceId?: string }): Promise<{ success: boolean; payment: Payment }> {
    return this.request(`/payments/${id}/reconcile`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Deposits & Advances
  async getDeposits(): Promise<DepositTransaction[]> {
    return this.request<DepositTransaction[]>('/deposits');
  }

  async addDeposit(data: any): Promise<DepositTransaction> {
    return this.request('/deposits', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAdvances(): Promise<AdvanceBalanceItem[]> {
    return this.request<AdvanceBalanceItem[]>('/advances');
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
