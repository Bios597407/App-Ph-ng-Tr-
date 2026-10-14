/**
 * TroXanh 9P - Data Model & Type Definitions
 * Spec: 9-room boarding house in Vietnam
 */

export type UserRole = 'landlord' | 'assistant' | 'tenant';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  roomId?: string; // Assigned room for tenant
  activeStayId?: string; // Active contract for tenant
  isRevoked?: boolean;
  createdAt: string;
}

export type RoomStatus = 'rented' | 'vacant' | 'maintenance';

export interface PriceHistoryItem {
  id: string;
  effectiveDate: string;
  baseRent: number;
  electricityRate: number; // e.g. 3500 VND/kWh
  waterRate: number; // e.g. 20000 VND/m3 or 50000 VND/person
  waterBillingType: 'meter' | 'per_person' | 'fixed_room';
  internetFee: number;
  wasteFee: number;
  otherFees?: { name: string; amount: number }[];
  note?: string;
}

export interface Room {
  id: string;
  code: string; // P01 to P09 (can be renamed)
  name: string; // e.g. Phòng 101
  status: RoomStatus;
  currentRent: number;
  areaM2?: number;
  maxOccupants?: number;
  amenities: string[];
  notes?: string;
  currentStayId?: string | null;
  priceHistory: PriceHistoryItem[];
  currentMeter: {
    electricNumber: number;
    waterNumber: number;
    electricLastRecordedDate?: string;
    waterLastRecordedDate?: string;
  };
}

export interface Tenant {
  id: string;
  fullName: string;
  phone: string;
  idCardNumber?: string;
  isRepresentative: boolean; // Người chịu trách nhiệm thanh toán
  roomId: string;
  stayId: string;
  moveInDate: string;
  moveOutDate?: string;
  notes?: string;
}

export interface TenancyStay {
  id: string;
  roomId: string;
  representativeName: string;
  representativePhone: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'ended';
  baseRent: number;
  depositAmount: number;
  initialDebt: number; // Nợ đầu kỳ nếu có
  initialDebtNote?: string;
  initialAdvancePayment: number; // Tiền trả trước ban đầu
  paymentDueDay: number; // Default 10th of the month
  waterBillingType: 'meter' | 'per_person' | 'fixed_room';
  electricityRate: number;
  waterRate: number;
  garbageFee: number;
  internetFee: number;
  oddDayCalculationRule: 'actual_days' | 'standard_30_days'; // Cách tính kỳ lẻ
  coOccupantsCount: number;
  contractNotes?: string;
  endedAt?: string;
  moveOutSettlement?: {
    finalElectricNumber: number;
    finalWaterNumber: number;
    deductions: { reason: string; amount: number }[];
    refundedDeposit: number;
    remainingDebt: number;
    settledDate: string;
    note?: string;
  };
}

export interface MeterReading {
  id: string;
  roomId: string;
  period: string; // YYYY-MM
  recordedDate: string;
  recordedBy: string;
  // Electricity
  electricStart: number;
  electricEnd: number;
  electricUsage: number;
  electricRate: number;
  electricTotal: number;
  // Water
  waterStart: number;
  waterEnd: number;
  waterUsage: number;
  waterRate: number;
  waterTotal: number;
  waterBillingType: 'meter' | 'per_person' | 'fixed_room';
  // Alerts & anomalies
  isAnomaly: boolean;
  anomalyReason?: string;
  meterPhotoUrl?: string;
  isConfirmed: boolean;
}

export interface InvoiceItem {
  id: string;
  type: 'rent' | 'electricity' | 'water' | 'garbage' | 'internet' | 'other' | 'adjustment';
  name: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  note?: string;
}

export type InvoiceStatus = 'draft' | 'locked' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface Invoice {
  id: string;
  invoiceCode: string; // HD-202610-P01
  roomId: string;
  stayId: string;
  periodMonth: string; // YYYY-MM (Kỳ thuê)
  utilityPeriodMonth?: string; // YYYY-MM (Kỳ điện/nước nếu lệch)
  createdDate: string;
  dueDate: string; // Mặc định ngày 10
  extendedDueDate?: string; // Gia hạn nếu có
  payerName: string;
  items: InvoiceItem[];
  // Summary amounts
  currentCycleTotal: number; // Phát sinh kỳ này
  previousDebt: number; // Nợ trước còn lại (từ các kỳ trước)
  appliedAdvance: number; // Trả trước đã bù trừ
  paidAmount: number; // Đã thanh toán
  remainingBalance: number; // Còn phải trả = (currentCycleTotal + previousDebt - appliedAdvance - paidAmount)
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  lockedAt?: string;
  lockedBy?: string;
  cancelledAt?: string;
  cancelledReason?: string;
  version: number; // For optimistic locking
  notes?: string;
  reminderLogs?: {
    sentAt: string;
    channel: 'sms' | 'zalo' | 'manual';
    content: string;
    status: 'sent' | 'pending';
  }[];
}

