"use client";

import type { DashboardSummary, SessionResponse } from "@integrador/contracts";
import {
  Activity,
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Gauge,
  Goal,
  HelpCircle,
  LoaderCircle,
  LogOut,
  Menu,
  Orbit,
  Percent,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import styles from "./dashboard.module.css";

const navigation = [
  { label: "Visão geral", icon: Gauge, href: "/app/dashboard", active: true },
  { label: "Notas fiscais", icon: FileText, href: "/app/nfe", active: false },
  {
    label: "Boletos e rastreio",
    icon: Truck,
    href: "/app/documents",
    active: false,
  },
  { label: "Produtos", icon: Boxes, href: "/app/products", active: false },
  { label: "Pessoas", icon: Users, href: "/app/people", active: false },
  {
    label: "Cadastros comerciais",
    icon: Store,
    href: "/app/commercial",
    active: false,
  },
  {
    label: "Custos e margem",
    icon: CircleDollarSign,
    href: "/app/finance",
    active: false,
  },
  {
    label: "Custos e tributação",
    icon: Percent,
    href: "/app/fiscal",
    active: false,
  },
  { label: "Metas", icon: Goal, href: "/app/goals", active: false },
  {
    label: "Jobs e integrações",
    icon: Activity,
    href: "/app/operations",
    active: false,
  },
] as const;

export function DashboardClient() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [months, setMonths] = useState(6);
  const [refreshKey, setRefreshKey] = useState(0);
  const [globalSearch, setGlobalSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [sessionResponse, summaryResponse] = await Promise.all([
          fetch(`${API_URL}/v1/auth/session`, { credentials: "include" }),
          fetch(`${API_URL}/v1/dashboard/summary?months=${months}`, {
            credentials: "include",
          }),
        ]);
        if (sessionResponse.status === 401 || summaryResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (!sessionResponse.ok || !summaryResponse.ok) throw new Error("api");
        const nextSession = (await sessionResponse.json()) as SessionResponse;
        const nextSummary = (await summaryResponse.json()) as DashboardSummary;
        if (active) {
          setSession(nextSession);
          setSummary(nextSummary);
        }
      } catch {
        if (active)
          setError("Não foi possível carregar os dados do PostgreSQL.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [months, refreshKey, router]);

  async function logout() {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  async function switchTenant(tenantId: string) {
    if (tenantId === session?.tenant.id) return;
    const response = await fetch(`${API_URL}/v1/auth/tenant`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    if (response.ok) {
      setSummary(null);
      setSession(null);
      setRefreshKey((key) => key + 1);
    } else setError("Não foi possível trocar de organização.");
  }

  if (error) {
    return (
      <main className={styles.statePage}>
        <Orbit size={31} />
        <h1>Os dados ainda não chegaram.</h1>
        <p>{error} Confirme a API e as migrations e tente novamente.</p>
        <button type="button" onClick={() => location.reload()}>
          Tentar novamente
        </button>
      </main>
    );
  }
  if (!session || !summary) {
    return (
      <main className={styles.loadingPage}>
        <span>
          <Orbit size={29} />
        </span>
        <LoaderCircle size={19} />
        <p>Conectando à sua operação...</p>
      </main>
    );
  }

  const maxRevenue = Math.max(
    ...summary.months.map((month) => Number(month.grossRevenue)),
    1,
  );
  const firstName = session.user.name.split(" ")[0] ?? session.user.name;
  const calculationTotal = Object.values(summary.analytics.calculation).reduce(
    (total, value) => total + value,
    0,
  );
  const calculationRate = calculationTotal
    ? Math.round(
        (summary.analytics.calculation.success / calculationTotal) * 100,
      )
    : 0;
  const initials = session.user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const metrics = [
    {
      label: "Faturamento",
      value: brl(summary.metrics.grossRevenue),
      detail: `${summary.metrics.invoiceCount} notas`,
      tone: "green",
    },
    {
      label: "Lucro",
      value: brl(summary.metrics.profit),
      detail: `${summary.metrics.marginPercent}% de margem`,
      tone: "mint",
    },
    {
      label: "Custo líquido",
      value: brl(summary.metrics.cost),
      detail: "Base consolidada",
      tone: "blue",
    },
    {
      label: "Impostos",
      value: brl(summary.metrics.tax),
      detail: "Total no período",
      tone: "amber",
    },
  ] as const;

  return (
    <main className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
      >
        <Link className={styles.brand} href="/">
          <span>
            <Orbit size={19} />
          </span>
          <div>
            <strong>APBling</strong>
            <small>BLING OPERATIONS</small>
          </div>
        </Link>
        <div className={styles.tenantSwitch}>
          <span>
            <Building2 size={17} />
          </span>
          <div>
            <small>Organização</small>
            <select
              aria-label="Organização ativa"
              value={session.tenant.id}
              onChange={(event) => void switchTenant(event.target.value)}
            >
              {session.availableTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav className={styles.nav} aria-label="Navegação da aplicação">
          <p>OPERAÇÃO</p>
          {navigation.map(({ label, icon: Icon, href, active }) => (
            <Link
              className={active ? styles.active : undefined}
              href={href}
              key={label}
            >
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          ))}
          <p>ADMINISTRAÇÃO</p>
          {session.user.superAdmin ? (
            <Link href="/app/organizations">
              <Building2 size={17} />
              <span>Empresas</span>
            </Link>
          ) : null}
          {session.role === "owner" || session.role === "admin" ? (
            <Link href="/app/users">
              <ShieldCheck size={17} />
              <span>Usuários e acesso</span>
            </Link>
          ) : null}
          <Link href="/app/settings">
            <Settings size={17} />
            <span>Configurações</span>
          </Link>
        </nav>
        <div className={styles.sidebarFooter}>
          <span>
            <HelpCircle size={17} /> Central de ajuda
          </span>
          <button type="button" onClick={() => void logout()}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <button
            className={styles.mobileMenu}
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <form
            className={styles.search}
            onSubmit={(event) => {
              event.preventDefault();
              const value = globalSearch.trim();
              if (value)
                router.push(`/app/nfe?search=${encodeURIComponent(value)}`);
            }}
          >
            <Search size={16} />
            <input
              placeholder="Buscar nota, cliente ou produto..."
              aria-label="Busca global"
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
            />
            <kbd>⌘ K</kbd>
          </form>
          <div className={styles.topActions}>
            <span className={styles.source}>
              <i /> PostgreSQL
            </span>
            <button type="button" aria-label="Notificações">
              <Bell size={18} />
            </button>
            <div>{initials}</div>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.heading}>
            <div>
              <p>{dateLabel(new Date())}</p>
              <h1>Boa noite, {firstName}.</h1>
              <span>
                Acompanhe a saúde financeira e fiscal da sua operação.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              title="Atualizar indicadores"
            >
              <RefreshCw size={16} /> Atualizar dados
            </button>
          </div>

          <section
            className={styles.metrics}
            aria-label="Indicadores principais"
          >
            {metrics.map((metric) => (
              <article className={styles.metric} key={metric.label}>
                <div>
                  <span>{metric.label}</span>
                  <i data-tone={metric.tone} />
                </div>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            ))}
          </section>

          <section className={styles.grid}>
            <article className={`${styles.panel} ${styles.revenuePanel}`}>
              <div className={styles.panelHead}>
                <div>
                  <strong>Faturamento e lucro</strong>
                  <small>
                    Últimos {summary.period.months} meses · margem do DashFinal
                  </small>
                </div>
                <label className={styles.periodSelect}>
                  <select
                    value={months}
                    onChange={(event) => setMonths(Number(event.target.value))}
                  >
                    <option value="3">3 meses</option>
                    <option value="6">6 meses</option>
                    <option value="12">12 meses</option>
                    <option value="24">24 meses</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
              <div className={styles.legend}>
                <span>
                  <i className={styles.revenueDot} /> Faturamento
                </span>
                <span>
                  <i className={styles.profitDot} /> Lucro
                </span>
              </div>
              <div
                className={styles.chart}
                aria-label="Faturamento e lucro por mês"
              >
                {summary.months.map((month) => {
                  const revenueHeight =
                    (Number(month.grossRevenue) / maxRevenue) * 100;
                  const profitHeight =
                    (Number(month.profit) / maxRevenue) * 100;
                  return (
                    <div
                      className={styles.barGroup}
                      key={month.month}
                      title={`${month.label}: ${brl(month.grossRevenue)}`}
                    >
                      <div>
                        <i
                          style={{ height: `${Math.max(revenueHeight, 2)}%` }}
                        />
                        <b
                          style={{ height: `${Math.max(profitHeight, 2)}%` }}
                        />
                      </div>
                      <small>{month.label}</small>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className={`${styles.panel} ${styles.healthPanel}`}>
              <div className={styles.panelHead}>
                <div>
                  <strong>Qualidade dos dados</strong>
                  <small>Origem e isolamento</small>
                </div>
                <Activity size={17} />
              </div>
              <div className={styles.healthScore}>
                <div>
                  <strong>{calculationRate}</strong>
                  <small>%</small>
                </div>
                <span>
                  <strong>Cálculos com sucesso</strong>
                  <small>
                    {summary.analytics.calculation.success} de{" "}
                    {calculationTotal} notas
                  </small>
                </span>
              </div>
              <div className={styles.healthRows}>
                <div>
                  <i />
                  <span>
                    <strong>Fonte PostgreSQL</strong>
                    <small>view_nfe do legado</small>
                  </span>
                  <DatabaseIcon />
                </div>
                <div>
                  <i />
                  <span>
                    <strong>Sessão e RBAC</strong>
                    <small>
                      {session.role} em {session.tenant.name}
                    </small>
                  </span>
                  <ShieldCheck size={15} />
                </div>
                <div>
                  <i />
                  <span>
                    <strong>Integrações externas</strong>
                    <small>Conforme configuração do tenant</small>
                  </span>
                  <Activity size={15} />
                </div>
              </div>
            </article>
          </section>

          <section className={styles.analyticsGrid}>
            <article className={`${styles.panel} ${styles.rankingPanel}`}>
              <div className={styles.panelHead}>
                <div>
                  <strong>Receita por canal</strong>
                  <small>Canais do legado no período</small>
                </div>
                <Store size={17} />
              </div>
              <div className={styles.rankingList}>
                {summary.analytics.channels.map((channel) => {
                  const max = Number(
                    summary.analytics.channels[0]?.revenue ?? 1,
                  );
                  return (
                    <div key={channel.label}>
                      <span>
                        <strong>{channel.label}</strong>
                        <small>
                          {channel.invoices} notas · lucro {brl(channel.profit)}
                        </small>
                      </span>
                      <b>{brl(channel.revenue)}</b>
                      <i>
                        <em
                          style={{
                            width: `${max ? Math.max((Number(channel.revenue) / max) * 100, 2) : 0}%`,
                          }}
                        />
                      </i>
                    </div>
                  );
                })}
                {summary.analytics.channels.length === 0 ? (
                  <p>Sem canais no período.</p>
                ) : null}
              </div>
            </article>
            <article className={`${styles.panel} ${styles.rankingPanel}`}>
              <div className={styles.panelHead}>
                <div>
                  <strong>Desempenho por vendedor</strong>
                  <small>Faturamento e lucro persistidos</small>
                </div>
                <Users size={17} />
              </div>
              <div className={styles.rankingList}>
                {summary.analytics.vendors.map((vendor) => (
                  <div key={vendor.label}>
                    <span>
                      <strong>{vendor.label}</strong>
                      <small>
                        {vendor.invoices} notas · lucro {brl(vendor.profit)}
                      </small>
                    </span>
                    <b>{brl(vendor.revenue)}</b>
                  </div>
                ))}
                {summary.analytics.vendors.length === 0 ? (
                  <p>Sem vendedores no período.</p>
                ) : null}
              </div>
            </article>
            <article className={`${styles.panel} ${styles.documentPanel}`}>
              <div className={styles.panelHead}>
                <div>
                  <strong>Fluxos relacionados</strong>
                  <small>Documentos e pós-venda</small>
                </div>
                <Workflow size={17} />
              </div>
              <Link href="/app/documents">
                <span>
                  <ReceiptText size={17} />
                </span>
                <div>
                  <strong>{summary.analytics.documents.boletos}</strong>
                  <small>Boletos vinculados</small>
                </div>
                <ChevronDown size={13} />
              </Link>
              <Link href="/app/documents">
                <span>
                  <Truck size={17} />
                </span>
                <div>
                  <strong>{summary.analytics.documents.tracking}</strong>
                  <small>Objetos com rastreio</small>
                </div>
                <ChevronDown size={13} />
              </Link>
              <Link href="/app/operations#operation-settings">
                <span>
                  <Activity size={17} />
                </span>
                <div>
                  <strong>{summary.analytics.documents.pendingSurvey}</strong>
                  <small>Pesquisas pendentes</small>
                </div>
                <ChevronDown size={13} />
              </Link>
              <div className={styles.calculationLegend}>
                <span>
                  <i className={styles.calcSuccess} /> Sucesso{" "}
                  <b>{summary.analytics.calculation.success}</b>
                </span>
                <span>
                  <i className={styles.calcWarning} /> Inconsistência{" "}
                  <b>{summary.analytics.calculation.inconsistent}</b>
                </span>
                <span>
                  <i className={styles.calcFailure} /> Falha{" "}
                  <b>{summary.analytics.calculation.failed}</b>
                </span>
              </div>
            </article>
          </section>

          <section className={`${styles.panel} ${styles.productsPanel}`}>
            <div className={styles.panelHead}>
              <div>
                <strong>Produtos com maior venda líquida</strong>
                <small>Quantidade, receita e lucro dos itens das NF-e</small>
              </div>
              <Link href="/app/products">Ver catálogo</Link>
            </div>
            <div className={styles.productGrid}>
              {summary.analytics.products.map((product, index) => (
                <article key={`${product.name}-${index}`}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <div>
                    <strong>{product.name}</strong>
                    <small>
                      {new Intl.NumberFormat("pt-BR", {
                        maximumFractionDigits: 3,
                      }).format(Number(product.quantity))}{" "}
                      unidades
                    </small>
                  </div>
                  <span>
                    <strong>{brl(product.revenue)}</strong>
                    <small>Lucro {brl(product.profit)}</small>
                  </span>
                </article>
              ))}
              {summary.analytics.products.length === 0 ? (
                <p>Sem itens calculados no período.</p>
              ) : null}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.invoicesPanel}`}>
            <div className={styles.panelHead}>
              <div>
                <strong>Notas fiscais recentes</strong>
                <small>Dados retornados pela API tenant-aware</small>
              </div>
              <span>{summary.recentInvoices.length} registros</span>
            </div>
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
                  {summary.recentInvoices.map((invoice) => (
                    <tr key={`${invoice.number}-${invoice.issuedAt}`}>
                      <td>
                        <FileText size={15} />
                        <strong>{invoice.number}</strong>
                      </td>
                      <td>{invoice.customerName}</td>
                      <td>{invoice.channel}</td>
                      <td>
                        {new Intl.DateTimeFormat("pt-BR").format(
                          new Date(invoice.issuedAt),
                        )}
                      </td>
                      <td>
                        <strong>{brl(invoice.value)}</strong>
                      </td>
                      <td>
                        <span className={styles.links}>
                          {invoice.hasBoleto ? (
                            <ReceiptText size={14} aria-label="Com boleto" />
                          ) : null}
                          {invoice.hasTracking ? (
                            <Truck size={14} aria-label="Com rastreio" />
                          ) : null}
                          {!invoice.hasBoleto && !invoice.hasTracking
                            ? "—"
                            : null}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            invoice.status === "Autorizada"
                              ? styles.success
                              : styles.warning
                          }
                        >
                          {invoice.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function brl(value: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(date)
    .toUpperCase();
}

function DatabaseIcon() {
  return <Boxes size={15} />;
}
