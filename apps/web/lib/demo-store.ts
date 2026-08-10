export const DEMO_STORAGE_KEY = "apbling:public-demo:v1";

export type DemoInvoiceStatus =
  "Autorizada" | "Pendente" | "Em processamento" | "Cancelada";

export interface DemoInvoice {
  id: string;
  number: string;
  customer: string;
  channel: string;
  issuedAt: string;
  valueCents: number;
  costCents: number;
  taxCents: number;
  status: DemoInvoiceStatus;
  hasBoleto: boolean;
  hasTracking: boolean;
}

export interface DemoProduct {
  id: string;
  sku: string;
  name: string;
  stock: number;
  minimumStock: number;
  priceCents: number;
  active: boolean;
}

export interface DemoPerson {
  id: string;
  name: string;
  city: string;
  state: string;
  orders: number;
  totalCents: number;
  active: boolean;
}

export interface DemoState {
  version: 1;
  invoices: DemoInvoice[];
  products: DemoProduct[];
  people: DemoPerson[];
  goalCents: number;
  integrations: {
    bling: boolean;
    mercadoLivre: boolean;
    apchat: boolean;
  };
  updatedAt: string;
}

export interface DemoMetrics {
  revenueCents: number;
  costCents: number;
  taxCents: number;
  profitCents: number;
  marginBasisPoints: number;
  authorizedInvoices: number;
  lowStockProducts: number;
}

const DEFAULT_STATE: DemoState = {
  version: 1,
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
      184,
      40,
      5_990,
    ),
    product("prod-2", "HUB-USB-8P", "Hub USB-C 8 portas", 23, 25, 27_990),
    product(
      "prod-3",
      "SUP-NOTE-AL",
      "Suporte para notebook alumínio",
      71,
      20,
      18_490,
    ),
    product("prod-4", "MOUSE-VERT", "Mouse vertical sem fio", 12, 18, 14_990),
    product(
      "prod-5",
      "TECL-MEC-84",
      "Teclado mecânico compacto",
      46,
      15,
      32_990,
    ),
    product("prod-6", "FONE-BT-PRO", "Headset Bluetooth Pro", 38, 12, 39_990),
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
    lowStockProducts: state.products.filter(
      (item) => item.active && item.stock <= item.minimumStock,
    ).length,
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

function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DemoState>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.invoices) &&
    candidate.invoices.every(isInvoice) &&
    Array.isArray(candidate.products) &&
    candidate.products.every(isProduct) &&
    Array.isArray(candidate.people) &&
    candidate.people.every(isPerson) &&
    isSafeInteger(candidate.goalCents) &&
    typeof candidate.updatedAt === "string" &&
    !!candidate.integrations &&
    typeof candidate.integrations.bling === "boolean" &&
    typeof candidate.integrations.mercadoLivre === "boolean" &&
    typeof candidate.integrations.apchat === "boolean"
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
    isSafeInteger(item.taxCents) &&
    isInvoiceStatus(item.status) &&
    typeof item.hasBoleto === "boolean" &&
    typeof item.hasTracking === "boolean"
  );
}

function isProduct(value: unknown): value is DemoProduct {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DemoProduct>;
  return (
    typeof item.id === "string" &&
    typeof item.sku === "string" &&
    typeof item.name === "string" &&
    isSafeInteger(item.stock) &&
    isSafeInteger(item.minimumStock) &&
    isSafeInteger(item.priceCents) &&
    typeof item.active === "boolean"
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
    typeof item.active === "boolean"
  );
}

function isInvoiceStatus(value: unknown): value is DemoInvoiceStatus {
  return ["Autorizada", "Pendente", "Em processamento", "Cancelada"].includes(
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
    taxCents,
    status,
    hasBoleto,
    hasTracking,
  };
}

function product(
  id: string,
  sku: string,
  name: string,
  stock: number,
  minimumStock: number,
  priceCents: number,
): DemoProduct {
  return { id, sku, name, stock, minimumStock, priceCents, active: true };
}

function person(
  id: string,
  name: string,
  city: string,
  state: string,
  orders: number,
  totalCents: number,
): DemoPerson {
  return { id, name, city, state, orders, totalCents, active: true };
}
