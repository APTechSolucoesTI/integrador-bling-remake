"use client";

import {
  Activity,
  ArrowLeft,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  CircleDollarSign,
  CreditCard,
  Database,
  Download,
  FileText,
  Gauge,
  Goal,
  Link2,
  Menu,
  MessageSquareText,
  PackagePlus,
  Pencil,
  Percent,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Truck,
  UserRoundCheck,
  Users,
  Waypoints,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  calculateDemoMetrics,
  createDefaultDemoState,
  demoCustomerRanking,
  demoDailyRevenue,
  demoMonthlySeries,
  loadDemoState,
  saveDemoState,
  type DemoDeliveryStatus,
  type DemoState,
  type DemoSyncKind,
  type DemoSyncRun,
} from "../../lib/demo-store";
import styles from "./public-demo.module.css";
import { downloadCsv } from "../../lib/csv";

type DemoView =
  | "dashboard"
  | "invoices"
  | "documents"
  | "products"
  | "people"
  | "commercial"
  | "fiscal"
  | "finance"
  | "marketplaceFees"
  | "goals"
  | "operations"
  | "integrations";

const navigation = [
  { id: "dashboard", label: "Visão geral", icon: Gauge },
  { id: "invoices", label: "Notas fiscais", icon: FileText },
  { id: "documents", label: "Boletos e rastreio", icon: ReceiptText },
  { id: "products", label: "Produtos", icon: Boxes },
  { id: "people", label: "Pessoas", icon: Users },
  { id: "commercial", label: "Cadastros comerciais", icon: Store },
  { id: "fiscal", label: "Custos e tributação", icon: Percent },
  { id: "finance", label: "Lucro e margem", icon: CircleDollarSign },
  { id: "marketplaceFees", label: "Taxas Mercado Livre", icon: CreditCard },
  { id: "goals", label: "Metas", icon: Goal },
  { id: "operations", label: "Sincronizações", icon: Activity },
  { id: "integrations", label: "Integrações", icon: Waypoints },
] as const;

const titles: Record<
  DemoView,
  { eyebrow: string; title: string; subtitle: string }
> = {
  dashboard: {
    eyebrow: "OPERAÇÃO MOCKADA",
    title: "Visão geral",
    subtitle: "Uma leitura rápida do cenário fictício da APTech Demo.",
  },
  invoices: {
    eyebrow: "FISCAL",
    title: "Notas fiscais",
    subtitle: "Sincronize, ressincronize documentos e envie notas prontas.",
  },
  documents: {
    eyebrow: "DOCUMENTOS",
    title: "Boletos e rastreio",
    subtitle:
      "Documentos chegam pela sincronização das NF-e, sem cadastro manual.",
  },
  products: {
    eyebrow: "CATÁLOGO",
    title: "Produtos",
    subtitle: "Consulte o catálogo e simule sua sincronização com o Bling.",
  },
  people: {
    eyebrow: "RELACIONAMENTO",
    title: "Pessoas",
    subtitle: "Consulte clientes e gerencie a preferência de mensagens.",
  },
  commercial: {
    eyebrow: "REFERÊNCIAS DO BLING",
    title: "Cadastros comerciais",
    subtitle:
      "Formas, canais, vendedores e naturezas sincronizados pelo gateway fake.",
  },
  fiscal: {
    eyebrow: "REGRAS DA EMPRESA",
    title: "Custos e tributação",
    subtitle: "Custos editáveis usados no cálculo demonstrativo das NF-e.",
  },
  finance: {
    eyebrow: "RENTABILIDADE",
    title: "Custos, lucro e margem",
    subtitle: "Cálculo demonstrativo reconstruído a partir dos itens da NF-e.",
  },
  marketplaceFees: {
    eyebrow: "MARKETPLACE · TAXAS",
    title: "Taxas Mercado Livre",
    subtitle: "Comissão, frete e descontos por NF-e da operação demonstrativa.",
  },
  goals: {
    eyebrow: "PERFORMANCE",
    title: "Metas",
    subtitle: "Simule cenários mudando a meta comercial da demonstração.",
  },
  operations: {
    eyebrow: "OPERAÇÃO",
    title: "Sincronizações",
    subtitle: "Simule as rotinas que importam dados do Bling para o APBling.",
  },
  integrations: {
    eyebrow: "CONEXÕES FAKE",
    title: "Integrações",
    subtitle: "Ative ou pause conexões ilustrativas sem chamadas externas.",
  },
};

