import { Room, Invoice, MeterReading, HouseProfile, Payment } from '../types/index.ts';

export interface BillingBreakdown {
  roomId: string;
  roomCode: string;
  roomName: string;
  periodMonth: string;

  // 1. Rent
  baseRent: number;

  // 2. Electricity
  electricStart: number;
  electricEnd: number;
  electricUsage: number;
  electricRate: number;
  electricTotal: number;

  // 3. Water
  waterStart: number;
  waterEnd: number;
  waterUsage: number;
  waterRate: number;
  waterTotal: number;

  // 4. Service fees
  garbageFee: number;
  internetFee: number;
  otherFee: number;
  totalServiceFees: number;

  // 5. Current Cycle Total (1 + 2 + 3 + 4)
  currentCycleTotal: number;

  // 6. Previous Debt
  previousDebt: number;

  // 7. Paid Amount
  paidAmount: number;

  // Total Expected (currentCycleTotal + previousDebt)
  totalExpected: number;

  // 8. Remaining Balance
  remainingBalance: number;

  // Is fully paid
  isPaid: boolean;
}

export interface BillingOverrides {
  rent?: number;
  electricStart?: number;
  electricEnd?: number;
  electricRate?: number;
  waterStart?: number;
  waterEnd?: number;
  waterRate?: number;
  garbageFee?: number;
  internetFee?: number;
  otherFee?: number;
}

