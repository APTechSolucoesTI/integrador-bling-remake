"use client";

import {
  Activity,
  ArrowLeft,
  Bell,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  Database,
  FileText,
  Gauge,
  Goal,
  Link2,
  Menu,
  Minus,
  PackagePlus,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
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
  demoMonthlySeries,
  loadDemoState,
  saveDemoState,
  type DemoInvoiceStatus,
  type DemoState,
} from "../../lib/demo-store";
import styles from "./public-demo.module.css";

type DemoView =
  "dashboard" | "invoices" | "products" | "people" | "goals" | "integrations";

const navigation = [
  { id: "dashboard", label: "Visão geral", icon: Gauge },
  { id: "invoices", label: "Notas fiscais", icon: FileText },
  { id: "products", label: "Produtos", icon: Boxes },
  { id: "people", label: "Pessoas", icon: Users },
  { id: "goals", label: "Metas", icon: Goal },
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
    subtitle: "Busque, filtre, crie e altere o status das notas fictícias.",
  },
  products: {
    eyebrow: "CATÁLOGO",
    title: "Produtos",
    subtitle:
      "Experimente ajustes de estoque que ficam salvos neste navegador.",
  },
  people: {
    eyebrow: "RELACIONAMENTO",
    title: "Pessoas",
    subtitle: "Consulte clientes mockados e altere sua situação localmente.",
  },
  goals: {
    eyebrow: "PERFORMANCE",
    title: "Metas",
    subtitle: "Simule cenários mudando a meta comercial da demonstração.",
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
  const [statusFilter, setStatusFilter] = useState<DemoInvoiceStatus | "Todos">(
    "Todos",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setState(loadDemoState(window.localStorage));
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
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredInvoices = state.invoices.filter(
    (item) =>
      (statusFilter === "Todos" || item.status === statusFilter) &&
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
    setSearch("");
    setMenuOpen(false);
  }

  function changeInvoiceStatus(id: string, status: DemoInvoiceStatus) {
    updateState(
      (current) => ({
        ...current,
        invoices: current.invoices.map((item) =>
          item.id === id ? { ...item, status } : item,
        ),
      }),
      "Status da NF-e salvo neste navegador.",
    );
  }

  function addInvoice() {
    const sequence =
      Math.max(...state.invoices.map((item) => Number(item.number)), 10_176) +
      1;
    updateState(
      (current) => ({
        ...current,
        invoices: [
          {
            id: `local-${sequence}`,
            number: String(sequence).padStart(9, "0"),
            customer: "Novo cliente demonstrativo",
            channel: "Bling",
            issuedAt: "2026-08-08",
            valueCents: 159_900,
            costCents: 82_400,
            taxCents: 17_590,
            status: "Pendente",
            hasBoleto: false,
            hasTracking: false,
          },
          ...current.invoices,
        ],
      }),
      "Nova NF-e fictícia criada.",
    );
  }

  function adjustStock(id: string, amount: number) {
    updateState(
      (current) => ({
        ...current,
        products: current.products.map((item) =>
          item.id === id
            ? { ...item, stock: Math.max(0, item.stock + amount) }
            : item,
        ),
      }),
      "Estoque atualizado localmente.",
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
            <button type="button" aria-label="Notificações demonstrativas">
              <Bell size={18} />
              <i />
            </button>
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
                onClick={addInvoice}
              >
                <Plus size={16} /> Nova NF-e mock
              </button>
            ) : null}
            {view === "dashboard" ? (
              <button
                className={styles.secondaryAction}
                type="button"
                onClick={() =>
                  setToast("Os dados já estão atualizados no localStorage.")
                }
              >
                <RefreshCw size={15} /> Atualizar visão
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
                  detail="Status manipulável"
                  tone="blue"
                />
                <Metric
                  label="Estoque baixo"
                  value={String(metrics.lowStockProducts)}
                  detail="Produtos no mínimo"
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
              <article className={`${styles.panel} ${styles.tablePanel}`}>
                <PanelHead
                  title="Notas fiscais recentes"
                  subtitle="Clique em Notas fiscais para manipular os registros"
                  action={
                    <button
                      type="button"
                      onClick={() => changeView("invoices")}
                    >
                      Ver todas
                    </button>
                  }
                />
                <InvoiceTable
                  invoices={state.invoices.slice(0, 5)}
                  onStatusChange={changeInvoiceStatus}
                  compact
                />
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
                      "Autorizada",
                      "Pendente",
                      "Em processamento",
                      "Cancelada",
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
                onStatusChange={changeInvoiceStatus}
              />
              {filteredInvoices.length === 0 ? (
                <EmptyState
                  title="Nenhuma NF-e encontrada"
                  text="Mude os filtros ou crie uma nova nota fictícia."
                />
              ) : null}
            </article>
          ) : null}

          {view === "products" ? (
            <article className={`${styles.panel} ${styles.listPanel}`}>
              <div className={styles.listSummary}>
                <span>
                  <PackagePlus size={17} /> {state.products.length} produtos
                  fictícios
                </span>
                <small>Use + e − para movimentar o estoque.</small>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>SKU</th>
                      <th>Preço</th>
                      <th>Mínimo</th>
                      <th>Estoque atual</th>
                      <th>Ajustar</th>
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
                          <strong>{money(product.priceCents)}</strong>
                        </td>
                        <td>{product.minimumStock}</td>
                        <td>
                          <span
                            className={
                              product.stock <= product.minimumStock
                                ? styles.stockLow
                                : styles.stockOk
                            }
                          >
                            {product.stock} un.
                          </span>
                        </td>
                        <td>
                          <div className={styles.stepper}>
                            <button
                              type="button"
                              onClick={() => adjustStock(product.id, -1)}
                              aria-label={`Diminuir estoque de ${product.name}`}
                            >
                              <Minus size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustStock(product.id, 1)}
                              aria-label={`Aumentar estoque de ${product.name}`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
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
                <small>Alternar situação salva a mudança localmente.</small>
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
                        person.active ? styles.enabled : styles.disabled
                      }
                      type="button"
                      onClick={() =>
                        updateState(
                          (current) => ({
                            ...current,
                            people: current.people.map((item) =>
                              item.id === person.id
                                ? { ...item, active: !item.active }
                                : item,
                            ),
                          }),
                          person.active
                            ? "Cliente desativado na demo."
                            : "Cliente reativado na demo.",
                        )
                      }
                    >
                      {person.active ? "Ativo" : "Inativo"}
                    </button>
                  </article>
                ))}
              </div>
            </article>
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

function InvoiceTable({
  invoices,
  onStatusChange,
  compact = false,
}: {
  invoices: DemoState["invoices"];
  onStatusChange: (id: string, status: DemoInvoiceStatus) => void;
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
                </span>
              </td>
              <td>
                {compact ? (
                  <span className={statusClass(item.status)}>
                    {item.status}
                  </span>
                ) : (
                  <select
                    value={item.status}
                    onChange={(event) =>
                      onStatusChange(
                        item.id,
                        event.target.value as DemoInvoiceStatus,
                      )
                    }
                    aria-label={`Status da nota ${item.number}`}
                  >
                    <option>Autorizada</option>
                    <option>Pendente</option>
                    <option>Em processamento</option>
                    <option>Cancelada</option>
                  </select>
                )}
              </td>
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

function statusClass(status: DemoInvoiceStatus): string {
  if (status === "Autorizada") return styles.success ?? "";
  if (status === "Cancelada") return styles.danger ?? "";
  if (status === "Em processamento") return styles.info ?? "";
  return styles.warning ?? "";
}
