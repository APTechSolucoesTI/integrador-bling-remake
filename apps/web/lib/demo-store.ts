export const DEMO_STORAGE_KEY = "apbling:public-demo:v9";

export type DemoInvoiceStatus =
  "Autorizada" | "Pendente" | "Em processamento" | "Cancelada";
export type DemoDeliveryStatus =
  "Erro" | "Pronto para envio" | "Enviado" | "Mercado livre";

export interface DemoInvoice {
  id: string;
  number: string;
  customer: string;
  channel: string;
  issuedAt: string;
  valueCents: number;
  costCents: number;
  baseCostCents: number;
  taxCents: number;
  status: DemoInvoiceStatus;
  deliveryStatus: DemoDeliveryStatus;
  hasBoleto: boolean;
  hasTracking: boolean;
  unlinkedItemCode: string | null;
}

export interface DemoProduct {
  id: string;
  sku: string;
  name: string;
  ncm: string;
  costCents: number;
  ownManufacture: boolean;
  active: boolean;
}

export interface DemoPerson {
  id: string;
  name: string;
  city: string;
  state: string;
  orders: number;
  totalCents: number;
  messagingDisabled: boolean;
}

export type DemoSyncKind =
  | "nfe"
  | "nfe-details"
  | "nfe-delivery"
  | "nfe-normalization"
  | "payment-methods"
  | "sales-channels"
  | "sellers"
  | "operation-natures"
  | "products"
  | "scheduled-cycle"
  | "satisfaction";

export interface DemoSyncRun {
  id: string;
  kind: DemoSyncKind;
  from: string | null;
  to: string | null;
  processed: number;
  createdAt: string;
}

export interface DemoNcmCredit {
  id: string;
  ncm: string;
  rate: number;
  reduction: number;
}

export interface DemoFixedCost {
  id: string;
  name: string;
  value: number;
  valueType: "F" | "P";
  application: "Item" | "Nota";
  channels: string[];
}

export interface DemoState {
  version: 9;
  invoices: DemoInvoice[];
  products: DemoProduct[];
  people: DemoPerson[];
  goalCents: number;
  integrations: {
    bling: boolean;
    mercadoLivre: boolean;
    apchat: boolean;
  };
  automation: {
    scheduleHours: number[];
    autoDelivery: boolean;
    satisfactionEnabled: boolean;
    satisfactionHour: number;
    satisfactionDelayDays: number;
  };
  syncRuns: DemoSyncRun[];
  ncmCredits: DemoNcmCredit[];
  fixedCosts: DemoFixedCost[];
  updatedAt: string;
}

export interface DemoMetrics {
  revenueCents: number;
  costCents: number;
  taxCents: number;
  profitCents: number;
  marginBasisPoints: number;
  authorizedInvoices: number;
  synchronizedProducts: number;
}

export interface DemoDailyRevenue {
  medianCents: number;
  points: Array<{ date: string; revenueCents: number; invoices: number }>;
}

export interface DemoCustomerRanking {
  name: string;
  revenueCents: number;
  profitCents: number;
  averageTicketCents: number;
  invoices: number;
}