export function PublicDemoApp() {
  const [state, setState] = useState<DemoState>(createDefaultDemoState);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<DemoView>("dashboard");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    DemoDeliveryStatus | "Todos"
  >("Todos");
  const [feeFilters, setFeeFilters] = useState({
    invoiceNumber: "",
    origin: "",
    from: "",
    to: "",
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [syncPeriod, setSyncPeriod] = useState({
    from: "2026-08-01",
    to: "2026-08-10",
  });
  const [creditDraft, setCreditDraft] = useState({
    id: "",
    ncm: "",
    rate: "",
    reduction: "0",
  });
  const [fixedCostDraft, setFixedCostDraft] = useState({
    id: "",
    name: "",
    value: "",
    valueType: "P" as "F" | "P",
    application: "Item" as "Item" | "Nota",
  });

  useEffect(() => {
    setState(loadDemoState(window.localStorage));
    const requestedView = window.location.hash.slice(1);
    if (navigation.some(({ id }) => id === requestedView))
      setView(requestedView as DemoView);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveDemoState(window.localStorage, state);
  }, [ready, state]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const metrics = useMemo(() => calculateDemoMetrics(state), [state]);
  const series = useMemo(() => demoMonthlySeries(state), [state]);
  const dailyRevenue = useMemo(() => demoDailyRevenue(state), [state]);
  const customerRanking = useMemo(() => demoCustomerRanking(state), [state]);
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredInvoices = state.invoices.filter(
    (item) =>
      (statusFilter === "Todos" || item.deliveryStatus === statusFilter) &&
      (!normalizedSearch ||
        [item.number, item.customer, item.channel].some((value) =>
          value.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
        )),
  );
  const filteredProducts = state.products.filter(
    (item) =>
      !normalizedSearch ||
      [item.sku, item.name].some((value) =>
        value.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
      ),
  );
  const filteredPeople = state.people.filter(
    (item) =>
      !normalizedSearch ||
      [item.name, item.city, item.state].some((value) =>
        value.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
      ),
  );
  const marketplaceFeeRows = state.invoices
    .filter((invoice) => invoice.channel === "Mercado Livre")
    .map((invoice, index) => {
      const commissionRate = [13, 11.99, 8.92][index % 3] ?? 13;
      const freightCents = [2365, 1845, 1235][index % 3] ?? 0;
      return {
        ...invoice,
        commissionRate,
        commissionCents: Math.round(
          (invoice.valueCents * commissionRate) / 100,
        ),
        freightCents,
        freightRate:
          invoice.valueCents === 0
            ? 0
            : (freightCents / invoice.valueCents) * 100,
      };
    })
    .filter(
      (invoice) =>
        (!feeFilters.invoiceNumber ||
          invoice.number === feeFilters.invoiceNumber) &&
        (!feeFilters.origin || invoice.channel === feeFilters.origin) &&
        (!feeFilters.from || invoice.issuedAt >= feeFilters.from) &&
        (!feeFilters.to || invoice.issuedAt <= feeFilters.to),
    );

  function updateState(
    change: (current: DemoState) => DemoState,
    message: string,
  ) {
    setState((current) => ({
      ...change(current),
      updatedAt: new Date().toISOString(),
    }));
    setToast(message);
  }

  function changeView(nextView: DemoView) {
    setView(nextView);
    window.history.replaceState(null, "", `#${nextView}`);
    setSearch("");
    setMenuOpen(false);
  }

  function simulateNfeSync() {
    if (!syncPeriod.from || !syncPeriod.to) {
      setToast("Informe as datas inicial e final da sincronização.");
      return;
    }
    if (syncPeriod.from > syncPeriod.to) {
      setToast("A data inicial deve ser anterior à data final.");
      return;
    }
    if (!state.integrations.bling) {
      setToast("Ative a integração Bling da demo antes de sincronizar.");
      return;
    }
    const syncedId = `sync-${syncPeriod.from}-${syncPeriod.to}`;
    updateState((current) => {
      const alreadyImported = current.invoices.some(
        (invoice) => invoice.id === syncedId,
      );
      const sequence =
        Math.max(
          ...current.invoices.map((item) => Number(item.number)),
          10_176,
        ) + 1;
      const invoices = alreadyImported
        ? current.invoices
        : [
            {
              id: syncedId,
              number: String(sequence).padStart(9, "0"),
              customer: "Distribuidora Vale Verde",
              channel: "Bling",
              issuedAt: syncPeriod.to,
              valueCents: 247_850,
              costCents: 131_400,
              baseCostCents: 131_400,
              taxCents: 27_260,
              status: "Autorizada" as const,
              deliveryStatus: "Pronto para envio" as const,
              hasBoleto: true,
              hasTracking: false,
              unlinkedItemCode: null,
            },
            ...current.invoices,
          ];
      const processed = invoices.filter(
        (invoice) =>
          invoice.issuedAt >= syncPeriod.from &&
          invoice.issuedAt <= syncPeriod.to,
      ).length;
      return {
        ...current,
        invoices,
        syncRuns: [
          createSyncRun("nfe", processed, syncPeriod.from, syncPeriod.to),
          ...current.syncRuns,
        ].slice(0, 12),
      };
    }, "Sincronização simulada concluída sem duplicar NF-e importadas.");
  }

  function simulateProductSync() {
    if (!state.integrations.bling) {
      setToast("Ative a integração Bling da demo antes de sincronizar.");
      return;
    }
    const synchronizedCosts = [2_940, 14_650, 9_580, 7_920, 18_740, 21_650];
    updateState(
      (current) => ({
        ...current,
        products: current.products.map((item, index) => ({
          ...item,
          costCents: synchronizedCosts[index] ?? item.costCents,
        })),
        syncRuns: [
          createSyncRun("products", current.products.length),
          ...current.syncRuns,
        ].slice(0, 12),
      }),
      "Catálogo e custos sincronizados com o gateway fake.",
    );
  }

  function simulateReferenceSync(
    kind:
      "payment-methods" | "sales-channels" | "sellers" | "operation-natures",
  ) {
    if (!state.integrations.bling) {
      setToast("Ative a integração Bling da demo antes de sincronizar.");
      return;
    }
    const processed =
      kind === "payment-methods" ? 8 : kind === "sales-channels" ? 4 : 2;
    const labels = {
      "payment-methods": "Formas de pagamento",
      "sales-channels": "Canais de venda",
      sellers: "Vendedores",
      "operation-natures": "Naturezas de operação",
    } as const;
    updateState(
      (current) => ({
        ...current,
        syncRuns: [createSyncRun(kind, processed), ...current.syncRuns].slice(
          0,
          12,
        ),
      }),
      `${labels[kind]} sincronizados com o gateway fake.`,
    );
  }

  function simulateScheduledCycle() {
    if (!state.integrations.bling) {
      setToast("Ative a integração Bling da demo antes de executar o ciclo.");
      return;
    }
    const now = new Date().toISOString();
    updateState(
      (current) => {
        const shouldDeliver =
          current.automation.autoDelivery && current.integrations.apchat;
        const ready = current.invoices.filter(
          (invoice) => invoice.deliveryStatus === "Pronto para envio",
        ).length;
        const runs: DemoSyncRun[] = [
          {
            id: `scheduled-${now}`,
            kind: "scheduled-cycle",
            from: syncPeriod.from,
            to: syncPeriod.to,
            processed: current.invoices.length,
            createdAt: now,
          },
          ...(current.automation.satisfactionEnabled
            ? [
                {
                  id: `satisfaction-${now}`,
                  kind: "satisfaction" as const,
                  from: null,
                  to: null,
                  processed: shouldDeliver ? ready : 0,
                  createdAt: now,
                },
              ]
            : []),
        ];
        return {
          ...current,
          invoices: shouldDeliver
            ? current.invoices.map((invoice) =>
                invoice.deliveryStatus === "Pronto para envio"
                  ? { ...invoice, deliveryStatus: "Enviado" as const }
                  : invoice,
              )
            : current.invoices,
          syncRuns: [...runs, ...current.syncRuns].slice(0, 12),
        };
      },
      state.automation.autoDelivery && !state.integrations.apchat
        ? "Ciclo executado; envios aguardam a ativação fake do APChat."
        : "Ciclo automático executado no ambiente demonstrativo.",
    );
  }

  function saveNcmCredit() {
    const ncm = creditDraft.ncm.replace(/\D/g, "");
    const rate = Number(creditDraft.rate.replace(",", "."));
    const reduction = Number(creditDraft.reduction.replace(",", "."));
    if (
      ncm.length !== 8 ||
      !Number.isFinite(rate) ||
      !Number.isFinite(reduction)
    ) {
      setToast("Informe NCM, alíquota e redução válidos.");
      return;
    }
    updateState(
      (current) => ({
        ...current,
        ncmCredits: creditDraft.id
          ? current.ncmCredits.map((credit) =>
              credit.id === creditDraft.id
                ? { ...credit, ncm, rate, reduction }
                : credit,
            )
          : [
              ...current.ncmCredits,
              { id: `ncm-${ncm}-${Date.now()}`, ncm, rate, reduction },
            ],
      }),
      "Crédito de ICMS por NCM salvo na demonstração.",
    );
    setCreditDraft({ id: "", ncm: "", rate: "", reduction: "0" });
  }

  function saveFixedCost() {
    const value = Number(fixedCostDraft.value.replace(",", "."));
    if (!fixedCostDraft.name.trim() || !Number.isFinite(value) || value < 0) {
      setToast("Informe nome e valor válidos para o custo.");
      return;
    }
    updateState(
      (current) => ({
        ...current,
        fixedCosts: fixedCostDraft.id
          ? current.fixedCosts.map((cost) =>
              cost.id === fixedCostDraft.id
                ? {
                    ...cost,
                    name: fixedCostDraft.name.trim(),
                    value,
                    valueType: fixedCostDraft.valueType,
                    application: fixedCostDraft.application,
                  }
                : cost,
            )
          : [
              ...current.fixedCosts,
              {
                id: `cost-${Date.now()}`,
                name: fixedCostDraft.name.trim(),
                value,
                valueType: fixedCostDraft.valueType,
                application: fixedCostDraft.application,
                channels: [],
              },
            ],
      }),
      fixedCostDraft.id
        ? "Custo atualizado na demonstração."
        : "Custo adicionado à demonstração.",
    );
    setFixedCostDraft({
      id: "",
      name: "",
      value: "",
      valueType: "P",
      application: "Item",
    });
  }

  function deleteFixedCost(id: string, name: string) {
    if (!window.confirm(`Excluir custo ${name}?`)) return;
    updateState(
      (current) => ({
        ...current,
        fixedCosts: current.fixedCosts.filter((cost) => cost.id !== id),
      }),
      `Custo ${name} excluído da demonstração.`,
    );
    if (fixedCostDraft.id === id)
      setFixedCostDraft({
        id: "",
        name: "",
        value: "",
        valueType: "P",
        application: "Item",
      });
  }

  function deleteNcmCredit(id: string, ncm: string) {
    if (!window.confirm(`Excluir crédito do NCM ${ncm}?`)) return;
    updateState(
      (current) => ({
        ...current,
        ncmCredits: current.ncmCredits.filter((credit) => credit.id !== id),
      }),
      `Crédito do NCM ${ncm} excluído da demonstração.`,
    );
    if (creditDraft.id === id)
      setCreditDraft({ id: "", ncm: "", rate: "", reduction: "0" });
  }

  function exportDemoView() {
    if (view === "marketplaceFees") {
      downloadCsv(
        "demo-taxas-mercado-livre",
        [
          "Número NF",
          "Coligada",
          "Origem",
          "Cliente",
          "Data Emissão",
          "Valor",
          "Valor Comissão",
          "Percentual Comissão",
          "Valor Frete",
          "Percentual Frete",
          "Valor Desconto",
        ],
        marketplaceFeeRows.map((invoice) => [
          invoice.number,
          "APTech Demo",
          invoice.channel,
          invoice.customer,
          invoice.issuedAt,
          money(invoice.valueCents),
          money(invoice.commissionCents),
          `${invoice.commissionRate.toLocaleString("pt-BR")}%`,
          money(invoice.freightCents),
          `${invoice.freightRate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
          money(0),
        ]),
      );
      return;
    }
    if (view === "products") {
      downloadCsv(
        "demo-produtos",
        ["SKU", "Nome", "NCM", "Custo", "Fabricação própria", "Situação"],
        filteredProducts.map((product) => [
          product.sku,
          product.name,
          product.ncm,
          money(product.costCents),
          product.ownManufacture ? "Sim" : "Não",
          product.active ? "Ativo" : "Inativo",
        ]),
      );
      return;
    }
    if (view === "people") {
      downloadCsv(
        "demo-pessoas",
        ["Nome", "Cidade", "UF", "Pedidos", "Total", "Mensagens"],
        filteredPeople.map((person) => [
          person.name,
          person.city,
          person.state,
          person.orders,
          money(person.totalCents),
          person.messagingDisabled ? "Desabilitadas" : "Habilitadas",
        ]),
      );
      return;
    }
    downloadCsv(
      view === "finance"
        ? "demo-rentabilidade"
        : view === "documents"
          ? "demo-documentos"
          : "demo-nfe",
      [
        "NF-e",
        "Cliente",
        "Canal",
        "Emissão",
        "Venda",
        "Custo",
        "Impostos",
        "Lucro",
        "Status fiscal",
        "Status de envio",
      ],
      filteredInvoices.map((invoice) => [
        invoice.number,
        invoice.customer,
        invoice.channel,
        invoice.issuedAt,
        money(invoice.valueCents),
        money(invoice.costCents),
        money(invoice.taxCents),
        money(invoice.valueCents - invoice.costCents - invoice.taxCents),
        invoice.status,
        invoice.deliveryStatus,
      ]),
    );
  }

  function simulateInvoiceResync(id: string) {
    if (!state.integrations.bling) {
      setToast("Ative a integração Bling da demo antes de ressincronizar.");
      return;
    }
    updateState(
      (current) => ({
        ...current,
        invoices: current.invoices.map((invoice) => {
          if (invoice.id !== id) return invoice;
          const configuredCost = current.fixedCosts
            .filter(
              (cost) =>
                cost.channels.length === 0 ||
                cost.channels.includes(invoice.channel),
            )
            .reduce(
              (total, cost) =>
                total +
                (cost.valueType === "P"
                  ? Math.round((invoice.valueCents * cost.value) / 100)
                  : Math.round(cost.value * 100)),
              0,
            );
          return {
            ...invoice,
            costCents: invoice.baseCostCents + configuredCost,
            hasBoleto: true,
            hasTracking: true,
          };
        }),
        syncRuns: [createSyncRun("nfe-details", 1), ...current.syncRuns].slice(
          0,
          12,
        ),
      }),
      "Documentos e custos da NF-e foram ressincronizados e recalculados.",
    );
  }

  function simulateInvoiceSend(id: string) {
    if (!state.integrations.apchat) {
      setToast("Ative a integração APChat da demo antes de enviar.");
      return;
    }
    const invoice = state.invoices.find((item) => item.id === id);
    if (invoice?.deliveryStatus !== "Pronto para envio") {
      setToast("Apenas NF-e prontas podem ser enviadas.");
      return;
    }
    updateState(
      (current) => ({
        ...current,
        invoices: current.invoices.map((item) =>
          item.id === id ? { ...item, deliveryStatus: "Enviado" } : item,
        ),
        syncRuns: [createSyncRun("nfe-delivery", 1), ...current.syncRuns].slice(
          0,
          12,
        ),
      }),
      "NF-e enviada pelo gateway fake do APChat.",
    );
  }

  function simulateInvoiceNormalization(id: string) {
    const invoice = state.invoices.find((item) => item.id === id);
    if (!invoice?.unlinkedItemCode) {
      setToast("Esta NF-e não possui item pendente de normalização.");
      return;
    }
    const product = state.products.find((item) => item.sku === "HUB-USB-8P");
    if (!product) {
      setToast("Sincronize o catálogo antes de normalizar o item.");
      return;
    }
    updateState(
      (current) => ({
        ...current,
        invoices: current.invoices.map((item) =>
          item.id === id ? { ...item, unlinkedItemCode: null } : item,
        ),
        syncRuns: [
          createSyncRun("nfe-normalization", 1),
          ...current.syncRuns,
        ].slice(0, 12),
      }),
      `Item vinculado ao produto ${product.sku}; recálculo fake concluído.`,
    );
  }

  function resetDemo() {
    setState(createDefaultDemoState());
    setSearch("");
    setStatusFilter("Todos");
    setToast("Demonstração restaurada ao estado inicial.");
  }

  if (!ready) {
    return (
      <main className={styles.loading}>
        <span>
          <Sparkles size={25} />
        </span>
        <strong>Preparando a demonstração...</strong>
      </main>
    );
  }

  const heading = titles[view];
  const maxRevenue = Math.max(...series.map((item) => item.revenueCents), 1);
  const maxDailyRevenue = Math.max(
    ...dailyRevenue.points.map((item) => item.revenueCents),
    dailyRevenue.medianCents,
    1,
  );
  const maxCustomerRevenue = Math.max(customerRanking[0]?.revenueCents ?? 0, 1);

  return (
    <main className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
      >
        <Link className={styles.brand} href="/">
          <span>
            <Sparkles size={18} />
          </span>
          <div>
            <strong>APBling</strong>
            <small>PUBLIC DEMO</small>
          </div>
        </Link>
        <div className={styles.company}>
          <span>
            <Building2 size={17} />
          </span>
          <div>
            <small>Empresa fictícia</small>
            <strong>APTech Demo</strong>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav className={styles.navigation} aria-label="Módulos da demonstração">
          <p>EXPLORAR</p>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              className={view === id ? styles.active : ""}
              type="button"
              onClick={() => changeView(id)}
              key={id}
            >
              <Icon size={17} />
              <span>{label}</span>
              {id === "invoices" ? <b>{state.invoices.length}</b> : null}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarInfo}>
          <Database size={16} />
          <span>
            <strong>Somente neste navegador</strong>
            <small>As alterações usam localStorage.</small>
          </span>
        </div>
        <div className={styles.sidebarActions}>
          <button type="button" onClick={resetDemo}>
            <RotateCcw size={15} /> Restaurar demo
          </button>
          <Link href="/">
            <ArrowLeft size={15} /> Sair da demo
          </Link>
        </div>
      </aside>

      <section className={styles.workspace}>
        <div className={styles.demoBanner}>
          <Sparkles size={13} /> DEMONSTRAÇÃO PÚBLICA
          <span>
            Dados ilustrativos · nenhuma API externa · alterações locais
          </span>
        </div>
        <header className={styles.topbar}>
          <button
            className={styles.mobileMenu}
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <label className={styles.search}>
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                view === "invoices"
                  ? "Buscar nota, cliente ou canal..."
                  : view === "products"
                    ? "Buscar produto ou SKU..."
                    : view === "people"
                      ? "Buscar pessoa ou cidade..."
                      : "Busca disponível nas listas"
              }
              disabled={
                !(["invoices", "products", "people"] as DemoView[]).includes(
                  view,
                )
              }
              aria-label="Busca da demonstração"
            />
            <kbd>LOCAL</kbd>
          </label>
          <div className={styles.topActions}>
            <span>
              <i /> Auto-salvo
            </span>
            <div>AD</div>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.heading}>
            <div>
              <p>{heading.eyebrow}</p>
              <h1>{heading.title}</h1>
              <span>{heading.subtitle}</span>
            </div>
            {view === "invoices" ? (
              <button
                className={styles.primaryAction}
                type="button"
                onClick={() => changeView("operations")}
              >
                <RefreshCw size={16} /> Sincronizar NF-e
              </button>
            ) : null}
            {view === "dashboard" ? (
              <button
                className={styles.secondaryAction}
                type="button"
                onClick={() => changeView("operations")}
              >
                <RefreshCw size={15} /> Sincronizar dados
              </button>
            ) : null}
            {(
              [
                "invoices",
                "documents",
                "products",
                "people",
                "finance",
                "marketplaceFees",
              ] as DemoView[]
            ).includes(view) ? (
              <button
                className={styles.secondaryAction}
                type="button"
                onClick={exportDemoView}
              >
                <Download size={15} /> Exportar CSV
              </button>
            ) : null}
          </div>

          {view === "dashboard" ? (
            <>
              <section
                className={styles.metrics}
                aria-label="Indicadores demonstrativos"
              >
                <Metric
                  label="Faturamento"
                  value={money(metrics.revenueCents)}
                  detail={`${state.invoices.length} notas mockadas`}
                  tone="green"
                />
                <Metric
                  label="Lucro estimado"
                  value={money(metrics.profitCents)}
                  detail={`${basisPoints(metrics.marginBasisPoints)} de margem`}
                  tone="mint"
                />
                <Metric
                  label="NF-e autorizadas"
                  value={String(metrics.authorizedInvoices)}
                  detail="Status importado do Bling"
                  tone="blue"
                />
                <Metric
                  label="Produtos sincronizados"
                  value={String(metrics.synchronizedProducts)}
                  detail="Cadastro importado do Bling"
                  tone="amber"
                />
              </section>
              <section className={styles.dashboardGrid}>
                <article className={`${styles.panel} ${styles.chartPanel}`}>
                  <PanelHead
                    title="Faturamento demonstrativo"
                    subtitle="Ajusta quando você cria ou cancela NF-e"
                  />
                  <div className={styles.chartLegend}>
                    <span>
                      <i /> Faturamento
                    </span>
                  </div>
                  <div className={styles.chart}>
                    {series.map((item) => (
                      <div
                        className={styles.bar}
                        key={item.month}
                        title={`${item.label}: ${money(item.revenueCents)}`}
                      >
                        <i
                          style={{
                            height: `${Math.max(8, (item.revenueCents / maxRevenue) * 100)}%`,
                          }}
                        />
                        <small>{item.label}</small>
                      </div>
                    ))}
                  </div>
                </article>
                <article className={`${styles.panel} ${styles.healthPanel}`}>
                  <PanelHead
                    title="Ambiente seguro"
                    subtitle="Sem autenticação ou backend"
                  />
                  <div className={styles.score}>
                    <div>
                      <strong>100</strong>
                      <small>% local</small>
                    </div>
                    <span>
                      <strong>Pronto para experimentar</strong>
                      <small>Tudo pode ser restaurado</small>
                    </span>
                  </div>
                  <div className={styles.healthItems}>
                    <div>
                      <ShieldCheck size={16} />
                      <span>
                        <strong>Sem tokens reais</strong>
                        <small>Nada sensível no navegador</small>
                      </span>
                      <Check size={14} />
                    </div>
                    <div>
                      <Database size={16} />
                      <span>
                        <strong>Persistência local</strong>
                        <small>Sobrevive ao recarregamento</small>
                      </span>
                      <Check size={14} />
                    </div>
                    <div>
                      <Waypoints size={16} />
                      <span>
                        <strong>Gateways desligados</strong>
                        <small>Nenhuma chamada externa</small>
                      </span>
                      <Check size={14} />
                    </div>
                  </div>
                </article>
              </section>
              <section className={styles.insightGrid}>
                <article className={`${styles.panel} ${styles.dailyPanel}`}>
                  <PanelHead
                    title="Faturamento diário"
                    subtitle={`Mediana dos dias faturados: ${money(dailyRevenue.medianCents)}`}
                  />
                  <div
                    className={styles.dailyChart}
                    aria-label="Faturamento diário da demonstração"
                  >
                    {dailyRevenue.points.map((item) => (
                      <div
                        className={styles.dailyBar}
                        key={item.date}
                        title={`${demoDate(item.date)}: ${money(item.revenueCents)} em ${item.invoices} notas`}
                      >
                        <i
                          style={{
                            height: `${Math.max(5, (item.revenueCents / maxDailyRevenue) * 100)}%`,
                          }}
                        />
                        <small>{shortDemoDate(item.date)}</small>
                      </div>
                    ))}
                  </div>
                </article>
                <article className={`${styles.panel} ${styles.customerPanel}`}>
                  <PanelHead
                    title="Clientes por faturamento"
                    subtitle="Atualizado pelas NF-e não canceladas"
                  />
                  <div className={styles.customerRanking}>
                    {customerRanking.map((customer) => (
                      <div key={customer.name}>
                        <span>
                          <strong>{customer.name}</strong>
                          <small>
                            {customer.invoices} notas · lucro{" "}
                            {money(customer.profitCents)} · ticket{" "}
                            {money(customer.averageTicketCents)}
                          </small>
                        </span>
                        <b>{money(customer.revenueCents)}</b>
                        <i>
                          <em
                            style={{
                              width: `${Math.max((customer.revenueCents / maxCustomerRevenue) * 100, 3)}%`,
                            }}
                          />
                        </i>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
              <article className={`${styles.panel} ${styles.tablePanel}`}>
                <PanelHead
                  title="Notas fiscais recentes"
                  subtitle="Consulte as notas e ressincronize seus documentos"
                  action={
                    <button
                      type="button"
                      onClick={() => changeView("invoices")}
                    >
                      Ver todas
                    </button>
                  }
                />
                <InvoiceTable invoices={state.invoices.slice(0, 5)} compact />
              </article>
            </>
          ) : null}

          {view === "invoices" ? (
            <article className={`${styles.panel} ${styles.listPanel}`}>
              <div className={styles.filters}>
                <div>
                  {(
                    [
                      "Todos",
                      "Erro",
                      "Pronto para envio",
                      "Enviado",
                      "Mercado livre",
                    ] as const
                  ).map((status) => (
                    <button
                      className={
                        statusFilter === status ? styles.filterActive : ""
                      }
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      key={status}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <span>
                  {filteredInvoices.length} de {state.invoices.length} notas
                </span>
              </div>
              <InvoiceTable
                invoices={filteredInvoices}
                onResync={simulateInvoiceResync}
                onSend={simulateInvoiceSend}
                onNormalize={simulateInvoiceNormalization}
              />
              {filteredInvoices.length === 0 ? (
                <EmptyState
                  title="Nenhuma NF-e encontrada"
                  text="Mude os filtros ou execute uma sincronização por período."
                />
              ) : null}
            </article>
          ) : null}

          {view === "documents" ? (
            <article className={`${styles.panel} ${styles.listPanel}`}>
              <div className={styles.listSummary}>
                <span>
                  <ReceiptText size={17} /> Documentos vinculados às NF-e
                </span>
                <small>
                  Ressincronize para buscar boleto e rastreio no Bling.
                </small>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>NF-e</th>
                      <th>Cliente</th>
                      <th>Boleto</th>
                      <th>Rastreio</th>
                      <th>Status de envio</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          <strong>{invoice.number}</strong>
                        </td>
                        <td>{invoice.customer}</td>
                        <td>
                          {invoice.hasBoleto ? "Disponível" : "Não localizado"}
                        </td>
                        <td>
                          {invoice.hasTracking
                            ? "Disponível"
                            : "Não localizado"}
                        </td>
                        <td>{invoice.deliveryStatus}</td>
                        <td>
                          <button
                            className={styles.rowAction}
                            type="button"
                            onClick={() => simulateInvoiceResync(invoice.id)}
                          >
                            <RefreshCw size={13} /> Atualizar documentos
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ) : null}

          {view === "products" ? (
            <article className={`${styles.panel} ${styles.listPanel}`}>
              <div className={styles.listSummary}>
                <span>
                  <PackagePlus size={17} /> {state.products.length} produtos
                  sincronizados
                </span>
                <button type="button" onClick={simulateProductSync}>
                  <RefreshCw size={14} /> Sincronizar produtos
                </button>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>SKU</th>
                      <th>NCM</th>
                      <th>Custo</th>
                      <th>Fabricação própria</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className={styles.productName}>
                            <span>
                              <Boxes size={15} />
                            </span>
                            <strong>{product.name}</strong>
                          </div>
                        </td>
                        <td>
                          <code>{product.sku}</code>
                        </td>
                        <td>
                          <code>{product.ncm}</code>
                        </td>
                        <td>
                          <strong>{money(product.costCents)}</strong>
                        </td>
                        <td>{product.ownManufacture ? "Sim" : "Não"}</td>
                        <td>
                          <span
                            className={
                              product.active ? styles.stockOk : styles.stockLow
                            }
                          >
                            {product.active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ) : null}

          {view === "people" ? (
            <article className={`${styles.panel} ${styles.listPanel}`}>
              <div className={styles.listSummary}>
                <span>
                  <UserRoundCheck size={17} /> Base de clientes demonstrativa
                </span>
                <small>
                  Preferência de mensagens editável como no produto.
                </small>
              </div>
              <div className={styles.peopleGrid}>
                {filteredPeople.map((person) => (
                  <article className={styles.personCard} key={person.id}>
                    <div className={styles.personAvatar}>
                      {initials(person.name)}
                    </div>
                    <div>
                      <strong>{person.name}</strong>
                      <span>
                        {person.city} · {person.state}
                      </span>
                    </div>
                    <dl>
                      <div>
                        <dt>Pedidos</dt>
                        <dd>{person.orders}</dd>
                      </div>
                      <div>
                        <dt>Total</dt>
                        <dd>{money(person.totalCents)}</dd>
                      </div>
                    </dl>
                    <button
                      className={
                        person.messagingDisabled
                          ? styles.disabled
                          : styles.enabled
                      }
                      type="button"
                      onClick={() =>
                        updateState(
                          (current) => ({
                            ...current,
                            people: current.people.map((item) =>
                              item.id === person.id
                                ? {
                                    ...item,
                                    messagingDisabled: !item.messagingDisabled,
                                  }
                                : item,
                            ),
                          }),
                          person.messagingDisabled
                            ? "Mensagens habilitadas para o contato."
                            : "Mensagens desabilitadas para o contato.",
                        )
                      }
                    >
                      {person.messagingDisabled
                        ? "Mensagens pausadas"
                        : "Mensagens ativas"}
                    </button>
                  </article>
                ))}
              </div>
            </article>
          ) : null}

          {view === "commercial" ? (
            <section className={styles.referenceDemoGrid}>
              <ReferenceDemoPanel
                title="Formas de pagamento"
                items={[
                  "Boleto bancário",
                  "Cartão de crédito",
                  "PIX",
                  "Transferência",
                ]}
                onSync={() => simulateReferenceSync("payment-methods")}
              />
              <ReferenceDemoPanel
                title="Canais de venda"
                items={[
                  "Bling",
                  "Mercado Livre",
                  "Loja virtual",
                  "Venda direta",
                ]}
                onSync={() => simulateReferenceSync("sales-channels")}
              />
              <ReferenceDemoPanel
                title="Vendedores"
                items={[
                  "Amanda Costa · Comercial",
                  "Rafael Lima · Marketplace",
                ]}
                onSync={() => simulateReferenceSync("sellers")}
              />
              <ReferenceDemoPanel
                title="Naturezas de operação"
                items={["Venda de mercadoria", "Venda interestadual"]}
                onSync={() => simulateReferenceSync("operation-natures")}
              />
            </section>
          ) : null}

          {view === "fiscal" ? (
            <section className={styles.fiscalDemoGrid}>
              <article className={`${styles.panel} ${styles.fixedCostPanel}`}>
                <PanelHead
                  title="Custos fixos e variáveis"
                  subtitle="Persistidos localmente e aplicados por item ou nota"
                />
                <div className={styles.fixedCostForm}>
                  <label>
                    Nome
                    <input
                      value={fixedCostDraft.name}
                      onChange={(event) =>
                        setFixedCostDraft({
                          ...fixedCostDraft,
                          name: event.target.value,
                        })
                      }
                      placeholder="Ex.: Comissão operacional"
                    />
                  </label>
                  <label>
                    Valor
                    <input
                      inputMode="decimal"
                      value={fixedCostDraft.value}
                      onChange={(event) =>
                        setFixedCostDraft({
                          ...fixedCostDraft,
                          value: event.target.value,
                        })
                      }
                      placeholder="0,00"
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={fixedCostDraft.valueType}
                      onChange={(event) =>
                        setFixedCostDraft({
                          ...fixedCostDraft,
                          valueType: event.target.value as "F" | "P",
                        })
                      }
                    >
                      <option value="P">Percentual</option>
                      <option value="F">Valor fixo</option>
                    </select>
                  </label>
                  <label>
                    Aplicação
                    <select
                      value={fixedCostDraft.application}
                      onChange={(event) =>
                        setFixedCostDraft({
                          ...fixedCostDraft,
                          application: event.target.value as "Item" | "Nota",
                        })
                      }
                    >
                      <option value="Item">Por item</option>
                      <option value="Nota">Por nota</option>
                    </select>
                  </label>
                  <button type="button" onClick={saveFixedCost}>
                    <Check size={14} />
                    {fixedCostDraft.id ? "Atualizar custo" : "Adicionar custo"}
                  </button>
                </div>
                <div className={styles.fixedCostList}>
                  {state.fixedCosts.map((cost) => (
                    <article key={cost.id}>
                      <span>
                        <strong>{cost.name}</strong>
                        <small>
                          {cost.valueType === "P"
                            ? `${cost.value}%`
                            : money(Math.round(cost.value * 100))}
                          {` · por ${cost.application.toLowerCase()}`}
                          {cost.channels.length
                            ? ` · ${cost.channels.join(", ")}`
                            : " · todos os canais"}
                        </small>
                      </span>
                      <button
                        type="button"
                        aria-label={`Editar ${cost.name}`}
                        onClick={() =>
                          setFixedCostDraft({
                            id: cost.id,
                            name: cost.name,
                            value: String(cost.value),
                            valueType: cost.valueType,
                            application: cost.application,
                          })
                        }
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className={styles.costDelete}
                        type="button"
                        aria-label={`Excluir ${cost.name}`}
                        onClick={() => deleteFixedCost(cost.id, cost.name)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </article>
                  ))}
                </div>
              </article>
              <article
                className={`${styles.panel} ${styles.taxReferencePanel}`}
              >
                <PanelHead
                  title="Referências tributárias"
                  subtitle="Consulta global; créditos NCM permanecem por empresa"
                />
                <div className={styles.taxReferenceList}>
                  {[
                    "ICMS · 18%",
                    "PIS · 1,65%",
                    "COFINS · 7,60%",
                    "DIFAL SP · 18%",
                  ].map((rule) => (
                    <span key={rule}>{rule}</span>
                  ))}
                </div>
                <button
                  className={styles.manageNcmButton}
                  type="button"
                  onClick={() => changeView("finance")}
                >
                  <Percent size={14} /> Gerenciar créditos por NCM
                </button>
              </article>
            </section>
          ) : null}

          {view === "finance" ? (
            <section className={styles.financeGrid}>
              <article className={`${styles.panel} ${styles.financeSummary}`}>
                <PanelHead
                  title="Rentabilidade das NF-e"
                  subtitle="Valores recalculados quando documentos são ressincronizados"
                />
                <div className={styles.financeMetrics}>
                  <div>
                    <small>Venda líquida</small>
                    <strong>{money(metrics.revenueCents)}</strong>
                  </div>
                  <div>
                    <small>Custo</small>
                    <strong>{money(metrics.costCents)}</strong>
                  </div>
                  <div>
                    <small>Impostos</small>
                    <strong>{money(metrics.taxCents)}</strong>
                  </div>
                  <div>
                    <small>Lucro</small>
                    <strong>{money(metrics.profitCents)}</strong>
                  </div>
                </div>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>NF-e</th>
                        <th>Cliente</th>
                        <th>Venda</th>
                        <th>Custo</th>
                        <th>Impostos</th>
                        <th>Lucro</th>
                        <th>Margem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.invoices
                        .filter((invoice) => invoice.status !== "Cancelada")
                        .map((invoice) => {
                          const profit =
                            invoice.valueCents -
                            invoice.costCents -
                            invoice.taxCents;
                          return (
                            <tr key={invoice.id}>
                              <td>
                                <strong>{invoice.number}</strong>
                              </td>
                              <td>{invoice.customer}</td>
                              <td>{money(invoice.valueCents)}</td>
                              <td>{money(invoice.costCents)}</td>
                              <td>{money(invoice.taxCents)}</td>
                              <td>{money(profit)}</td>
                              <td>
                                {basisPoints(
                                  Math.round(
                                    (profit * 10_000) / invoice.valueCents,
                                  ),
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </article>
              <article className={`${styles.panel} ${styles.creditPanel}`}>
                <PanelHead
                  title="Crédito de ICMS por NCM"
                  subtitle="Regra da empresa usada no Lucro Presumido"
                />
                <div className={styles.creditForm}>
                  <label>
                    NCM
                    <input
                      inputMode="numeric"
                      maxLength={8}
                      value={creditDraft.ncm}
                      onChange={(event) =>
                        setCreditDraft({
                          ...creditDraft,
                          ncm: event.target.value.replace(/\D/g, ""),
                        })
                      }
                      placeholder="84716052"
                    />
                  </label>
                  <label>
                    Alíquota (%)
                    <input
                      inputMode="decimal"
                      value={creditDraft.rate}
                      onChange={(event) =>
                        setCreditDraft({
                          ...creditDraft,
                          rate: event.target.value,
                        })
                      }
                      placeholder="12,00"
                    />
                  </label>
                  <label>
                    Redução (%)
                    <input
                      inputMode="decimal"
                      value={creditDraft.reduction}
                      onChange={(event) =>
                        setCreditDraft({
                          ...creditDraft,
                          reduction: event.target.value,
                        })
                      }
                      placeholder="0,00"
                    />
                  </label>
                  <button type="button" onClick={saveNcmCredit}>
                    <Check size={14} />{" "}
                    {creditDraft.id ? "Atualizar regra" : "Adicionar regra"}
                  </button>
                </div>
                <div className={styles.creditList}>
                  {state.ncmCredits.map((credit) => (
                    <div className={styles.creditRow} key={credit.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setCreditDraft({
                            id: credit.id,
                            ncm: credit.ncm,
                            rate: String(credit.rate),
                            reduction: String(credit.reduction),
                          })
                        }
                      >
                        <Percent size={14} />
                        <span>
                          <strong>{credit.ncm}</strong>
                          <small>
                            {credit.rate}% · redução {credit.reduction}%
                          </small>
                        </span>
                        <Pencil size={13} />
                      </button>
                      <button
                        className={styles.creditDelete}
                        type="button"
                        aria-label={`Excluir crédito do NCM ${credit.ncm}`}
                        onClick={() => deleteNcmCredit(credit.id, credit.ncm)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          ) : null}

          {view === "marketplaceFees" ? (
            <section className={`${styles.panel} ${styles.marketplaceFees}`}>
              <div className={styles.demoFeeFilters}>
                <label>
                  Número NF
                  <select
                    value={feeFilters.invoiceNumber}
                    onChange={(event) =>
                      setFeeFilters({
                        ...feeFilters,
                        invoiceNumber: event.target.value,
                      })
                    }
                  >
                    <option value="">Todas as notas</option>
                    {state.invoices
                      .filter((invoice) => invoice.channel === "Mercado Livre")
                      .map((invoice) => (
                        <option key={invoice.id} value={invoice.number}>
                          {invoice.number}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Coligada
                  <select value="APTech Demo" disabled>
                    <option>APTech Demo</option>
                  </select>
                </label>
                <label>
                  Origem
                  <select
                    value={feeFilters.origin}
                    onChange={(event) =>
                      setFeeFilters({ ...feeFilters, origin: event.target.value })
                    }
                  >
                    <option value="">Todas as origens</option>
                    <option value="Mercado Livre">Mercado Livre</option>
                  </select>
                </label>
                <label>
                  Data inicial
                  <input
                    type="date"
                    value={feeFilters.from}
                    onChange={(event) =>
                      setFeeFilters({ ...feeFilters, from: event.target.value })
                    }
                  />
                </label>
                <label>
                  Data final
                  <input
                    type="date"
                    value={feeFilters.to}
                    onChange={(event) =>
                      setFeeFilters({ ...feeFilters, to: event.target.value })
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFeeFilters({
                      invoiceNumber: "",
                      origin: "",
                      from: "",
                      to: "",
                    })
                  }
                >
                  <RotateCcw size={14} /> Limpar
                </button>
              </div>
              <PanelHead
                title="Relatório Taxas ML"
                subtitle={`${marketplaceFeeRows.length} registros encontrados`}
              />
              <div
                className={`${styles.tableWrap} ${styles.marketplaceFeesTable}`}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Número NF</th>
                      <th>Coligada</th>
                      <th>Origem</th>
                      <th>Cliente</th>
                      <th>Data Emissão</th>
                      <th>Valor</th>
                      <th>Valor Comissão</th>
                      <th>Percentual Comissão</th>
                      <th>Valor Frete</th>
                      <th>Percentual Frete</th>
                      <th>Valor Desconto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketplaceFeeRows.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          <strong>{invoice.number}</strong>
                        </td>
                        <td>APTech Demo</td>
                        <td>
                          <span className={styles.info}>{invoice.channel}</span>
                        </td>
                        <td>{invoice.customer}</td>
                        <td>{invoice.issuedAt}</td>
                        <td>{money(invoice.valueCents)}</td>
                        <td>{money(invoice.commissionCents)}</td>
                        <td>
                          {invoice.commissionRate.toLocaleString("pt-BR")}%
                        </td>
                        <td>{money(invoice.freightCents)}</td>
                        <td>
                          {invoice.freightRate.toLocaleString("pt-BR", {
                            maximumFractionDigits: 2,
                          })}
                          %
                        </td>
                        <td>{money(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {view === "goals" ? (
            <section className={styles.goalGrid}>
              <article className={`${styles.panel} ${styles.goalCard}`}>
                <span>
                  <Goal size={20} />
                </span>
                <p>META DE AGOSTO</p>
                <strong>{money(state.goalCents)}</strong>
                <small>Arraste para simular outro objetivo.</small>
                <input
                  type="range"
                  min={2_500_000}
                  max={8_000_000}
                  step={50_000}
                  value={state.goalCents}
                  onChange={(event) =>
                    updateState(
                      (current) => ({
                        ...current,
                        goalCents: Number(event.target.value),
                      }),
                      "Meta atualizada localmente.",
                    )
                  }
                  aria-label="Meta comercial demonstrativa"
                />
              </article>
              <article className={`${styles.panel} ${styles.progressCard}`}>
                <PanelHead
                  title="Progresso da meta"
                  subtitle="Baseado no faturamento mockado"
                />
                <div
                  className={styles.progressRing}
                  style={
                    {
                      "--progress": `${Math.min(100, (metrics.revenueCents / state.goalCents) * 100)}%`,
                    } as React.CSSProperties
                  }
                >
                  <div>
                    <strong>
                      {Math.round(
                        (metrics.revenueCents / state.goalCents) * 100,
                      )}
                      %
                    </strong>
                    <small>atingido</small>
                  </div>
                </div>
                <p>
                  <span>
                    Realizado <b>{money(metrics.revenueCents)}</b>
                  </span>
                  <span>
                    Restante{" "}
                    <b>
                      {money(
                        Math.max(0, state.goalCents - metrics.revenueCents),
                      )}
                    </b>
                  </span>
                </p>
              </article>
            </section>
          ) : null}

          {view === "operations" ? (
            <section className={styles.operationsGrid}>
              <article className={`${styles.panel} ${styles.syncCard}`}>
                <PanelHead
                  title="Sincronizar NF-e"
                  subtitle="Importa situações 5 e 6 no período selecionado"
                />
                <div className={styles.syncForm}>
                  <label>
                    Data inicial
                    <input
                      type="date"
                      value={syncPeriod.from}
                      onChange={(event) =>
                        setSyncPeriod((current) => ({
                          ...current,
                          from: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Data final
                    <input
                      type="date"
                      value={syncPeriod.to}
                      onChange={(event) =>
                        setSyncPeriod((current) => ({
                          ...current,
                          to: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button type="button" onClick={simulateNfeSync}>
                    <RefreshCw size={15} /> Executar sincronização
                  </button>
                  <p>
                    O gateway fake importa uma NF-e determinística e não cria
                    duplicatas quando o mesmo período é executado novamente.
                  </p>
                </div>
              </article>

              <article className={`${styles.panel} ${styles.syncCard}`}>
                <PanelHead
                  title="Sincronizar produtos"
                  subtitle="Atualiza catálogo, custo e fabricação própria do Bling"
                />
                <div className={styles.productSyncBody}>
                  <span>
                    <Boxes size={23} />
                  </span>
                  <strong>{state.products.length} produtos disponíveis</strong>
                  <p>
                    Na demonstração, o gateway fake aplica o mesmo resultado em
                    repetições sucessivas.
                  </p>
                  <button type="button" onClick={simulateProductSync}>
                    <RefreshCw size={15} /> Sincronizar produtos
                  </button>
                </div>
              </article>

              <article className={`${styles.panel} ${styles.referenceSync}`}>
                <PanelHead
                  title="Cadastros exigidos pela sincronização"
                  subtitle="Atualiza referências comerciais usadas pelas NF-e"
                />
                <div className={styles.referenceActions}>
                  <button
                    type="button"
                    onClick={() => simulateReferenceSync("payment-methods")}
                  >
                    <CreditCard size={16} />
                    <span>
                      <strong>Formas de pagamento</strong>
                      <small>8 registros no gateway fake</small>
                    </span>
                    <RefreshCw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => simulateReferenceSync("sales-channels")}
                  >
                    <Store size={16} />
                    <span>
                      <strong>Canais de venda</strong>
                      <small>4 registros no gateway fake</small>
                    </span>
                    <RefreshCw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => simulateReferenceSync("sellers")}
                  >
                    <Users size={16} />
                    <span>
                      <strong>Vendedores</strong>
                      <small>2 registros no gateway fake</small>
                    </span>
                    <RefreshCw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => simulateReferenceSync("operation-natures")}
                  >
                    <FileText size={16} />
                    <span>
                      <strong>Naturezas de operação</strong>
                      <small>2 registros no gateway fake</small>
                    </span>
                    <RefreshCw size={14} />
                  </button>
                </div>
              </article>

              <article className={`${styles.panel} ${styles.automationCard}`}>
                <PanelHead
                  title="Automação operacional"
                  subtitle="Mesma agenda que dispara sincronizações e mensagens no worker"
                />
                <div className={styles.automationBody}>
                  <div className={styles.automationTitle}>
                    <Clock3 size={17} />
                    <span>
                      <strong>Horários ativos</strong>
                      <small>Fuso de São Paulo</small>
                    </span>
                  </div>
                  <div className={styles.hourGrid}>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <button
                        key={hour}
                        type="button"
                        className={
                          state.automation.scheduleHours.includes(hour)
                            ? styles.hourActive
                            : ""
                        }
                        onClick={() =>
                          updateState(
                            (current) => ({
                              ...current,
                              automation: {
                                ...current.automation,
                                scheduleHours:
                                  current.automation.scheduleHours.includes(
                                    hour,
                                  )
                                    ? current.automation.scheduleHours.filter(
                                        (value) => value !== hour,
                                      )
                                    : [
                                        ...current.automation.scheduleHours,
                                        hour,
                                      ].sort((left, right) => left - right),
                              },
                            }),
                            `Agenda das ${String(hour).padStart(2, "0")}:00 atualizada.`,
                          )
                        }
                      >
                        {String(hour).padStart(2, "0")}
                      </button>
                    ))}
                  </div>
                  <label className={styles.automationToggle}>
                    <input
                      type="checkbox"
                      checked={state.automation.autoDelivery}
                      onChange={(event) =>
                        updateState(
                          (current) => ({
                            ...current,
                            automation: {
                              ...current.automation,
                              autoDelivery: event.target.checked,
                            },
                          }),
                          "Envio automático atualizado.",
                        )
                      }
                    />
                    Enviar NF-e pronta automaticamente pelo APChat
                  </label>
                  <label className={styles.automationToggle}>
                    <input
                      type="checkbox"
                      checked={state.automation.satisfactionEnabled}
                      onChange={(event) =>
                        updateState(
                          (current) => ({
                            ...current,
                            automation: {
                              ...current.automation,
                              satisfactionEnabled: event.target.checked,
                            },
                          }),
                          "Pesquisa de satisfação atualizada.",
                        )
                      }
                    />
                    <MessageSquareText size={14} /> Pesquisa de satisfação após{" "}
                    {state.automation.satisfactionDelayDays} dias
                  </label>
                  <button
                    className={styles.runAutomation}
                    type="button"
                    onClick={simulateScheduledCycle}
                    disabled={state.automation.scheduleHours.length === 0}
                  >
                    <RefreshCw size={15} /> Simular próximo ciclo
                  </button>
                </div>
              </article>

              <article className={`${styles.panel} ${styles.syncHistory}`}>
                <PanelHead
                  title="Histórico de sincronizações"
                  subtitle="Execuções locais da demonstração"
                />
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Rotina</th>
                        <th>Período</th>
                        <th>Processados</th>
                        <th>Executada em</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.syncRuns.map((run) => (
                        <tr key={run.id}>
                          <td>
                            <strong>{syncKindLabel(run.kind)}</strong>
                          </td>
                          <td>
                            {run.from && run.to
                              ? `${shortDemoDate(run.from)} a ${shortDemoDate(run.to)}`
                              : "Catálogo completo"}
                          </td>
                          <td>{run.processed}</td>
                          <td>{dateTime(run.createdAt)}</td>
                          <td>
                            <span className={styles.success}>Concluída</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          ) : null}

          {view === "integrations" ? (
            <section className={styles.integrationGrid}>
              <IntegrationCard
                name="Bling API v3"
                description="Sincronização ilustrativa de NF-e, pessoas e produtos."
                icon={<Store size={21} />}
                enabled={state.integrations.bling}
                onToggle={() =>
                  updateState(
                    (current) => ({
                      ...current,
                      integrations: {
                        ...current.integrations,
                        bling: !current.integrations.bling,
                      },
                    }),
                    "Integração fake atualizada.",
                  )
                }
              />
              <IntegrationCard
                name="Mercado Livre"
                description="Canal mockado para taxas e origem das vendas."
                icon={<Link2 size={21} />}
                enabled={state.integrations.mercadoLivre}
                onToggle={() =>
                  updateState(
                    (current) => ({
                      ...current,
                      integrations: {
                        ...current.integrations,
                        mercadoLivre: !current.integrations.mercadoLivre,
                      },
                    }),
                    "Integração fake atualizada.",
                  )
                }
              />
              <IntegrationCard
                name="APChat"
                description="Mensagens sempre locais; nenhum destinatário real."
                icon={<Activity size={21} />}
                enabled={state.integrations.apchat}
                onToggle={() =>
                  updateState(
                    (current) => ({
                      ...current,
                      integrations: {
                        ...current.integrations,
                        apchat: !current.integrations.apchat,
                      },
                    }),
                    "Integração fake atualizada.",
                  )
                }
              />
            </section>
          ) : null}
        </div>
      </section>

      {toast ? (
        <div className={styles.toast} role="status">
          <Check size={16} />
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Fechar aviso"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
    </main>
  );
}

function demoDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00.000Z`),
  );
}

function shortDemoDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "mint" | "blue" | "amber";
}) {
  return (
    <article className={styles.metric}>
      <div>
        <span>{label}</span>
        <i data-tone={tone} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function PanelHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.panelHead}>
      <div>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
      {action}
    </div>
  );
}

function ReferenceDemoPanel({
  title,
  items,
  onSync,
}: {
  title: string;
  items: string[];
  onSync: () => void;
}) {
  return (
    <article className={`${styles.panel} ${styles.referenceDemoPanel}`}>
      <PanelHead
        title={title}
        subtitle={`${items.length} registros sincronizados`}
        action={
          <button type="button" onClick={onSync}>
            <RefreshCw size={13} /> Sincronizar
          </button>
        }
      />
      <div>
        {items.map((item) => (
          <span key={item}>
            <Check size={13} /> {item}
          </span>
        ))}
      </div>
    </article>
  );
}

function InvoiceTable({
  invoices,
  onResync,
  onSend,
  onNormalize,
  compact = false,
}: {
  invoices: DemoState["invoices"];
  onResync?: (id: string) => void;
  onSend?: (id: string) => void;
  onNormalize?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>NF-e</th>
            <th>Cliente</th>
            <th>Canal</th>
            <th>Emissão</th>
            <th>Valor</th>
            <th>Vínculos</th>
            <th>Status</th>
            {!compact ? <th>Ação</th> : null}
          </tr>
        </thead>
        <tbody>
          {invoices.map((item) => (
            <tr key={item.id}>
              <td>
                <FileText size={15} />
                <strong>{item.number}</strong>
              </td>
              <td>{item.customer}</td>
              <td>{item.channel}</td>
              <td>
                {new Intl.DateTimeFormat("pt-BR").format(
                  new Date(`${item.issuedAt}T12:00:00`),
                )}
              </td>
              <td>
                <strong>{money(item.valueCents)}</strong>
              </td>
              <td>
                <span className={styles.links}>
                  {item.hasBoleto ? (
                    <ReceiptText size={14} aria-label="Com boleto" />
                  ) : null}
                  {item.hasTracking ? (
                    <Truck size={14} aria-label="Com rastreio" />
                  ) : null}
                  {!item.hasBoleto && !item.hasTracking ? "—" : null}
                  {item.unlinkedItemCode ? (
                    <small className={styles.unlinkedItem}>
                      Item sem vínculo: {item.unlinkedItemCode}
                    </small>
                  ) : null}
                </span>
              </td>
              <td>
                <span className={deliveryStatusClass(item.deliveryStatus)}>
                  {item.deliveryStatus}
                </span>
                <small>{item.status}</small>
              </td>
              {!compact ? (
                <td>
                  <div className={styles.rowActions}>
                    <button
                      className={styles.rowAction}
                      type="button"
                      onClick={() => onResync?.(item.id)}
                    >
                      <RefreshCw size={13} /> Ressincronizar
                    </button>
                    {item.unlinkedItemCode ? (
                      <button
                        className={styles.rowAction}
                        type="button"
                        onClick={() => onNormalize?.(item.id)}
                      >
                        <Link2 size={13} /> Vincular produto
                      </button>
                    ) : null}
                    {item.deliveryStatus === "Pronto para envio" ? (
                      <button
                        className={`${styles.rowAction} ${styles.sendAction}`}
                        type="button"
                        onClick={() => onSend?.(item.id)}
                      >
                        <Send size={13} /> Enviar
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.empty}>
      <Search size={23} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function IntegrationCard({
  name,
  description,
  icon,
  enabled,
  onToggle,
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={styles.integrationCard}>
      <div className={styles.integrationIcon}>{icon}</div>
      <span className={enabled ? styles.integrationOn : styles.integrationOff}>
        {enabled ? "ATIVA · FAKE" : "PAUSADA"}
      </span>
      <h2>{name}</h2>
      <p>{description}</p>
      <button type="button" onClick={onToggle}>
        {enabled ? "Pausar na demo" : "Ativar na demo"}
      </button>
      <small>
        <ShieldCheck size={13} /> Nenhuma credencial ou chamada real
      </small>
    </article>
  );
}

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function basisPoints(value: number): string {
  return `${(value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function deliveryStatusClass(status: DemoDeliveryStatus): string {
  if (status === "Enviado") return styles.success ?? "";
  if (status === "Erro") return styles.danger ?? "";
  if (status === "Mercado livre") return styles.info ?? "";
  return styles.warning ?? "";
}

function createSyncRun(
  kind: DemoSyncKind,
  processed: number,
  from: string | null = null,
  to: string | null = null,
): DemoSyncRun {
  return {
    id: `sync-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    from,
    to,
    processed,
    createdAt: new Date().toISOString(),
  };
}

function syncKindLabel(kind: DemoSyncKind): string {
  if (kind === "nfe") return "NF-e por período";
  if (kind === "nfe-details") return "Documentos da NF-e";
  if (kind === "nfe-delivery") return "Envio de NF-e por APChat";
  if (kind === "nfe-normalization") return "Normalização de item da NF-e";
  if (kind === "payment-methods") return "Formas de pagamento";
  if (kind === "sales-channels") return "Canais de venda";
  if (kind === "sellers") return "Vendedores";
  if (kind === "operation-natures") return "Naturezas de operação";
  if (kind === "scheduled-cycle") return "Ciclo automático";
  if (kind === "satisfaction") return "Pesquisa de satisfação";
  return "Produtos";
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
