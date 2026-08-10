import { Decimal } from "decimal.js";

export interface DashboardInvoiceRow {
  number: string;
  issuedAt: Date;
  customerName: string;
  channel: string;
  grossRevenue: Decimal.Value;
  netRevenue: Decimal.Value;
  cost: Decimal.Value;
  tax: Decimal.Value;
  profit: Decimal.Value;
  status: string;
  hasBoleto: boolean;
  hasTracking: boolean;
}

export interface DashboardMonth {
  month: string;
  label: string;
  grossRevenue: string;
  profit: string;
  cost: string;
}

export interface DashboardAggregate {
  metrics: {
    grossRevenue: string;
    netRevenue: string;
    cost: string;
    tax: string;
    profit: string;
    marginPercent: string;
    invoiceCount: number;
  };
  months: DashboardMonth[];
  recentInvoices: Array<{
    number: string;
    issuedAt: string;
    customerName: string;
    channel: string;
    value: string;
    status: string;
    hasBoleto: boolean;
    hasTracking: boolean;
  }>;
}

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export function aggregateDashboard(
  rows: readonly DashboardInvoiceRow[],
  monthKeys: readonly string[],
): DashboardAggregate {
  let grossRevenue = new Decimal(0);
  let netRevenue = new Decimal(0);
  let cost = new Decimal(0);
  let tax = new Decimal(0);
  let profit = new Decimal(0);

  const buckets = new Map(
    monthKeys.map((month) => [
      month,
      {
        grossRevenue: new Decimal(0),
        profit: new Decimal(0),
        cost: new Decimal(0),
      },
    ]),
  );

  for (const row of rows) {
    const rowGross = new Decimal(row.grossRevenue);
    const rowCost = new Decimal(row.cost);
    const rowProfit = new Decimal(row.profit);
    grossRevenue = grossRevenue.plus(rowGross);
    netRevenue = netRevenue.plus(row.netRevenue);
    cost = cost.plus(rowCost);
    tax = tax.plus(row.tax);
    profit = profit.plus(rowProfit);

    const bucket = buckets.get(toMonthKey(row.issuedAt));
    if (bucket) {
      bucket.grossRevenue = bucket.grossRevenue.plus(rowGross);
      bucket.cost = bucket.cost.plus(rowCost);
      bucket.profit = bucket.profit.plus(rowProfit);
    }
  }

  return {
    metrics: {
      grossRevenue: money(grossRevenue),
      netRevenue: money(netRevenue),
      cost: money(cost),
      tax: money(tax),
      profit: money(profit),
      marginPercent: grossRevenue.isZero()
        ? "0.00"
        : profit.dividedBy(grossRevenue).times(100).toFixed(2),
      invoiceCount: rows.length,
    },
    months: monthKeys.map((month) => {
      const bucket = buckets.get(month);
      if (!bucket) throw new Error(`Mês não inicializado: ${month}`);
      const monthIndex = Number(month.slice(5, 7)) - 1;
      return {
        month,
        label: MONTH_LABELS[monthIndex] ?? month,
        grossRevenue: money(bucket.grossRevenue),
        profit: money(bucket.profit),
        cost: money(bucket.cost),
      };
    }),
    recentInvoices: [...rows]
      .sort((left, right) => right.issuedAt.getTime() - left.issuedAt.getTime())
      .slice(0, 8)
      .map((row) => ({
        number: row.number,
        issuedAt: row.issuedAt.toISOString(),
        customerName: row.customerName,
        channel: row.channel,
        value: money(new Decimal(row.grossRevenue)),
        status: row.status,
        hasBoleto: row.hasBoleto,
        hasTracking: row.hasTracking,
      })),
  };
}

export function dashboardMonthKeys(reference: Date, count: number): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 24) {
    throw new Error("O período deve ter entre 1 e 24 meses");
  }
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - index, 1),
    );
    return toMonthKey(date);
  }).reverse();
}

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function money(value: Decimal): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}