const DEFAULT_STATE: DemoState = {
  version: 9,
  invoices: [
    invoice(
      "nfe-10176",
      "000010176",
      "Comercial Aurora Ltda.",
      "Bling",
      "2026-08-08",
      289_940,
      148_320,
      31_420,
      "Autorizada",
      true,
      true,
    ),
    invoice(
      "nfe-10175",
      "000010175",
      "Casa Horizonte",
      "Mercado Livre",
      "2026-08-07",
      168_490,
      91_200,
      18_610,
      "Em processamento",
      false,
      true,
    ),
    invoice(
      "nfe-10174",
      "000010174",
      "Lumen Escritórios",
      "Loja virtual",
      "2026-08-06",
      421_000,
      221_880,
      47_320,
      "Autorizada",
      true,
      false,
    ),
    invoice(
      "nfe-10173",
      "000010173",
      "Mercado Bom Dia",
      "Mercado Livre",
      "2026-08-05",
      145_980,
      74_500,
      15_490,
      "Pendente",
      false,
      false,
    ),
    invoice(
      "nfe-10172",
      "000010172",
      "Studio Norte",
      "Venda direta",
      "2026-08-04",
      319_990,
      169_100,
      35_210,
      "Autorizada",
      true,
      true,
    ),
    invoice(
      "nfe-10171",
      "000010171",
      "Ponto Urbano",
      "Bling",
      "2026-08-03",
      97_500,
      52_400,
      10_730,
      "Autorizada",
      false,
      true,
    ),
    invoice(
      "nfe-10170",
      "000010170",
      "Loja Brisa",
      "Loja virtual",
      "2026-07-29",
      238_750,
      129_620,
      26_260,
      "Autorizada",
      true,
      false,
    ),
    invoice(
      "nfe-10169",
      "000010169",
      "Comercial Aurora Ltda.",
      "Bling",
      "2026-07-26",
      512_340,
      281_400,
      56_360,
      "Autorizada",
      true,
      true,
    ),
    invoice(
      "nfe-10168",
      "000010168",
      "Casa Horizonte",
      "Mercado Livre",
      "2026-07-22",
      184_900,
      96_800,
      20_340,
      "Cancelada",
      false,
      false,
    ),
    invoice(
      "nfe-10167",
      "000010167",
      "Mercado Bom Dia",
      "Venda direta",
      "2026-07-18",
      376_250,
      202_430,
      41_390,
      "Autorizada",
      true,
      true,
    ),
    invoice(
      "nfe-10166",
      "000010166",
      "Studio Norte",
      "Loja virtual",
      "2026-07-13",
      264_800,
      139_900,
      29_120,
      "Autorizada",
      false,
      true,
    ),
    invoice(
      "nfe-10165",
      "000010165",
      "Ponto Urbano",
      "Bling",
      "2026-07-09",
      128_700,
      67_400,
      14_160,
      "Pendente",
      true,
      false,
    ),
  ],
  products: [
    product(
      "prod-1",
      "CABO-USBC-2M",
      "Cabo USB-C Reforçado 2m",
      "85444200",
      2_890,
      false,
    ),
    product(
      "prod-2",
      "HUB-USB-8P",
      "Hub USB-C 8 portas",
      "84718000",
      14_700,
      false,
    ),
    product(
      "prod-3",
      "SUP-NOTE-AL",
      "Suporte para notebook alumínio",
      "76169900",
      9_420,
      true,
    ),
    product(
      "prod-4",
      "MOUSE-VERT",
      "Mouse vertical sem fio",
      "84716053",
      7_880,
      false,
    ),
    product(
      "prod-5",
      "TECL-MEC-84",
      "Teclado mecânico compacto",
      "84716052",
      18_950,
      false,
    ),
    product(
      "prod-6",
      "FONE-BT-PRO",
      "Headset Bluetooth Pro",
      "85183000",
      21_400,
      true,
    ),
  ],
  people: [
    person(
      "person-1",
      "Comercial Aurora Ltda.",
      "Curitiba",
      "PR",
      18,
      1_482_430,
    ),
    person("person-2", "Casa Horizonte", "São Paulo", "SP", 14, 1_165_800),
    person("person-3", "Studio Norte", "Belo Horizonte", "MG", 11, 942_550),
    person("person-4", "Mercado Bom Dia", "Florianópolis", "SC", 9, 718_900),
    person("person-5", "Ponto Urbano", "Goiânia", "GO", 7, 526_480),
  ],
  goalCents: 4_500_000,
  integrations: { bling: true, mercadoLivre: true, apchat: false },
  automation: {
    scheduleHours: [0, 17],
    autoDelivery: true,
    satisfactionEnabled: true,
    satisfactionHour: 10,
    satisfactionDelayDays: 3,
  },
  syncRuns: [
    {
      id: "sync-initial-nfe",
      kind: "nfe",
      from: "2026-07-01",
      to: "2026-08-08",
      processed: 12,
      createdAt: "2026-08-08T12:00:00.000Z",
    },
    {
      id: "sync-initial-products",
      kind: "products",
      from: null,
      to: null,
      processed: 6,
      createdAt: "2026-08-08T12:03:00.000Z",
    },
  ],
  ncmCredits: [
    { id: "ncm-84716052", ncm: "84716052", rate: 12, reduction: 0 },
    { id: "ncm-85444200", ncm: "85444200", rate: 7, reduction: 0 },
  ],
  fixedCosts: [
    {
      id: "cost-marketplace",
      name: "Comissão marketplace",
      value: 16,
      valueType: "P",
      application: "Item",
      channels: ["Mercado Livre"],
    },
    {
      id: "cost-packaging",
      name: "Embalagem operacional",
      value: 3.5,
      valueType: "F",
      application: "Item",
      channels: ["Bling", "Loja virtual"],
    },
    {
      id: "cost-admin",
      name: "Rateio administrativo",
      value: 2.25,
      valueType: "P",
      application: "Nota",
      channels: [],
    },
  ],
  updatedAt: "2026-08-08T12:00:00.000Z",
};