export function calculateRoomBillingBreakdown(params: {
  room: Room;
  currentPeriod: string;
  invoice?: Invoice;
  meterReading?: MeterReading;
  profile?: HouseProfile;
  payments?: Payment[];
  allInvoices?: Invoice[];
  overrides?: BillingOverrides;
}): BillingBreakdown {
  const {
    room,
    currentPeriod,
    invoice,
    meterReading,
    profile,
    payments = [],
    allInvoices = [],
    overrides = {},
  } = params;

  // 1. Base Rent
  const baseRent =
    overrides.rent !== undefined
      ? overrides.rent
      : invoice
      ? invoice.items.find((i) => i.type === 'rent')?.amount ?? room.currentRent
      : room.currentRent;

  // 2. Electricity
  const rawERate =
    overrides.electricRate !== undefined
      ? overrides.electricRate
      : meterReading?.electricRate ??
        invoice?.items.find((i) => i.type === 'electricity')?.unitPrice ??
        profile?.electricityDefaultRate ??
        5000;
  const electricRate = rawERate <= 100 ? rawERate * 1000 : rawERate;

  const electricStart =
    overrides.electricStart !== undefined
      ? overrides.electricStart
      : meterReading?.electricStart ??
        invoice?.items.find((i) => i.type === 'electricity')?.quantity ??
        Math.max(0, (room.currentMeter?.electricNumber ?? 1280) - 80);

  const electricEnd =
    overrides.electricEnd !== undefined
      ? overrides.electricEnd
      : meterReading?.electricEnd ??
        (room.currentMeter?.electricNumber ?? electricStart + 80);

  const electricUsage = Math.max(0, electricEnd - electricStart);
  const electricTotal =
    invoice?.items.find((i) => i.type === 'electricity')?.amount ??
    electricUsage * electricRate;

  // 3. Water
  const rawWRate =
    overrides.waterRate !== undefined
      ? overrides.waterRate
      : meterReading?.waterRate ??
        invoice?.items.find((i) => i.type === 'water')?.unitPrice ??
        profile?.waterDefaultRate ??
        4000;
  const waterRate = rawWRate <= 100 ? rawWRate * 1000 : rawWRate;

  const waterStart =
    overrides.waterStart !== undefined
      ? overrides.waterStart
      : meterReading?.waterStart ??
        Math.max(0, (room.currentMeter?.waterNumber ?? 350) - 10);

  const waterEnd =
    overrides.waterEnd !== undefined
      ? overrides.waterEnd
      : meterReading?.waterEnd ??
        (room.currentMeter?.waterNumber ?? waterStart + 10);

  const waterUsage = Math.max(0, waterEnd - waterStart);
  const waterTotal =
    invoice?.items.find((i) => i.type === 'water')?.amount ??
    waterUsage * waterRate;

  // 4. Service fees
  const garbageFee =
    overrides.garbageFee !== undefined
      ? overrides.garbageFee
      : invoice?.items.find((i) => i.type === 'garbage')?.amount ??
        profile?.garbageDefaultFee ??
        0;

  const internetFee =
    overrides.internetFee !== undefined
      ? overrides.internetFee
      : invoice?.items.find((i) => i.type === 'internet')?.amount ??
        profile?.internetDefaultFee ??
        0;

  const otherFee =
    overrides.otherFee !== undefined
      ? overrides.otherFee
      : invoice?.items.find((i) => i.type === 'other')?.amount ?? 0;

  const totalServiceFees = garbageFee + internetFee + otherFee;

  // 5. Current Cycle Total (1 + 2 + 3 + 4)
  const currentCycleTotal =
    overrides.rent !== undefined ||
    overrides.electricEnd !== undefined ||
    overrides.waterEnd !== undefined ||
    overrides.garbageFee !== undefined ||
    overrides.internetFee !== undefined ||
    overrides.otherFee !== undefined
      ? baseRent + electricTotal + waterTotal + totalServiceFees
      : invoice
      ? invoice.currentCycleTotal
      : baseRent + electricTotal + waterTotal + totalServiceFees;

  // 6. Previous Debt (Calculate from previous month invoice if not explicitly set)
  const [currYear, currMonth] = currentPeriod.split('-').map(Number);
  const prevDate = new Date(currYear, currMonth - 2, 1);
  const previousPeriod = `${prevDate.getFullYear()}-${String(
    prevDate.getMonth() + 1
  ).padStart(2, '0')}`;

  const prevInv = allInvoices.find(
    (i) => i.roomId === room.id && i.periodMonth === previousPeriod && i.status !== 'cancelled'
  );
  const derivedPrevDebt = prevInv ? Math.max(0, prevInv.remainingBalance) : 0;

  let previousDebt =
    invoice?.previousDebt !== undefined && invoice.previousDebt > 0
      ? invoice.previousDebt
      : derivedPrevDebt;

  // SYSTEM OVERRIDE: Reset all debts for October 2026 as per Admin instruction
  if (currentPeriod === '2026-10') {
    previousDebt = 0;
  }

  // 7. Paid Amount (Directly computed from payments array or invoice)
  const roomPeriodPayments = payments.filter((p) => {
    if (p.roomId !== room.id || p.status === 'reversed') return false;
    const matchesAlloc = p.allocations?.some(
      (a) => a.invoiceId === invoice?.id || a.period === currentPeriod
    );
    const matchesPeriod = p.receivedAt?.slice(0, 7) === currentPeriod;
    return matchesAlloc || matchesPeriod;
  });
  const paymentsSum = roomPeriodPayments.reduce((s, p) => s + p.amount, 0);

  const paidAmount = Math.max(
    invoice?.paidAmount || 0,
    paymentsSum,
    invoice?.appliedAdvance || 0
  );

  // Total Expected & 8. Remaining Balance
  const totalExpected = currentCycleTotal + previousDebt;
  const remainingBalance = Math.max(0, totalExpected - paidAmount);
  const isPaid = remainingBalance <= 0;

  return {
    roomId: room.id,
    roomCode: room.code,
    roomName: room.name,
    periodMonth: currentPeriod,
    baseRent,
    electricStart,
    electricEnd,
    electricUsage,
    electricRate,
    electricTotal,
    waterStart,
    waterEnd,
    waterUsage,
    waterRate,
    waterTotal,
    garbageFee,
    internetFee,
    otherFee,
    totalServiceFees,
    currentCycleTotal,
    previousDebt,
    paidAmount,
    totalExpected,
    remainingBalance,
    isPaid,
  };
}
