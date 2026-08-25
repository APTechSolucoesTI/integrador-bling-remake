"use client";

import type {
  DashboardExecutive,
  SessionResponse,
} from "@integrador/contracts";
import brazilMap from "@svg-maps/brazil";
import {
  BarChart3,
  CalendarRange,
  ChevronRight,
  Download,
  Factory,
  Filter,
  Gauge,
  LineChart as LineIcon,
  LoaderCircle,
  MapPinned,
  Menu,
  PackageSearch,
  ShoppingBasket,
  RefreshCw,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { API_URL } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import { ApplicationSidebar } from "../layout/application-sidebar";
import { ApplicationHeaderActions } from "../layout/application-header-actions";
import { ApplicationGlobalSearch } from "../layout/application-global-search";
import styles from "./dashboard.module.css";

type Tab =
  "revenue" | "profit" | "products" | "cmv" | "manufacturing" | "cost" | "map";
const tabs: Array<{ id: Tab; label: string; icon: typeof Gauge }> = [
  { id: "revenue", label: "Faturamento", icon: BarChart3 },
  { id: "profit", label: "Lucro", icon: TrendingUp },
  { id: "products", label: "Lucro por produto", icon: PackageSearch },
  { id: "cmv", label: "CMV", icon: ShoppingBasket },
  { id: "manufacturing", label: "Fabricação própria", icon: Factory },
  { id: "cost", label: "Custo × lucro mensal", icon: LineIcon },
  { id: "map", label: "Mapa", icon: MapPinned },
];
export function DashboardClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [data, setData] = useState<DashboardExecutive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const tab = (
    tabs.some((item) => item.id === search.get("tab"))
      ? search.get("tab")
      : "revenue"
  ) as Tab;
  const query = search.toString();
  const setParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(query);
      Object.entries(updates).forEach(([key, value]) =>
        value ? params.set(key, value) : params.delete(key),
      );
      router.replace(`/app/dashboard?${params}`);
    },
    [query, router],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams(query);
    params.delete("tab");
    Promise.all([
      fetch(`${API_URL}/v1/auth/session`, { credentials: "include" }),
      fetch(`${API_URL}/v1/dashboard/executive?${params}`, {
        credentials: "include",
      }),
    ])
      .then(async ([s, d]) => {
        if (s.status === 401) {
          router.replace("/login");
          return;
        }
        if (s.status === 403 || d.status === 403) throw new Error("forbidden");
        if (!s.ok || !d.ok) throw new Error("api");
        if (active) {
          setSession((await s.json()) as SessionResponse);
          setData((await d.json()) as DashboardExecutive);
        }
      })
      .catch(
        (cause: Error) =>
          active &&
          setError(
            cause.message === "forbidden"
              ? "Você não possui acesso ao Dashboard Executivo."
              : "Não foi possível consultar os indicadores agora.",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query, router]);
  const report = (kind: string, extra: Record<string, string>) => {
    const p = new URLSearchParams(query);
    p.delete("tab");
    p.set("view", kind);
    if (extra.dimension === "products" && !p.has("monthCompetence")) {
      const latestVisibleCompetence =
        kind === "manufacturing"
          ? data?.manufacturing.periods.at(-1)?.key
          : data?.cmv.periods.at(-1)?.key;
      if (latestVisibleCompetence) {
        p.set("monthCompetence", latestVisibleCompetence);
      }
    }
    if (extra.dimension === "products") {
      p.delete("from");
      p.delete("to");
    }
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    router.push(`/app/reports/${kind}?${p}`);
  };
  async function switchTenant(tenantId: string) {
    if (tenantId === session?.tenant.id) return;
    const response = await fetch(`${API_URL}/v1/auth/tenant`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    if (!response.ok) return setError("Não foi possível trocar de empresa.");
    window.location.assign(`/app/dashboard?tab=${tab}`);
  }
  async function logout() {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    router.replace("/login");
  }
  if (!session && loading)
    return (
      <main className={styles.state}>
        <LoaderCircle className={styles.spin} />
        <h1>Preparando indicadores executivos</h1>
      </main>
    );
  if (!session)
    return (
      <main className={styles.state}>
        <Gauge />
        <h1>Acesso indisponível</h1>
        <p>{error}</p>
      </main>
    );
  return (
    <main className={styles.shell}>
      <ApplicationSidebar session={session} open={menu} onLogout={logout} />
      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <button
            className={styles.mobileMenu}
            onClick={() => setMenu(!menu)}
            aria-label="Abrir menu"
          >
            <Menu />
          </button>
          <ApplicationGlobalSearch />
          <ApplicationHeaderActions session={session} onLogout={logout} />
        </header>
        <div className={styles.content}>
          <div className={styles.heading}>
            <div>
              <span>INTELIGÊNCIA · RESULTADOS</span>
              <h1>Visão geral da operação</h1>
              <p>
                Indicadores fiscais e financeiros calculados diretamente no
                PostgreSQL.
              </p>
            </div>
            <button onClick={() => router.refresh()}>
              <RefreshCw size={15} /> Atualizar
            </button>
          </div>
          <FilterBar
            data={data}
            session={session}
            tab={tab}
            search={search}
            setParams={setParams}
            onSwitchTenant={switchTenant}
          />
          <nav className={styles.tabs}>
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={tab === id ? styles.activeTab : ""}
                onClick={() => setParams({ tab: id })}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
          {error ? (
            <div className={styles.error}>
              {error}
              <button onClick={() => router.refresh()}>Tentar novamente</button>
            </div>
          ) : null}
          {loading && !data ? (
            <Skeleton />
          ) : data ? (
            <DashboardTab tab={tab} data={data} report={report} />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function FilterBar({
  data,
  session,
  tab,
  search,
  setParams,
  onSwitchTenant,
}: {
  data: DashboardExecutive | null;
  session: SessionResponse;
  tab: Tab;
  search: ReturnType<typeof useSearchParams>;
  setParams: (x: Record<string, string | undefined>) => void;
  onSwitchTenant: (tenantId: string) => Promise<void>;
}) {
  const isCost = tab === "cost";
  const active = isCost
    ? ["goalCompetence"].filter((key) => search.get(key))
    : [
        "from",
        "to",
        "origin",
        "monthCompetence",
        "product",
        "productGroup",
      ].filter((key) => search.get(key));
  return (
    <section className={styles.filters}>
      <header className={styles.filterHeader}>
        <span>
          <Filter size={14} /> Filtros do dashboard
        </span>
        {active.length ? (
          <button
            onClick={() =>
              setParams(
                Object.fromEntries(active.map((key) => [key, undefined])),
              )
            }
          >
            <RotateCcw size={13} /> Limpar filtros
          </button>
        ) : null}
      </header>
      <div className={styles.filterMain}>
        <label className={styles.companyFilter}>
          <span>
            Empresa / unidade
            <select
              value={session.tenant.id}
              onChange={(event) => void onSwitchTenant(event.target.value)}
            >
              {session.availableTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </span>
        </label>
        {isCost ? (
          <label className={styles.goalFilter}>
            <span>
              Competência da meta
              <select
                value={search.get("goalCompetence") ?? ""}
                onChange={(event) =>
                  setParams({ goalCompetence: event.target.value })
                }
              >
                <option value="">Competência mais recente</option>
                {data?.filters.goalCompetences.map((value) => (
                  <option key={value} value={value}>
                    {formatCompetence(value)}
                  </option>
                ))}
              </select>
            </span>
          </label>
        ) : (
          <>
            <label>
              <span>
                Origem da venda
                <select
                  value={search.get("origin") ?? ""}
                  onChange={(event) =>
                    setParams({ origin: event.target.value })
                  }
                >
                  <option value="">Todas as origens</option>
                  {data?.filters.origins.map((origin) => (
                    <option key={origin} value={origin}>
                      {origin}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className={styles.productFilter}>
              <span>
                Produto
                <select
                  value={search.get("product") ?? ""}
                  onChange={(event) =>
                    setParams({ product: event.target.value })
                  }
                >
                  <option value="">Todos os produtos</option>
                  {data?.filters.products.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label>
              <span>
                Grupo de produto
                <select
                  value={search.get("productGroup") ?? ""}
                  onChange={(event) =>
                    setParams({ productGroup: event.target.value })
                  }
                >
                  <option value="">Todos os grupos</option>
                  {data?.filters.productGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className={styles.periodFilter}>
              <CalendarRange />
              <span>
                Competência — de
                <input
                  type="date"
                  value={search.get("from") ?? ""}
                  onChange={(event) => setParams({ from: event.target.value })}
                />
              </span>
            </label>
            <label className={styles.periodFilter}>
              <span>
                Competência — até
                <input
                  type="date"
                  value={search.get("to") ?? ""}
                  onChange={(event) => setParams({ to: event.target.value })}
                />
              </span>
            </label>
            <label>
              <span>
                Mês de competência
                <select
                  value={search.get("monthCompetence") ?? ""}
                  onChange={(event) =>
                    setParams({ monthCompetence: event.target.value })
                  }
                >
                  <option value="">Todos os meses</option>
                  {data?.filters.months.map((month) => (
                    <option key={month} value={month}>
                      {formatMonth(month)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </>
        )}
      </div>
    </section>
  );
}

function DashboardTab({
  tab,
  data,
  report,
}: {
  tab: Tab;
  data: DashboardExecutive;
  report: (kind: string, extra: Record<string, string>) => void;
}) {
  if (tab === "revenue") return <Revenue data={data} report={report} />;
  if (tab === "profit") return <Profit data={data} report={report} />;
  if (tab === "products") return <Products data={data} report={report} />;
  if (tab === "cmv") return <Cmv data={data} report={report} />;
  if (tab === "manufacturing")
    return <Manufacturing data={data} report={report} />;
  if (tab === "cost") return <Cost data={data} />;
  return <MapTab data={data} report={report} />;
}
function Revenue({
  data,
  report,
}: {
  data: DashboardExecutive;
  report: (k: string, e: Record<string, string>) => void;
}) {
  return (
    <div className={styles.dashboard}>
      <div className={styles.kpis}>
        <Kpi
          label="Faturamento"
          value={brl(data.metrics.revenue)}
          detail="Valor total faturado"
          onClick={() => report("revenue", {})}
        />
        <Kpi
          label="Qtde. vendas"
          value={num(data.metrics.invoices)}
          detail="Notas consideradas"
          onClick={() => report("revenue", {})}
        />
        <Kpi
          label="Ticket médio"
          value={brl(
            data.metrics.invoices
              ? Number(data.metrics.revenue) / data.metrics.invoices
              : 0,
          )}
          detail="Faturamento ÷ vendas"
          onClick={() => report("revenue", {})}
        />
      </div>
      <div className={styles.grid}>
        <SectionDivider
          title="Canais e origem da venda"
          description="Volume, faturamento e ticket médio por canal comercial."
        />
        <Chart title="Faturamento por origem">
          <Horizontal
            data={data.origins}
            field="revenue"
            onClick={(x) => report("revenue", { origin: x })}
          />
        </Chart>
        <Chart title="Qtde. vendas por origem">
          <Horizontal
            data={data.origins}
            field="invoices"
            onClick={(x) => report("revenue", { origin: x })}
          />
        </Chart>
        <Chart title="TME por origem">
          <Horizontal
            data={data.origins}
            field="averageTicket"
            onClick={(x) => report("revenue", { origin: x })}
          />
        </Chart>
        <SectionDivider
          title="Evolução no tempo"
          description="Comparação mensal, comportamento diário e média do período."
        />
        <Chart title="Faturamento por período" wide>
          <Period
            data={data.periods}
            field="revenue"
            onClick={(x) => report("revenue", { monthCompetence: x })}
          />
        </Chart>
        <Chart title="Qtde. vendas por período" wide>
          <Period
            data={data.periods}
            field="invoices"
            onClick={(x) => report("revenue", { monthCompetence: x })}
          />
        </Chart>
        <Chart title="Faturamento diário com média" full>
          <Daily
            data={data.daily}
            onClick={(date) => report("revenue", { from: date, to: date })}
          />
        </Chart>
        <SectionDivider
          title="Empresa e clientes"
          description="Concentração do faturamento na unidade e nos principais compradores."
        />
        <Chart title="Indicadores por coligada">
          <Horizontal
            data={data.companies}
            field="revenue"
            onClick={() => report("revenue", {})}
          />
        </Chart>
        <Ranking
          title="Ranking faturamento cliente"
          data={data.customers}
          field="revenue"
          onClick={(customer) => report("revenue", { customer })}
        />
        <Ranking
          title="Ranking quantidade de compras"
          data={data.customers}
          field="invoices"
          onClick={(customer) => report("revenue", { customer })}
        />
      </div>
    </div>
  );
}
function Profit({
  data,
  report,
}: {
  data: DashboardExecutive;
  report: (k: string, e: Record<string, string>) => void;
}) {
  return (
    <div className={styles.dashboard}>
      <div className={styles.kpis}>
        <Kpi
          label="Faturamento"
          value={brl(data.metrics.revenue)}
          onClick={() => report("profit", {})}
        />
        <Kpi
          label="Impostos"
          value={brl(data.metrics.tax)}
          onClick={() => report("profit", {})}
        />
        <Kpi
          label="Taxas"
          value={brl(data.metrics.fees)}
          detail="Comissões e taxas operacionais"
          onClick={() => report("profit", {})}
        />
        <Kpi
          label="Frete"
          value={brl(data.metrics.freight)}
          detail="Frete fiscal das NF-e"
          onClick={() => report("profit", {})}
        />
        <Kpi
          label="Outras despesas / ajustes"
          value={brl(data.metrics.otherExpenses)}
          detail="Acréscimos do XML e arredondamentos"
          onClick={() => report("profit", {})}
        />
        <Kpi
          label="Custo líquido"
          value={brl(data.metrics.cost)}
          onClick={() => report("profit", {})}
        />
        <Kpi
          label="Lucro líquido"
          value={brl(data.metrics.profit)}
          onClick={() => report("profit", {})}
        />
        <Kpi
          label="Margem"
          value={`${data.metrics.margin}%`}
          onClick={() => report("profit", {})}
        />
      </div>
      <div className={styles.grid}>
        <SectionDivider
          title="Rentabilidade por canal"
          description="Lucro e resultado médio das notas em cada origem."
        />
        <Chart title="Lucro por origem" wide>
          <Horizontal
            data={data.origins}
            field="profit"
            onClick={(x) => report("profit", { origin: x })}
          />
        </Chart>
        <Chart title="TME de lucro por origem" wide>
          <Horizontal
            data={data.origins}
            field="averageProfit"
            onClick={(x) => report("profit", { origin: x })}
          />
        </Chart>
        <SectionDivider
          title="Evolução financeira"
          description="Lucro, custo e faturamento acompanhados ao longo do período."
        />
        <Chart title="Lucro por período" wide>
          <Period
            data={data.periods}
            field="profit"
            onClick={(x) => report("profit", { monthCompetence: x })}
          />
        </Chart>
        <Chart title="Faturamento × custo" wide>
          <Compare data={data.periods} />
        </Chart>
        <Chart title="Lucro diário e acumulado" full>
          <ProfitDaily
            data={data.daily}
            onClick={(date) => report("profit", { from: date, to: date })}
          />
        </Chart>
        <SectionDivider
          title="Concentração de resultado"
          description="Clientes e produtos com maior contribuição no lucro."
        />
        <Ranking
          title="Ranking de lucro por cliente"
          data={data.customers}
          field="profit"
          onClick={(customer) => report("profit", { customer })}
          wide
        />
        <Ranking
          title="Lucro por produto"
          data={data.products.slice(0, 20).map((x) => ({
            name: x.name,
            profit: x.profit,
            revenue: x.revenue,
            invoices: x.invoices,
          }))}
          field="profit"
          onClick={(product) => report("profit", { product })}
          wide
        />
      </div>
    </div>
  );
}
function Products({
  data,
  report,
}: {
  data: DashboardExecutive;
  report: (k: string, e: Record<string, string>) => void;
}) {
  const rows = data.products;
  return (
    <section className={styles.tableCard}>
      <header>
        <div>
          <h2>Lucro por produto</h2>
          <p>{rows.length} agrupamentos de produto, mês e origem.</p>
        </div>
        <button
          onClick={() =>
            downloadCsv(
              "lucro-produtos",
              [
                "Código",
                "Produto",
                "Origem",
                "Mês",
                "Quantidade",
                "Faturamento",
                "Custo",
                "Lucro",
                "Margem",
              ],
              rows.map((r) => [
                r.code,
                r.name,
                r.origin,
                r.month,
                r.quantity,
                r.revenue,
                r.cost,
                r.profit,
                r.margin,
              ]),
            )
          }
        >
          <Download /> Exportar CSV
        </button>
      </header>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Origem</th>
              <th>Mês</th>
              <th>Quantidade</th>
              <th>Faturamento</th>
              <th>Custo</th>
              <th>Lucro</th>
              <th>Margem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.code}-${r.month}-${r.origin}-${i}`}
                onClick={() =>
                  report("products", { product: r.name, origin: r.origin })
                }
              >
                <td>
                  <strong>{r.name}</strong>
                  <small>{r.code}</small>
                </td>
                <td>{r.origin}</td>
                <td>{r.month}</td>
                <td>{num(Number(r.quantity))}</td>
                <td>{brl(r.revenue)}</td>
                <td>{brl(r.cost)}</td>
                <td className={Number(r.profit) < 0 ? styles.negative : ""}>
                  {brl(r.profit)}
                </td>
                <td>
                  {r.margin}% <ChevronRight />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <Empty /> : null}
      </div>
    </section>
  );
}
function Cmv({
  data,
  report,
}: {
  data: DashboardExecutive;
  report: (k: string, e: Record<string, string>) => void;
}) {
  const cmv = data.cmv;
  return (
    <div className={styles.dashboard}>
      <div className={styles.kpis}>
        <Kpi
          label="CMV total"
          value={brl(cmv.total)}
          detail="Custo dos itens efetivamente vendidos"
          onClick={() => report("cmv", {})}
        />
        <Kpi
          label="Itens vendidos"
          value={num(Number(cmv.quantity))}
          detail="Quantidade somada nas NF-e"
          onClick={() => report("cmv", {})}
        />
        <Kpi
          label="NF-e com mercadorias"
          value={num(cmv.invoices)}
          detail="Notas consideradas no CMV"
          onClick={() => report("cmv", {})}
        />
        <Kpi
          label="CMV médio por NF-e"
          value={brl(cmv.invoices ? Number(cmv.total) / cmv.invoices : 0)}
          detail="CMV total ÷ notas"
          onClick={() => report("cmv", {})}
        />
      </div>
      <div className={styles.grid}>
        <SectionDivider
          title="Composição do custo vendido"
          description="Somente custo cadastrado do produto multiplicado pela quantidade vendida."
        />
        <Chart title="CMV por período" wide>
          <Period
            data={cmv.periods}
            field="cost"
            onClick={(month) => report("cmv", { monthCompetence: month })}
          />
        </Chart>
        <Chart title="CMV por origem" wide>
          <Horizontal
            data={cmv.origins}
            field="cost"
            onClick={(origin) => report("cmv", { origin })}
          />
        </Chart>
        <ValueRanking
          title="Produtos com maior CMV"
          data={cmv.products.map((item) => ({
            name: item.name,
            value: item.cost,
            detail: `${item.group} · ${num(Number(item.quantity))} itens`,
          }))}
          onClick={(product) => report("cmv", { product })}
          full
          vertical
          initialLimit={10}
          onViewAll={() => report("cmv", { dimension: "products" })}
        />
      </div>
      {!cmv.products.length ? (
        <Empty text="Nenhum item vendido encontrado para os filtros ativos." />
      ) : null}
    </div>
  );
}

function Manufacturing({
  data,
  report,
}: {
  data: DashboardExecutive;
  report: (k: string, e: Record<string, string>) => void;
}) {
  const manufacturing = data.manufacturing;
  return (
    <div className={styles.dashboard}>
      <div className={styles.kpis}>
        <Kpi
          label="Lucro fabricação própria"
          value={brl(manufacturing.metrics.profit)}
          detail="Lucro persistido dos itens FP"
          onClick={() => report("manufacturing", {})}
        />
        <Kpi
          label="Faturamento FP"
          value={brl(manufacturing.metrics.revenue)}
          onClick={() => report("manufacturing", {})}
        />
        <Kpi
          label="Custo total FP"
          value={brl(manufacturing.metrics.cost)}
          detail="Custo líquido calculado dos produtos FP"
          onClick={() => report("manufacturing", {})}
        />
        <Kpi
          label="Margem FP"
          value={`${manufacturing.metrics.margin}%`}
          onClick={() => report("manufacturing", {})}
        />
      </div>
      <div className={styles.grid}>
        <SectionDivider
          title="Resultado da fábrica"
          description="Somente itens vinculados aos grupos de Fabricação Própria sincronizados do Bling."
        />
        <Chart title="Evolução mensal do lucro FP" full>
          <ManufacturingEvolution
            data={manufacturing.periods}
            onClick={(month) =>
              report("manufacturing", { monthCompetence: month })
            }
          />
        </Chart>
        <Chart title="Lucro FP por origem" wide>
          <Horizontal
            data={manufacturing.origins}
            field="profit"
            onClick={(origin) => report("manufacturing", { origin })}
          />
        </Chart>
        <ValueRanking
          title="Lucro por grupo FP"
          data={manufacturing.groups.map((item) => ({
            name: item.label,
            value: item.profit,
            detail: `${num(item.invoices)} NF-e · ${brl(item.revenue)} faturados`,
          }))}
          onClick={(productGroup) => report("manufacturing", { productGroup })}
          wide
        />
        <ValueRanking
          title="Lucro por produto FP"
          data={manufacturing.products.map((item) => ({
            name: item.name,
            value: item.profit,
            detail: `${item.group} · margem ${item.margin}%`,
          }))}
          onClick={(product) => report("manufacturing", { product })}
          full
          vertical
          initialLimit={10}
          onViewAll={() => report("manufacturing", { dimension: "products" })}
        />
      </div>
      {!manufacturing.products.length ? (
        <Empty text="Nenhum produto de Fabricação Própria vendido no período filtrado." />
      ) : null}
    </div>
  );
}

function Cost({ data }: { data: DashboardExecutive }) {
  const goalPoints = data.goal.points.map((item) => ({
    ...item,
    cumulativeProfit: Number(item.cumulativeProfit),
    goalCost: Number(item.goalCost),
  }));
  return (
    <div className={styles.dashboard}>
      <div className={styles.kpis}>
        <Kpi label="Competência" value={data.goal.competence ?? "Sem meta"} />
        <Kpi label="Custo/meta mensal" value={brl(data.goal.cost)} />
        <Kpi
          label="Lucro acumulado"
          value={brl(data.goal.points.at(-1)?.cumulativeProfit ?? 0)}
        />
        <Kpi
          label="Atingimento"
          value={`${data.goal.points.at(-1)?.reached ?? "0.00"}%`}
        />
      </div>
      <Chart title="Custo × lucro mensal acumulado" full>
        <ResponsiveContainer width="100%" height={390}>
          <LineChart data={goalPoints}>
            <CartesianGrid stroke="#dfe7e3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} />
            <YAxis tickFormatter={compact} />
            <Tooltip formatter={tipMoney} />
            <Legend />
            <Line
              name="Lucro acumulado"
              dataKey="cumulativeProfit"
              type="monotone"
              stroke="#16845f"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls
              dot={{ r: 3, fill: "#16845f", strokeWidth: 0 }}
            />
            <Line
              name="Custo/meta"
              dataKey="goalCost"
              type="monotone"
              stroke="#d19124"
              strokeDasharray="7 5"
              strokeWidth={2}
              strokeLinecap="round"
              connectNulls
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Chart>
      {!data.goal.points.length ? (
        <Empty text="Nenhuma meta/custo configurada para a competência selecionada." />
      ) : null}
    </div>
  );
}
function MapTab({
  data,
  report,
}: {
  data: DashboardExecutive;
  report: (k: string, e: Record<string, string>) => void;
}) {
  const byState = new Map(data.states.map((x) => [x.state, x]));
  const max = Math.max(...data.states.map((x) => Number(x.revenue)), 1);
  const positive = data.states
    .map((item) => Number(item.revenue))
    .filter((value) => value > 0);
  const min = positive.length ? Math.min(...positive) : 0;
  const stateColor = (value: number) => {
    if (!value) return "#d5d9dc";
    const ratio = max === min ? 0.7 : (value - min) / (max - min);
    return `hsl(207 58% ${76 - ratio * 38}%)`;
  };
  return (
    <div className={styles.mapGrid}>
      <section className={styles.mapCard}>
        <header>
          <h2>Faturamento por UF</h2>
          <p>Clique em um estado para abrir o detalhamento filtrado.</p>
        </header>
        <div className={styles.brazilMap}>
          <svg
            viewBox={brazilMap.viewBox}
            role="img"
            aria-label="Mapa do faturamento por estado do Brasil"
          >
            {(
              brazilMap.locations as Array<{
                id: string;
                name: string;
                path: string;
              }>
            ).map((location) => {
              const uf = location.id.toUpperCase();
              const item = byState.get(uf);
              return (
                <path
                  key={uf}
                  d={location.path}
                  fill={stateColor(Number(item?.revenue ?? 0))}
                  role="button"
                  tabIndex={0}
                  aria-label={`${location.name}: ${brl(item?.revenue ?? 0)}, ${num(item?.invoices ?? 0)} vendas`}
                  onClick={() => report("state", { state: uf })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      report("state", { state: uf });
                  }}
                >
                  <title>
                    {location.name} · {brl(item?.revenue ?? 0)} ·{" "}
                    {num(item?.invoices ?? 0)} vendas
                  </title>
                </path>
              );
            })}
          </svg>
        </div>
        <div className={styles.mapLegend}>
          <span>Sem dados</span>
          <i />
          <i />
          <i />
          <i />
          <strong>Maior faturamento</strong>
        </div>
      </section>
      <section className={styles.stateList}>
        <h2>Estados</h2>
        {data.states.map((x) => (
          <button
            key={x.state}
            onClick={() => report("state", { state: x.state })}
          >
            <span>
              {x.state}
              <small>{num(x.invoices)} vendas</small>
            </span>
            <strong>{brl(x.revenue)}</strong>
            <ChevronRight />
          </button>
        ))}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  detail,
  onClick,
}: {
  label: string;
  value: string;
  detail?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.kpi}
      onClick={onClick}
      disabled={!onClick}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail ?? "Período filtrado"}</small>
    </button>
  );
}
function SectionDivider({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={styles.sectionDivider}>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
function Chart({
  title,
  children,
  wide,
  full,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  full?: boolean;
}) {
  return (
    <section
      className={`${styles.chart} ${wide ? styles.wide : ""} ${full ? styles.full : ""}`}
    >
      <header>
        <h2>{title}</h2>
        <small>Clique nos dados para detalhar</small>
      </header>
      {children}
    </section>
  );
}
function Horizontal({
  data,
  field,
  onClick,
}: {
  data: Array<{
    label: string;
    revenue?: string;
    profit?: string;
    cost?: string;
    averageTicket?: string;
    averageProfit?: string;
    invoices: number;
  }>;
  field:
    | "revenue"
    | "profit"
    | "cost"
    | "averageTicket"
    | "averageProfit"
    | "invoices";
  onClick: (x: string) => void;
}) {
  const chartData = data.slice(0, 12).map((item) => ({
    ...item,
    [field]: Number(item[field] ?? 0),
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(250, data.length * 34)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 12, right: 22 }}
      >
        <CartesianGrid stroke="#e6ece9" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={field === "invoices" ? compact : compact}
        />
        <YAxis
          dataKey="label"
          type="category"
          width={112}
          tick={{ fontSize: 11 }}
        />
        <Tooltip formatter={field === "invoices" ? tipNumber : tipMoney} />
        <Bar
          dataKey={field}
          fill="#16845f"
          radius={[0, 5, 5, 0]}
          cursor="pointer"
          onClick={(_, index) => onClick(data[index]?.label ?? "")}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
function Period({
  data,
  field,
  onClick,
}: {
  data: Array<{
    key: string;
    label: string;
    revenue?: string;
    cost?: string;
    profit?: string;
    invoices: number;
  }>;
  field: "revenue" | "cost" | "profit" | "invoices";
  onClick: (x: string) => void;
}) {
  const chartData = data.map((item) => ({
    ...item,
    [field]: Number(item[field] ?? 0),
  }));
  return (
    <ResponsiveContainer width="100%" height={290}>
      <BarChart data={chartData}>
        <CartesianGrid stroke="#e6ece9" vertical={false} />
        <XAxis dataKey="label" />
        <YAxis tickFormatter={compact} />
        <Tooltip formatter={field === "invoices" ? tipNumber : tipMoney} />
        <Bar
          dataKey={field}
          fill="#16845f"
          radius={[5, 5, 0, 0]}
          cursor="pointer"
          onClick={(_, index) => onClick(data[index]?.key ?? "")}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
function ManufacturingEvolution({
  data,
  onClick,
}: {
  data: DashboardExecutive["manufacturing"]["periods"];
  onClick: (month: string) => void;
}) {
  const chartData = data.map((item) => ({
    ...item,
    revenue: Number(item.revenue),
    cost: Number(item.cost),
    profit: Number(item.profit),
  }));
  return (
    <ResponsiveContainer width="100%" height={330}>
      <ComposedChart data={chartData}>
        <CartesianGrid stroke="#e6ece9" vertical={false} />
        <XAxis dataKey="label" />
        <YAxis tickFormatter={compact} />
        <Tooltip formatter={tipMoney} />
        <Legend />
        <Bar
          name="Lucro FP"
          dataKey="profit"
          fill="#83cdb4"
          radius={[5, 5, 0, 0]}
          cursor="pointer"
          onClick={(_, index) => onClick(data[index]?.key ?? "")}
        />
        <Line
          name="Faturamento FP"
          dataKey="revenue"
          type="monotone"
          stroke="#166f54"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls
          dot={{ r: 3, fill: "#166f54", strokeWidth: 0 }}
        />
        <Line
          name="Custo FP"
          dataKey="cost"
          type="monotone"
          stroke="#d19124"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls
          dot={{ r: 3, fill: "#d19124", strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ValueRanking({
  title,
  data,
  onClick,
  wide = false,
  full = false,
  vertical = false,
  initialLimit = 12,
  onViewAll,
}: {
  title: string;
  data: Array<{ name: string; value: string; detail: string }>;
  onClick: (name: string) => void;
  wide?: boolean;
  full?: boolean;
  vertical?: boolean;
  initialLimit?: number;
  onViewAll?: () => void;
}) {
  const visibleData = data.slice(0, initialLimit);
  return (
    <section
      className={`${styles.valueRanking} ${vertical ? styles.verticalRanking : ""} ${wide ? styles.wide : ""} ${full ? styles.full : ""}`}
    >
      <header>
        <h2>{title}</h2>
        <small>Clique para abrir as NF-e do recorte</small>
      </header>
      <div>
        {visibleData.map((item, index) => (
          <button
            type="button"
            key={`${item.name}-${index}`}
            onClick={() => onClick(item.name)}
          >
            <b>{index + 1}</b>
            <span>
              <strong title={item.name}>{item.name}</strong>
              <small>{item.detail}</small>
            </span>
            <em>{brl(item.value)}</em>
            <ChevronRight size={13} />
          </button>
        ))}
      </div>
      {onViewAll && data.length > initialLimit ? (
        <footer className={styles.rankingFooter}>
          <button type="button" onClick={onViewAll}>
            Ver todos os produtos ({num(data.length)})
            <ChevronRight size={14} />
          </button>
        </footer>
      ) : null}
    </section>
  );
}
function Daily({
  data,
  onClick,
}: {
  data: DashboardExecutive["daily"];
  onClick: (date: string) => void;
}) {
  const chartData = data.map((item) => ({
    ...item,
    revenue: Number(item.revenue),
    average: Number(item.average),
  }));
  return (
    <ResponsiveContainer width="100%" height={310}>
      <LineChart
        data={chartData}
        onClick={(state) => {
          if (state?.activeLabel) onClick(String(state.activeLabel));
        }}
      >
        <CartesianGrid stroke="#e6ece9" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} />
        <YAxis tickFormatter={compact} />
        <Tooltip formatter={tipMoney} />
        <Legend />
        <Line
          name="Faturamento diário"
          dataKey="revenue"
          type="monotone"
          stroke="#16845f"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls
          dot={{ r: 3, fill: "#16845f", strokeWidth: 0 }}
          activeDot={{ r: 6, cursor: "pointer" }}
          cursor="pointer"
        />
        <Line
          name="Média diária"
          dataKey="average"
          type="monotone"
          stroke="#d19124"
          strokeDasharray="6 5"
          strokeWidth={2}
          strokeLinecap="round"
          connectNulls
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
function ProfitDaily({
  data,
  onClick,
}: {
  data: DashboardExecutive["daily"];
  onClick: (date: string) => void;
}) {
  const chartData = data.map((item) => ({
    ...item,
    profit: Number(item.profit),
    cumulativeProfit: Number(item.cumulativeProfit),
  }));
  return (
    <ResponsiveContainer width="100%" height={310}>
      <ComposedChart
        data={chartData}
        onClick={(state) => {
          if (state?.activeLabel) onClick(String(state.activeLabel));
        }}
      >
        <CartesianGrid stroke="#e6ece9" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} />
        <YAxis tickFormatter={compact} />
        <Tooltip formatter={tipMoney} />
        <Legend />
        <Bar
          name="Lucro diário"
          dataKey="profit"
          fill="#8fd4bd"
          radius={[4, 4, 0, 0]}
          cursor="pointer"
        />
        <Line
          name="Lucro acumulado"
          dataKey="cumulativeProfit"
          type="monotone"
          stroke="#136b50"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls
          dot={{ r: 3, fill: "#136b50", strokeWidth: 0 }}
          activeDot={{ r: 6, cursor: "pointer" }}
          cursor="pointer"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
function Compare({ data }: { data: DashboardExecutive["periods"] }) {
  const chartData = data.map((item) => ({
    ...item,
    revenue: Number(item.revenue),
    cost: Number(item.cost),
  }));
  return (
    <ResponsiveContainer width="100%" height={290}>
      <LineChart data={chartData}>
        <CartesianGrid stroke="#e6ece9" vertical={false} />
        <XAxis dataKey="label" />
        <YAxis tickFormatter={compact} />
        <Tooltip formatter={tipMoney} />
        <Legend />
        <Line
          name="Faturamento"
          dataKey="revenue"
          type="monotone"
          stroke="#16845f"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls
          dot={{ r: 3, fill: "#16845f", strokeWidth: 0 }}
        />
        <Line
          name="Custo"
          dataKey="cost"
          type="monotone"
          stroke="#d19124"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls
          dot={{ r: 3, fill: "#d19124", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
function Ranking<
  T extends { name: string; revenue: string; profit: string; invoices: number },
>({
  title,
  data,
  field,
  onClick,
  wide = false,
}: {
  title: string;
  data: T[];
  field: "revenue" | "profit" | "invoices";
  onClick?: (name: string) => void;
  wide?: boolean;
}) {
  return (
    <section className={`${styles.ranking} ${wide ? styles.wide : ""}`}>
      <header>
        <h2>{title}</h2>
      </header>
      {data.slice(0, 10).map((x, i) => (
        <button
          type="button"
          key={`${x.name}-${i}`}
          onClick={() => onClick?.(x.name)}
        >
          <b>{i + 1}</b>
          <span title={x.name}>{x.name}</span>
          <strong>
            {field === "invoices" ? num(x.invoices) : brl(x[field])}
          </strong>
          {onClick ? <ChevronRight size={12} /> : null}
        </button>
      ))}
    </section>
  );
}
function Empty({
  text = "Nenhum dado encontrado para os filtros ativos.",
}: {
  text?: string;
}) {
  return <div className={styles.empty}>{text}</div>;
}
function Skeleton() {
  return (
    <div className={styles.skeleton}>
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}
const brl = (v: string | number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v),
  );
const num = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const compact = (v: number | string | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(v ?? 0));
const shortDate = (v: string | number) =>
  String(v).split("-").slice(1).reverse().join("/");
const formatMonth = (value: string) => value.split("-").reverse().join("/");
const formatCompetence = (value: string) =>
  /^\d{4}-\d{2}$/.test(value) ? formatMonth(value) : value;
const tipMoney = (v: unknown) => brl(String(v));
const tipNumber = (v: unknown) => num(Number(v));