export function createDefaultDemoState(): DemoState {
  return structuredClone(DEFAULT_STATE);
}

export function loadDemoState(storage: Pick<Storage, "getItem">): DemoState {
  const raw = storage.getItem(DEMO_STORAGE_KEY);
  if (!raw) return createDefaultDemoState();
  try {
    const candidate: unknown = JSON.parse(raw);
    return isDemoState(candidate) ? candidate : createDefaultDemoState();
  } catch {
    return createDefaultDemoState();
  }
}

export function saveDemoState(
  storage: Pick<Storage, "setItem">,
  state: DemoState,
): boolean {
  try {
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function calculateDemoMetrics(state: DemoState): DemoMetrics {
  const included = state.invoices.filter((item) => item.status !== "Cancelada");
  const revenueCents = sum(included.map((item) => item.valueCents));
  const costCents = sum(included.map((item) => item.costCents));
  const taxCents = sum(included.map((item) => item.taxCents));
  const profitCents = revenueCents - costCents - taxCents;
  return {
    revenueCents,
    costCents,
    taxCents,
    profitCents,
    marginBasisPoints:
      revenueCents === 0
        ? 0
        : Math.round((profitCents * 10_000) / revenueCents),
    authorizedInvoices: included.filter((item) => item.status === "Autorizada")
      .length,
    synchronizedProducts: state.products.length,
  };
}

export function demoMonthlySeries(state: DemoState) {
  const months = [
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
  ];
  const historical = [2_180_000, 2_740_000, 2_530_000, 3_160_000, 3_495_740];
  const current = state.invoices
    .filter(
      (item) =>
        item.status !== "Cancelada" && item.issuedAt.startsWith("2026-08"),
    )
    .reduce((total, item) => total + item.valueCents, 0);
  return months.map((month, index) => ({
    month,
    label: ["Mar", "Abr", "Mai", "Jun", "Jul", "Ago"][index] ?? month,
    revenueCents: historical[index] ?? current,
  }));
}

export function demoDailyRevenue(state: DemoState): DemoDailyRevenue {
  const byDate = new Map<string, { revenueCents: number; invoices: number }>();
  for (const invoice of state.invoices) {
    if (invoice.status === "Cancelada") continue;
    const current = byDate.get(invoice.issuedAt) ?? {
      revenueCents: 0,
      invoices: 0,
    };
    current.revenueCents += invoice.valueCents;
    current.invoices += 1;
    byDate.set(invoice.issuedAt, current);
  }
  const points = [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]) => ({ date, ...values }));
  const orderedRevenue = points
    .map((point) => point.revenueCents)
    .sort((left, right) => left - right);
  const middle = Math.floor(orderedRevenue.length / 2);
  const medianCents = orderedRevenue.length
    ? orderedRevenue.length % 2
      ? (orderedRevenue[middle] ?? 0)
      : Math.round(
          ((orderedRevenue[middle - 1] ?? 0) + (orderedRevenue[middle] ?? 0)) /
            2,
        )
    : 0;
  return { medianCents, points };
}