export interface PaymentAllocation {
  invoiceId: string;
  period: string;
  amount: number;
  itemType?: string; // rent, utilities, debt
}

export interface Payment {
  id: string;
  paymentCode: string; // PT-20261012-001
  roomId: string;
  stayId?: string;
  invoiceId?: string;
  amount: number;
  receivedAt: string; // ISO DateTime
  payerName: string;
  receivedBy: string; // Landlord or assistant
  method: 'cash' | 'transfer';
  bankTransactionRef?: string;
  allocations: PaymentAllocation[];
  unallocatedAmount: number; // Tiền dư chuyển trả trước hoặc chờ đối soát
  isReconciled: boolean;
  status: 'valid' | 'reversed' | 'refunded';
  reversedReason?: string;
  reversedAt?: string;
  reversedBy?: string;
  notes?: string;
  proofImageUrl?: string;
  idempotencyKey?: string;
}

export interface DepositTransaction {
  id: string;
  stayId: string;
  roomId: string;
  type: 'received' | 'deducted' | 'transferred_to_payment' | 'refunded';
  amount: number;
  date: string;
  reason: string;
  recordedBy: string;
  relatedPaymentId?: string;
  proofImageUrl?: string;
}

export interface AdvanceBalanceItem {
  id: string;
  stayId: string;
  roomId: string;
  amount: number;
  availableAmount: number;
  source: 'overpayment' | 'initial_balance' | 'manual_credit';
  relatedPaymentId?: string;
  date: string;
  note?: string;
}

export interface HouseExpense {
  id: string;
  date: string;
  category: 'electricity_master' | 'water_master' | 'repairs' | 'internet_master' | 'taxes' | 'cleaning' | 'other';
  title: string;
  amount: number;
  paidBy: string;
  receiptPhoto?: string;
  notes?: string;
}

export interface MaintenanceTicket {
  id: string;
  roomId: string;
  tenantName: string;
  title: string;
  description: string;
  photoUrl?: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  createdAt: string;
  updatedAt?: string;
  cost?: number;
  handler?: string;
  resolutionNote?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  role: string;
  action: string;
  targetType: 'room' | 'invoice' | 'payment' | 'meter' | 'tenancy' | 'deposit' | 'settings' | 'expense' | 'backup';
  targetId: string;
  description: string;
  beforeSnapshot?: any;
  afterSnapshot?: any;
}

export interface BankAccountConfig {
  bankId: string; // e.g. MB, VCB, ACB, TPB
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrTemplate: 'compact' | 'qr_only' | 'print';
}

export interface HouseProfile {
  name: string; // e.g. Nhà Trọ An Bình 9P
  address: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  defaultDueDay: number; // 10
  defaultCutoffDay: number; // e.g. 5 or 10
  electricityDefaultRate: number; // 3500
  waterDefaultRate: number; // 20000 or 50000/person
  waterDefaultType: 'meter' | 'per_person' | 'fixed_room';
  internetDefaultFee: number; // 50000
  garbageDefaultFee: number; // 30000
  bankAccount: BankAccountConfig;
  reminderMessageTemplate: string;
  isInitialSetupCompleted: boolean;
}

export interface AppDatabase {
  profile: HouseProfile;
  rooms: Room[];
  tenancies: TenancyStay[];
  tenants: Tenant[];
  meterReadings: MeterReading[];
  invoices: Invoice[];
  payments: Payment[];
  depositTransactions: DepositTransaction[];
  advanceBalances: AdvanceBalanceItem[];
  expenses: HouseExpense[];
  maintenanceTickets: MaintenanceTicket[];
  users: User[];
  auditLogs: AuditLogItem[];
  lastBackupDate?: string;
  version: number;
}
