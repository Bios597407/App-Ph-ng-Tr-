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
    if (!this.token) {
      this.currentUser = null;
      return null;
    }
    try {
      const res = await this.request<{ user: User; mode: 'live' | 'demo' }>('/auth/me', { silent: true });
      this.currentUser = res.user;
      this.mode = res.mode;
      return res;
    } catch {
      this.setToken(null);
      this.currentUser = null;
      return null;
    }
  }

  async switchMode(mode: 'live' | 'demo') {
    const res = await this.request<{ success: boolean; mode: 'live' | 'demo' }>('/auth/switch-mode', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
    this.mode = res.mode;
    return res;
  }

  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/auth/users');
  }

  async createUser(data: Partial<User>): Promise<User> {
    return this.request<User>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // House Profile
  async getHouse(): Promise<{ profile: HouseProfile; mode: 'live' | 'demo' }> {
    return this.request('/house');
  }

  async updateHouse(profile: Partial<HouseProfile>): Promise<HouseProfile> {
    return this.request('/house', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  }

  async submitSetupWizard(data: any): Promise<{ success: boolean; profile: HouseProfile }> {
    return this.request('/house/setup-wizard', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Rooms
  async getRooms(): Promise<Room[]> {
    return this.request<Room[]>('/rooms');
  }

  async updateRoom(id: string, data: Partial<Room>): Promise<Room> {
    return this.request<Room>(`/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Tenants & Stays
  async getTenants(): Promise<{ tenants: Tenant[]; tenancies: TenancyStay[] }> {
    return this.request('/tenants');
  }

  async newTenancy(data: any): Promise<{ stay: TenancyStay; room: Room }> {
    return this.request('/tenancies/new', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async endTenancy(data: any): Promise<{ success: boolean; stay: TenancyStay }> {
    return this.request('/tenancies/end', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTenancy(stayId: string, data: Partial<TenancyStay>): Promise<{ success: boolean; stay: TenancyStay }> {
    return this.request(`/tenancies/${stayId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Meters
  async getMeters(): Promise<MeterReading[]> {
    return this.request<MeterReading[]>('/meters');
  }

  async recordMeter(data: any): Promise<MeterReading> {
    return this.request<MeterReading>('/meters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async recordMeterBatch(period: string, readings: any[]): Promise<{ success: boolean; savedCount: number }> {
    return this.request('/meters/batch', {
      method: 'POST',
      body: JSON.stringify({ period, readings }),
    });
  }

  // Invoices
  async getInvoices(params?: { period?: string; roomId?: string }): Promise<Invoice[]> {
    const q = new URLSearchParams(params as any).toString();
    return this.request<Invoice[]>(`/invoices${q ? `?${q}` : ''}`);
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