export function demoCustomerRanking(state: DemoState): DemoCustomerRanking[] {
  const byCustomer = new Map<
    string,
    { revenueCents: number; profitCents: number; invoices: number }
  >();
  for (const invoice of state.invoices) {
    if (invoice.status === "Cancelada") continue;
    const current = byCustomer.get(invoice.customer) ?? {
      revenueCents: 0,
      profitCents: 0,
      invoices: 0,
    };
    current.revenueCents += invoice.valueCents;
    current.profitCents +=
      invoice.valueCents - invoice.costCents - invoice.taxCents;
    current.invoices += 1;
    byCustomer.set(invoice.customer, current);
  }
  return [...byCustomer.entries()]
    .map(([name, values]) => ({
      name,
      ...values,
      averageTicketCents: Math.round(values.revenueCents / values.invoices),
    }))
    .sort((left, right) => right.revenueCents - left.revenueCents)
    .slice(0, 6);
}

function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DemoState>;
  return (
    candidate.version === 9 &&
    Array.isArray(candidate.invoices) &&
    candidate.invoices.every(isInvoice) &&
    Array.isArray(candidate.products) &&
    candidate.products.every(isProduct) &&
    Array.isArray(candidate.people) &&
    candidate.people.every(isPerson) &&
    Array.isArray(candidate.syncRuns) &&
    candidate.syncRuns.every(isSyncRun) &&
    Array.isArray(candidate.ncmCredits) &&
    candidate.ncmCredits.every(isNcmCredit) &&
    Array.isArray(candidate.fixedCosts) &&
    candidate.fixedCosts.every(isFixedCost) &&
    isSafeInteger(candidate.goalCents) &&
    typeof candidate.updatedAt === "string" &&
    !!candidate.integrations &&
    typeof candidate.integrations.bling === "boolean" &&
    typeof candidate.integrations.mercadoLivre === "boolean" &&
    typeof candidate.integrations.apchat === "boolean" &&
    !!candidate.automation &&
    Array.isArray(candidate.automation.scheduleHours) &&
    candidate.automation.scheduleHours.every(
      (hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23,
    ) &&
    typeof candidate.automation.autoDelivery === "boolean" &&
    typeof candidate.automation.satisfactionEnabled === "boolean" &&
    Number.isInteger(candidate.automation.satisfactionHour) &&
    Number.isInteger(candidate.automation.satisfactionDelayDays)
  );
}

function isFixedCost(value: unknown): value is DemoFixedCost {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DemoFixedCost>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.value === "number" &&
    Number.isFinite(item.value) &&
    (item.valueType === "F" || item.valueType === "P") &&
    (item.application === "Item" || item.application === "Nota") &&
    Array.isArray(item.channels) &&
    item.channels.every((channel) => typeof channel === "string")
  );
}

function isNcmCredit(value: unknown): value is DemoNcmCredit {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DemoNcmCredit>;
  return (
    typeof item.id === "string" &&
    typeof item.ncm === "string" &&
    typeof item.rate === "number" &&
    Number.isFinite(item.rate) &&
    typeof item.reduction === "number" &&
    Number.isFinite(item.reduction)
  );
}

