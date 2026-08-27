"use client";

import type {
  DashboardExecutive,
  DashboardInvoiceReport,
  SessionResponse,
} from "@integrador/contracts";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  LoaderCircle,
  Menu,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import { downloadExcel, downloadXlsx } from "../../lib/csv";
import { ApplicationSidebar } from "../layout/application-sidebar";
import { ApplicationHeaderActions } from "../layout/application-header-actions";
import { ApplicationGlobalSearch } from "../layout/application-global-search";
import styles from "./dashboard.module.css";

export function DashboardReportClient({ kind }: { kind: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [report, setReport] = useState<DashboardInvoiceReport | null>(null);
  const [productDashboard, setProductDashboard] =
    useState<DashboardExecutive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const query = search.toString();
  const cmvReport = kind === "cmv";
  const manufacturingReport = kind === "manufacturing";
  const productAnalysis =
    search.get("dimension") === "products" &&
    (cmvReport || manufacturingReport);
  const profitReport =
    kind === "profit" ||
    kind === "products" ||
    cmvReport ||
    manufacturingReport;

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(query);
    const endpoint = productAnalysis ? "executive" : "invoices";
    if (productAnalysis) {
      params.delete("dimension");
      params.delete("q");
      params.delete("page");
      params.delete("pageSize");
      params.delete("view");
      params.delete("from");
      params.delete("to");
    } else {
      params.set("pageSize", "50");
    }
    Promise.all([
      fetch(`${API_URL}/v1/auth/session`, { credentials: "include" }),
      fetch(`${API_URL}/v1/dashboard/${endpoint}?${params}`, {
        credentials: "include",
      }),
    ])
      .then(async ([sessionResponse, reportResponse]) => {
        if (sessionResponse.status === 401) return router.replace("/login");
        if (!sessionResponse.ok || !reportResponse.ok) throw new Error("api");
        if (active) {
          setSession((await sessionResponse.json()) as SessionResponse);
          if (productAnalysis) {
            setProductDashboard(
              (await reportResponse.json()) as DashboardExecutive,
            );
            setReport(null);
          } else {
            setReport((await reportResponse.json()) as DashboardInvoiceReport);
            setProductDashboard(null);
          }
        }
      })
      .catch(
        () =>
          active &&
          setError(
            productAnalysis
              ? "Não foi possível carregar a análise por produtos."
              : "Não foi possível carregar as NF-e deste detalhamento.",
          ),
      );
    return () => {
      active = false;
    };
  }, [productAnalysis, query, router]);

  const setPage = (page: number) => {
    const params = new URLSearchParams(query);
    params.set("page", String(page));
    router.replace(`/app/reports/${kind}?${params}`);
  };
  async function logout() {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.replace("/login");
  }
  if (!session)
    return (
      <main className={styles.state}>
        <LoaderCircle className={styles.spin} />
        <h1>{error ?? "Carregando NF-e"}</h1>
      </main>
    );

  if (productAnalysis) {
    return (
      <ProductAnalysisReport
        kind={kind}
        session={session}
        dashboard={productDashboard}
        search={search}
        error={error}
        menu={menu}
        onMenu={() => setMenu(!menu)}
        onLogout={logout}
        onNavigate={(params) =>
          router.replace(`/app/reports/${kind}?${params}`)
        }
        onOpenInvoices={(product) => {
          const params = new URLSearchParams(query);
          params.delete("dimension");
          params.delete("q");
          params.delete("page");
          params.set("product", product);
          router.push(`/app/reports/${kind}?${params}`);
        }}
      />
    );
  }

  const title = reportTitle(kind, search);
  const items = report?.items ?? [];
  const dashboardHref = `/app/dashboard?${dashboardQuery(search, kind)}`;
  const invoiceDetailHref = (id: number) => {
    const detailPath = profitReport
      ? `/app/finance/nfe/${id}`
      : `/app/nfe/${id}`;
    return `${detailPath}?returnTo=${encodeURIComponent(dashboardHref)}`;
  };
  return (
    <main className={styles.shell}>
      <ApplicationSidebar session={session} open={menu} onLogout={logout} />
      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <button className={styles.mobileMenu} onClick={() => setMenu(!menu)}>
            <Menu />
          </button>
          <ApplicationGlobalSearch />
          <ApplicationHeaderActions session={session} onLogout={logout} />
        </header>
        <div className={styles.content}>
          <div className={styles.reportHeading}>
            <div>
              <Link href={`/app/dashboard?${dashboardQuery(search, kind)}`}>
                <ArrowLeft size={14} /> Voltar ao dashboard
              </Link>
              <span>DRILL-DOWN · NOTAS FISCAIS</span>
              <h1>{title}</h1>
              <p>
                Uma linha por NF-e. Clique na nota para abrir todos os itens e
                cálculos.
              </p>
            </div>
            <button
              disabled={!items.length}
              onClick={() =>
                downloadXlsx(
                  "nfe-dashboard",
                  csvHeaders(kind),
                  items.map((item) => csvRow(item, kind)),
                )
              }
            >
              <Download size={15} /> Exportar Excel
            </button>
          </div>
          <div className={styles.activeFilters}>
            {filterChips(search, session.tenant.name).map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          {error ? <div className={styles.error}>{error}</div> : null}
          <section className={styles.tableCard}>
            <header>
              <div>
                <h2>Notas fiscais encontradas</h2>
                <p>
                  {report?.pagination.total ?? 0} NF-e no recorte selecionado.
                </p>
              </div>
              <FileSearch size={20} />
            </header>
            <div className={styles.tableWrap}>
              <table className={styles.invoiceTable}>
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Coligada</th>
                    <th>Cliente</th>
                    <th>Data de emissão</th>
                    <th>Origem</th>
                    <th>UF</th>
                    {cmvReport ? (
                      <>
                        <th>Valor da NF-e</th>
                        <th>Itens vendidos</th>
                        <th>CMV</th>
                      </>
                    ) : manufacturingReport ? (
                      <>
                        <th>Faturamento FP</th>
                        <th>Custo FP</th>
                        <th>Lucro FP</th>
                        <th>Margem FP</th>
                      </>
                    ) : profitReport ? (
                      <>
                        <th>Valor</th>
                        <th>Venda líquida</th>
                        <th>Impostos</th>
                        <th>Taxas</th>
                        <th>Frete</th>
                        <th>Outras despesas</th>
                        <th>Custo líquido</th>
                        <th>Lucro</th>
                        <th>Margem</th>
                      </>
                    ) : (
                      <th>Valor</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push(invoiceDetailHref(item.id))}
                    >
                      <td>
                        <Link href={invoiceDetailHref(item.id)}>
                          {item.number}
                        </Link>
                      </td>
                      <td>{item.company}</td>
                      <td className={styles.customerCell}>{item.customer}</td>
                      <td>{formatDate(item.issuedAt)}</td>
                      <td>{item.origin}</td>
                      <td>{item.state ?? "—"}</td>
                      {cmvReport ? (
                        <>
                          <td>{money(item.revenue)}</td>
                          <td>{number(item.quantity)}</td>
                          <td className={styles.positive}>{money(item.cmv)}</td>
                        </>
                      ) : manufacturingReport ? (
                        <>
                          <td>{money(item.manufacturingRevenue)}</td>
                          <td>{money(item.manufacturingCost)}</td>
                          <td
                            className={
                              Number(item.manufacturingProfit) < 0
                                ? styles.negative
                                : styles.positive
                            }
                          >
                            {money(item.manufacturingProfit)}
                          </td>
                          <td>{item.manufacturingMargin}%</td>
                        </>
                      ) : profitReport ? (
                        <>
                          <td>{money(item.revenue)}</td>
                          <td>{money(item.netRevenue)}</td>
                          <td>{money(item.tax)}</td>
                          <td>{money(item.fees)}</td>
                          <td>{money(item.freight)}</td>
                          <td>{money(item.otherExpenses)}</td>
                          <td>{money(item.cost)}</td>
                          <td
                            className={
                              Number(item.profit) < 0
                                ? styles.negative
                                : styles.positive
                            }
                          >
                            {money(item.profit)}
                          </td>
                          <td>{item.margin}%</td>
                        </>
                      ) : (
                        <td>{money(item.revenue)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {report && !items.length ? (
                <div className={styles.empty}>
                  Nenhuma NF-e encontrada para os filtros recebidos.
                </div>
              ) : null}
            </div>
            {report && report.pagination.pages > 1 ? (
              <footer className={styles.pagination}>
                <button
                  disabled={report.pagination.page === 1}
                  onClick={() => setPage(report.pagination.page - 1)}
                >
                  <ChevronLeft /> Anterior
                </button>
                <span>
                  Página {report.pagination.page} de {report.pagination.pages}
                </span>
                <button
                  disabled={report.pagination.page === report.pagination.pages}
                  onClick={() => setPage(report.pagination.page + 1)}
                >
                  Próxima <ChevronRight />
                </button>
              </footer>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}

function ProductAnalysisReport({
  kind,
  session,
  dashboard,
  search,
  error,
  menu,
  onMenu,
  onLogout,
  onNavigate,
  onOpenInvoices,
}: {
  kind: "cmv" | "manufacturing";
  session: SessionResponse;
  dashboard: DashboardExecutive | null;
  search: ReturnType<typeof useSearchParams>;
  error: string | null;
  menu: boolean;
  onMenu: () => void;
  onLogout: () => Promise<void>;
  onNavigate: (params: URLSearchParams) => void;
  onOpenInvoices: (product: string) => void;
}) {
  const manufacturing = kind === "manufacturing";
  const query = (search.get("q") ?? "").trim().toLocaleLowerCase("pt-BR");
  const rows = (
    manufacturing
      ? (dashboard?.manufacturing.products ?? []).map((item) => ({
          ...item,
          revenue: item.revenue,
          totalCost: item.cost,
          profit: item.profit,
          margin: item.margin,
        }))
      : (dashboard?.cmv.products ?? []).map((item) => ({
          ...item,
          grossCost: item.cost,
          totalCost: item.totalCost,
          credits: "0.00",
          profit: "0.00",
          margin: "0.00",
        }))
  ).filter((item) =>
    `${item.code} ${item.name} ${item.group}`
      .toLocaleLowerCase("pt-BR")
      .includes(query),
  );
  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const requestedPage = Number(search.get("page") ?? "1");
  const page = Math.min(
    pages,
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  );
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const navigate = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams(search.toString());
    Object.entries(changes).forEach(([key, value]) =>
      value ? params.set(key, value) : params.delete(key),
    );
    onNavigate(params);
  };
  const headers = manufacturing
    ? [
        "Código",
        "Produto",
        "Competência",
        "Quantidade",
        "Faturamento FP",
        "Custo unitário bruto",
        "Custo total bruto",
        "Créditos fiscais",
        "Custo líquido",
        "Lucro FP",
        "Margem FP (%)",
      ]
    : [
        "Código",
        "Produto",
        "Competência",
        "Quantidade",
        "Faturamento",
        "Custo total",
        "Custo unitário",
        "CMV bruto",
        "CMV / faturamento (%)",
      ];
  const exportRows = rows.map((item) =>
    manufacturing
      ? [
          item.code,
          item.name,
          formatMonth(item.competence),
          Number(item.quantity),
          Number(item.revenue),
          Number(item.quantity)
            ? Number(item.grossCost) / Number(item.quantity)
            : 0,
          Number(item.grossCost),
          Number(item.credits),
          Number(item.cost),
          Number(item.profit),
          Number(item.margin),
        ]
      : [
          item.code,
          item.name,
          formatMonth(item.competence),
          Number(item.quantity),
          Number(item.revenue),
          Number(item.totalCost),
          Number(item.quantity)
            ? Number(item.totalCost) / Number(item.quantity)
            : 0,
          Number(item.cost),
          Number(item.revenue)
            ? (Number(item.cost) / Number(item.revenue)) * 100
            : 0,
        ],
  );
  return (
    <main className={styles.shell}>
      <ApplicationSidebar session={session} open={menu} onLogout={onLogout} />
      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <button className={styles.mobileMenu} onClick={onMenu}>
            <Menu />
          </button>
          <ApplicationGlobalSearch />
          <ApplicationHeaderActions session={session} onLogout={onLogout} />
        </header>
        <div className={styles.content}>
          <div className={styles.reportHeading}>
            <div>
              <Link href={`/app/dashboard?${dashboardQuery(search, kind)}`}>
                <ArrowLeft size={14} /> Voltar ao dashboard
              </Link>
              <span>DRILL-DOWN · PRODUTOS</span>
              <h1>
                {manufacturing
                  ? "Análise de produtos de Fabricação Própria"
                  : "Análise de CMV por produto"}
              </h1>
              <p>
                Visão consolidada por produto. Clique em uma linha para abrir as
                NF-e que formam o resultado.
              </p>
            </div>
            <button
              disabled={!rows.length}
              onClick={() =>
                downloadExcel(
                  manufacturing ? "produtos-fp" : "produtos-cmv",
                  manufacturing ? "Fabricação Própria" : "CMV por produto",
                  headers,
                  exportRows,
                )
              }
            >
              <Download size={15} /> Exportar para Excel
            </button>
          </div>
          <div className={styles.activeFilters}>
            {filterChips(search, session.tenant.name, true).map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          <section className={styles.productAuditFilters}>
            <header>
              <div>
                <strong>Filtros da auditoria</strong>
                <span>
                  Uma linha por produto e competência fiscal selecionada.
                </span>
              </div>
              <b>{number(String(rows.length))} PRODUTOS</b>
            </header>
            <div>
              <AuditSelect
                label="Competência"
                value={search.get("monthCompetence") ?? ""}
                empty="Todas as competências"
                options={dashboard?.filters.months ?? []}
                format={formatMonth}
                onChange={(value) =>
                  navigate({
                    monthCompetence: value || undefined,
                    page: undefined,
                  })
                }
              />
              <AuditSelect
                label="Produto"
                value={search.get("product") ?? ""}
                empty="Todos os produtos"
                options={dashboard?.filters.products ?? []}
                onChange={(value) =>
                  navigate({ product: value || undefined, page: undefined })
                }
              />
              <AuditSelect
                label="Código"
                value={search.get("productCode") ?? ""}
                empty="Todos os códigos"
                options={dashboard?.filters.productCodes ?? []}
                onChange={(value) =>
                  navigate({ productCode: value || undefined, page: undefined })
                }
              />
              <AuditSelect
                label="Grupo"
                value={search.get("productGroup") ?? ""}
                empty="Todos os grupos"
                options={dashboard?.filters.productGroups ?? []}
                onChange={(value) =>
                  navigate({
                    productGroup: value || undefined,
                    page: undefined,
                  })
                }
              />
              <label className={styles.auditSearch}>
                <span>Busca rápida</span>
                <div>
                  <Search size={15} />
                  <input
                    type="search"
                    value={search.get("q") ?? ""}
                    placeholder="Nome, código ou grupo"
                    onChange={(event) =>
                      navigate({
                        q: event.target.value || undefined,
                        page: undefined,
                      })
                    }
                  />
                </div>
              </label>
            </div>
          </section>
          <div className={styles.auditDefinition}>
            <strong>Regra de CMV</strong>
            <span>
              CMV bruto = custo cadastrado do produto × quantidade vendida.
              Créditos de ICMS, IPI e demais créditos não reduzem o CMV.
            </span>
          </div>
          {error ? <div className={styles.error}>{error}</div> : null}
          <section className={styles.tableCard}>
            <header>
              <div>
                <h2>Produtos consolidados</h2>
                <p>Valores calculados com os mesmos filtros do dashboard.</p>
              </div>
              <FileSearch size={20} />
            </header>
            <div className={styles.tableWrap}>
              <table className={styles.productAnalysisTable}>
                <thead>
                  <tr>
                    {headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((item) => (
                    <tr
                      key={`${item.competence}-${item.code}-${item.name}`}
                      onClick={() => onOpenInvoices(item.name)}
                    >
                      <td>{item.code}</td>
                      <td className={styles.customerCell}>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{formatMonth(item.competence)}</td>
                      <td>{number(item.quantity)}</td>
                      {manufacturing ? (
                        <>
                          <td>{money(item.revenue ?? "0")}</td>
                          <td>
                            {money(
                              String(
                                Number(item.quantity)
                                  ? Number(item.grossCost) /
                                      Number(item.quantity)
                                  : 0,
                              ),
                            )}
                          </td>
                          <td>{money(item.grossCost)}</td>
                          <td className={styles.creditValue}>
                            {money(item.credits)}
                          </td>
                          <td>{money(item.cost)}</td>
                          <td
                            className={
                              Number(item.profit) < 0
                                ? styles.negative
                                : styles.positive
                            }
                          >
                            {money(item.profit ?? "0")}
                          </td>
                          <td>{item.margin}%</td>
                        </>
                      ) : (
                        <>
                          <td>{money(item.revenue)}</td>
                          <td>{money(item.totalCost)}</td>
                          <td>
                            {money(
                              String(
                                Number(item.quantity)
                                  ? Number(item.totalCost) /
                                      Number(item.quantity)
                                  : 0,
                              ),
                            )}
                          </td>
                          <td className={styles.positive}>
                            {money(item.cost)}
                          </td>
                          <td>
                            {Number(item.revenue)
                              ? `${((Number(item.cost) / Number(item.revenue)) * 100).toFixed(2)}%`
                              : "0,00%"}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {dashboard && !visibleRows.length ? (
                <div className={styles.empty}>
                  Nenhum produto encontrado para os filtros informados.
                </div>
              ) : null}
            </div>
            {rows.length > pageSize ? (
              <footer className={styles.pagination}>
                <button
                  disabled={page === 1}
                  onClick={() => navigate({ page: String(page - 1) })}
                >
                  <ChevronLeft /> Anterior
                </button>
                <span>
                  Página {page} de {pages}
                </span>
                <button
                  disabled={page === pages}
                  onClick={() => navigate({ page: String(page + 1) })}
                >
                  Próxima <ChevronRight />
                </button>
              </footer>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}

function AuditSelect({
  label,
  value,
  empty,
  options,
  format = (option) => option,
  onChange,
}: {
  label: string;
  value: string;
  empty: string;
  options: string[];
  format?: (option: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{empty}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {format(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function reportTitle(kind: string, search: ReturnType<typeof useSearchParams>) {
  const suffix =
    search.get("origin") ??
    search.get("state") ??
    search.get("product") ??
    search.get("productGroup") ??
    search.get("customer");
  const base =
    kind === "cmv"
      ? "CMV por NF-e"
      : kind === "manufacturing"
        ? "Resultado de fabricação própria por NF-e"
        : kind === "profit" || kind === "products"
          ? "Composição de lucro por NF-e"
          : kind === "state"
            ? "Faturamento por estado"
            : "Faturamento por NF-e";
  return suffix ? `${base} · ${suffix}` : base;
}
function dashboardQuery(
  search: ReturnType<typeof useSearchParams>,
  kind: string,
) {
  const params = new URLSearchParams(search.toString());
  params.delete("page");
  params.delete("view");
  params.delete("state");
  params.delete("customer");
  params.delete("dimension");
  params.delete("q");
  params.set(
    "tab",
    kind === "cmv"
      ? "cmv"
      : kind === "manufacturing"
        ? "manufacturing"
        : kind === "profit"
          ? "profit"
          : kind === "products"
            ? "products"
            : kind === "state"
              ? "map"
              : "revenue",
  );
  return params.toString();
}
function filterChips(
  search: ReturnType<typeof useSearchParams>,
  company: string,
  excludeEmission = false,
) {
  const chips = [`Empresa: ${company}`];
  const labels: Record<string, string> = {
    origin: "Origem",
    monthCompetence: "Mês",
    from: "De",
    to: "Até",
    state: "UF",
    product: "Produto",
    productCode: "Código",
    productGroup: "Grupo",
    customer: "Cliente",
  };
  for (const [key, label] of Object.entries(labels)) {
    if (excludeEmission && (key === "from" || key === "to")) continue;
    const value = search.get(key);
    if (value)
      chips.push(
        `${label}: ${key === "monthCompetence" ? formatMonth(value) : value}`,
      );
  }
  return chips;
}
function csvHeaders(kind: string) {
  const common = [
    "Número",
    "Coligada",
    "Cliente",
    "Data de emissão",
    "Origem",
    "UF",
    "Valor",
  ];
  if (kind === "cmv") return [...common, "Itens vendidos", "CMV"];
  if (kind === "manufacturing")
    return [
      ...common.slice(0, -1),
      "Faturamento FP",
      "Custo FP",
      "Lucro FP",
      "Margem FP",
    ];
  return kind === "profit" || kind === "products"
    ? [
        ...common,
        "Venda líquida",
        "Impostos",
        "Taxas",
        "Frete",
        "Outras despesas",
        "Custo líquido",
        "Lucro",
        "Margem",
      ]
    : common;
}
function csvRow(item: DashboardInvoiceReport["items"][number], kind: string) {
  const common = [
    item.number,
    item.company,
    item.customer,
    item.issuedAt,
    item.origin,
    item.state,
    item.revenue,
  ];
  if (kind === "cmv") return [...common, item.quantity, item.cmv];
  if (kind === "manufacturing")
    return [
      ...common.slice(0, -1),
      item.manufacturingRevenue,
      item.manufacturingCost,
      item.manufacturingProfit,
      item.manufacturingMargin,
    ];
  return kind === "profit" || kind === "products"
    ? [
        ...common,
        item.netRevenue,
        item.tax,
        item.fees,
        item.freight,
        item.otherExpenses,
        item.cost,
        item.profit,
        item.margin,
      ]
    : common;
}
const money = (value: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value),
  );
const number = (value: string) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    Number(value),
  );
const formatDate = (value: string | null) =>
  value ? value.split("-").reverse().join("/") : "—";
const formatMonth = (value: string) => value.split("-").reverse().join("/");