function isInvoice(value: unknown): value is DemoInvoice {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DemoInvoice>;
  return (
    typeof item.id === "string" &&
    typeof item.number === "string" &&
    typeof item.customer === "string" &&
    typeof item.channel === "string" &&
    typeof item.issuedAt === "string" &&
    isSafeInteger(item.valueCents) &&
    isSafeInteger(item.costCents) &&
    isSafeInteger(item.baseCostCents) &&
    isSafeInteger(item.taxCents) &&
    isInvoiceStatus(item.status) &&
    isDeliveryStatus(item.deliveryStatus) &&
    typeof item.hasBoleto === "boolean" &&
    typeof item.hasTracking === "boolean" &&
    (item.unlinkedItemCode === null ||
      typeof item.unlinkedItemCode === "string")
  );
}

function isProduct(value: unknown): value is DemoProduct {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DemoProduct>;
  return (
    typeof item.id === "string" &&
    typeof item.sku === "string" &&
    typeof item.name === "string" &&
    typeof item.ncm === "string" &&
    isSafeInteger(item.costCents) &&
    typeof item.ownManufacture === "boolean" &&
    typeof item.active === "boolean"
  );
}

function isSyncRun(value: unknown): value is DemoSyncRun {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DemoSyncRun>;
  return (
    typeof item.id === "string" &&
    [
      "nfe",
      "nfe-details",
      "nfe-delivery",
      "nfe-normalization",
      "payment-methods",
      "sales-channels",
      "sellers",
      "operation-natures",
      "products",
      "scheduled-cycle",
      "satisfaction",
    ].includes(String(item.kind)) &&
    (item.from === null || typeof item.from === "string") &&
    (item.to === null || typeof item.to === "string") &&
    isSafeInteger(item.processed) &&
    typeof item.createdAt === "string"
  );
}

function isPerson(value: unknown): value is DemoPerson {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DemoPerson>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.city === "string" &&
    typeof item.state === "string" &&
    isSafeInteger(item.orders) &&
    isSafeInteger(item.totalCents) &&
    typeof item.messagingDisabled === "boolean"
  );
}

function isInvoiceStatus(value: unknown): value is DemoInvoiceStatus {
  return ["Autorizada", "Pendente", "Em processamento", "Cancelada"].includes(
    String(value),
  );
}

function isDeliveryStatus(value: unknown): value is DemoDeliveryStatus {
  return ["Erro", "Pronto para envio", "Enviado", "Mercado livre"].includes(
    String(value),
  );
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function invoice(
  id: string,
  number: string,
  customer: string,
  channel: string,
  issuedAt: string,
  valueCents: number,
  costCents: number,
  taxCents: number,
  status: DemoInvoiceStatus,
  hasBoleto: boolean,
  hasTracking: boolean,
): DemoInvoice {
  return {
    id,
    number,
    customer,
    channel,
    issuedAt,
    valueCents,
    costCents,
    baseCostCents: costCents,
    taxCents,
    status,
    deliveryStatus: deliveryStatus(number, channel, status),
    hasBoleto,
    hasTracking,
    unlinkedItemCode: number === "000010173" ? "SKU-LEGADO-SEM-VINCULO" : null,
  };
}

function deliveryStatus(
  number: string,
  channel: string,
  status: DemoInvoiceStatus,
): DemoDeliveryStatus {
  if (channel === "Mercado Livre") return "Mercado livre";
  if (status === "Cancelada") return "Erro";
  const finalDigit = Number(number.slice(-1));
  if (finalDigit % 3 === 0) return "Pronto para envio";
  if (finalDigit % 4 === 0) return "Erro";
  return "Enviado";
}

function product(
  id: string,
  sku: string,
  name: string,
  ncm: string,
  costCents: number,
  ownManufacture: boolean,
): DemoProduct {
  return { id, sku, name, ncm, costCents, ownManufacture, active: true };
}

function person(
  id: string,
  name: string,
  city: string,
  state: string,
  orders: number,
  totalCents: number,
): DemoPerson {
  return {
    id,
    name,
    city,
    state,
    orders,
    totalCents,
    messagingDisabled: false,
  };
}
