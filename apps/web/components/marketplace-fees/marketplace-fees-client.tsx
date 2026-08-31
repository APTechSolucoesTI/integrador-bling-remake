"use client";

import type {
  MarketplaceFeesResponse,
  MarketplaceFeeItemsResponse,
  SessionResponse,
} from "@integrador/contracts";
import {
  BadgeDollarSign,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  LoaderCircle,
  Menu,
  PackageSearch,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "../../lib/api";
import { homeRoute } from "../../lib/home-route";
import { downloadCsv } from "../../lib/csv";
import { ApplicationSidebar } from "../layout/application-sidebar";
import { ApplicationHeaderActions } from "../layout/application-header-actions";
import { ApplicationGlobalSearch } from "../layout/application-global-search";
import {
  blingProductUrl,
  InvoiceProductCell,
} from "../shared/invoice-items-detail";
import shell from "../nfe/nfe.module.css";
import styles from "./marketplace-fees.module.css";

interface Filters {
  invoiceNumber: string;
  origin: string;
  from: string;
  to: string;
}

const emptyFilters: Filters = {
  invoiceNumber: "",
  origin: "",
  from: "",
  to: "",
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function MarketplaceFeesClient() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [data, setData] = useState<MarketplaceFeesResponse | null>(null);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchingTenant, setSwitchingTenant] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<
    Record<number, MarketplaceFeeItemsResponse>
  >({});
  const [detailLoading, setDetailLoading] = useState<number | null>(null);
  const [detailError, setDetailError] = useState<Record<number, string>>({});

  const load = useCallback(
    async (filters: Filters, selectedPage: number) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(selectedPage),
        pageSize: "50",
      });
      if (filters.invoiceNumber)
        params.set("invoiceNumber", filters.invoiceNumber);
      if (filters.origin) params.set("origin", filters.origin);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      try {
        const response = await fetch(
          `${API_URL}/v1/marketplace-fees?${params}`,
          {
            credentials: "include",
          },
        );
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (response.status === 403) {
          setAccessDenied(true);
          return;
        }
        if (!response.ok) throw new Error("api");
        setAccessDenied(false);
        setData((await response.json()) as MarketplaceFeesResponse);
      } catch {
        setError(
          "Não foi possível carregar as taxas do Mercado Livre. Tente novamente.",
        );
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const response = await fetch(`${API_URL}/v1/auth/session`, {
          credentials: "include",
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("session");
        if (active) setSession((await response.json()) as SessionResponse);
      } catch {
        if (active) {
          setError("Não foi possível validar sua sessão.");
          setLoading(false);
        }
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (session) void load(applied, page);
  }, [applied, load, page, session]);

  const availableTenants = useMemo(
    () =>
      session?.availableTenants.filter((tenant) =>
        tenant.permissions.includes("marketplace-fees:view"),
      ) ?? [],
    [session],
  );

  async function logout() {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    router.replace("/login");
  }

  async function switchTenant(tenantId: string) {
    if (!session || tenantId === session.tenant.id || switchingTenant) return;
    setSwitchingTenant(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/v1/auth/tenant`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!response.ok) throw new Error("tenant");
      window.location.reload();
    } catch {
      setError("Não foi possível trocar a coligada.");
      setSwitchingTenant(false);
    }
  }

  function applyFilters() {
    setPage(1);
    setApplied({ ...draft });
  }

  async function toggleDetail(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (detailCache[id] || detailLoading === id) return;
    setDetailLoading(id);
    setDetailError((current) => ({ ...current, [id]: "" }));
    try {
      const response = await fetch(
        `${API_URL}/v1/marketplace-fees/${id}/items`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("detail");
      const detail = (await response.json()) as MarketplaceFeeItemsResponse;
      setDetailCache((current) => ({ ...current, [id]: detail }));
    } catch {
      setDetailError((current) => ({
        ...current,
        [id]: "Não foi possível carregar os itens desta NF-e.",
      }));
    } finally {
      setDetailLoading(null);
    }
  }

  function clearFilters() {
    setDraft(emptyFilters);
    setPage(1);
    setApplied(emptyFilters);
  }

  function exportCurrentPage() {
    if (!data?.items.length) return;
    downloadCsv(
      "taxas-mercado-livre.csv",
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
      data.items.map((item) => [
        item.invoiceNumber,
        item.company,
        item.origin,
        item.customer,
        item.issuedAt ? dateFormatter.format(new Date(item.issuedAt)) : "",
        item.value,
        item.commissionValue,
        `${item.commissionPercent}%`,
        item.freightValue,
        `${item.freightPercent}%`,
        item.discountValue,
      ]),
    );
  }

  if (!session && loading) {
    return (
      <main className={shell.statePage}>
        <LoaderCircle className={shell.spin} size={28} />
        <h1>Carregando taxas do Mercado Livre</h1>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={shell.statePage}>
        <BadgeDollarSign size={28} />
        <h1>Relatório indisponível</h1>
        <p>{error}</p>
        <Link href="/login">Voltar ao login</Link>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className={shell.statePage}>
        <BadgeDollarSign size={28} />
        <h1>Acesso não autorizado</h1>
        <p>Seu usuário não possui acesso ao módulo Taxas Mercado Livre.</p>
        <Link href={homeRoute(session)}>Voltar ao início</Link>
      </main>
    );
  }

  return (
    <main className={shell.shell}>
      <ApplicationSidebar session={session} open={menuOpen} onLogout={logout} />
      <section className={shell.workspace}>
        <header className={shell.topbar}>
          <button
            className={shell.mobileMenu}
            type="button"
            aria-label="Abrir navegação"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu size={20} />
          </button>
          <ApplicationGlobalSearch />
          <ApplicationHeaderActions session={session} onLogout={logout} />
        </header>

        <div className={shell.content}>
          <section className={shell.titleRow}>
            <div>
              <span className={shell.eyebrow}>MERCADO LIVRE · TAXAS</span>
              <h1>Taxas Mercado Livre</h1>
              <p>
                Comissão, frete e descontos por nota fiscal, com os mesmos
                indicadores do relatório operacional.
              </p>
            </div>
            <div className={styles.titleActions}>
              <button
                className={shell.refreshButton}
                type="button"
                disabled={!data?.items.length}
                onClick={exportCurrentPage}
              >
                <Download size={15} /> Exportar CSV
              </button>
              <button
                className={shell.refreshButton}
                type="button"
                disabled={loading}
                onClick={() => void load(applied, page)}
              >
                <RefreshCw className={loading ? shell.spin : ""} size={15} />
                Atualizar
              </button>
            </div>
          </section>

          <section className={shell.filters}>
            <div className={shell.filterHead}>
              <span>
                <Filter size={14} /> Filtros do relatório
              </span>
              <button type="button" onClick={clearFilters}>
                <X size={13} /> Limpar filtros
              </button>
            </div>
            <div className={styles.filterGrid}>
              <label className={shell.field}>
                <span>Número NF</span>
                <select
                  value={draft.invoiceNumber}
                  onChange={(event) =>
                    setDraft({ ...draft, invoiceNumber: event.target.value })
                  }
                >
                  <option value="">Todas as notas</option>
                  {data?.filters.invoiceNumbers.map((number) => (
                    <option key={number} value={number}>
                      {number}
                    </option>
                  ))}
                </select>
              </label>
              <label className={shell.field}>
                <span>Coligada</span>
                <select
                  value={session.tenant.id}
                  disabled={switchingTenant}
                  onChange={(event) => void switchTenant(event.target.value)}
                >
                  {availableTenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={shell.field}>
                <span>Origem</span>
                <select
                  value={draft.origin}
                  onChange={(event) =>
                    setDraft({ ...draft, origin: event.target.value })
                  }
                >
                  <option value="">Todas as origens</option>
                  {data?.filters.origins.map((origin) => (
                    <option key={origin} value={origin}>
                      {origin}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className={styles.dateRange}>
                <legend>
                  <CalendarRange size={13} /> Data de emissão
                </legend>
                <input
                  aria-label="Data inicial"
                  type="date"
                  value={draft.from}
                  onChange={(event) =>
                    setDraft({ ...draft, from: event.target.value })
                  }
                />
                <span>até</span>
                <input
                  aria-label="Data final"
                  type="date"
                  value={draft.to}
                  onChange={(event) =>
                    setDraft({ ...draft, to: event.target.value })
                  }
                />
              </fieldset>
              <button
                className={shell.applyButton}
                type="button"
                onClick={applyFilters}
              >
                <Search size={14} /> Aplicar filtros
              </button>
            </div>
          </section>

          {error ? <div className={shell.error}>{error}</div> : null}

          <section className={shell.tablePanel}>
            <div className={shell.tableHead}>
              <div>
                <strong>Relatório Taxas ML</strong>
                <span>
                  {data?.pagination.total ?? 0} registros encontrados na
                  coligada
                </span>
              </div>
              <span className={styles.reportBadge}>VALORES POR NF-E</span>
            </div>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th className={styles.expandCell}>
                      <span className={styles.srOnly}>Detalhes</span>
                    </th>
                    <th>Número NF</th>
                    <th>Coligada</th>
                    <th>Origem</th>
                    <th>Cliente</th>
                    <th>Data Emissão</th>
                    <th className={styles.numeric}>Valor</th>
                    <th className={styles.numeric}>Valor Comissão</th>
                    <th className={styles.numeric}>Percentual Comissão</th>
                    <th className={styles.numeric}>Valor Frete</th>
                    <th className={styles.numeric}>Percentual Frete</th>
                    <th className={styles.numeric}>Valor Desconto</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !data ? (
                    <tr>
                      <td className={styles.tableState} colSpan={12}>
                        <LoaderCircle className={shell.spin} size={20} />
                        Consultando taxas...
                      </td>
                    </tr>
                  ) : null}
                  {!loading && data?.items.length === 0 ? (
                    <tr>
                      <td className={styles.tableState} colSpan={12}>
                        <BadgeDollarSign size={22} />
                        Nenhuma NF-e do Mercado Livre encontrada para estes
                        filtros.
                      </td>
                    </tr>
                  ) : null}
                  {data?.items.map((item) => (
                    <Fragment key={item.id}>
                      <tr>
                        <td className={styles.expandCell}>
                          <button
                            type="button"
                            className={styles.expandButton}
                            aria-expanded={expandedId === item.id}
                            aria-label={`${expandedId === item.id ? "Fechar" : "Abrir"} itens da NF-e ${item.invoiceNumber}`}
                            onClick={() => void toggleDetail(item.id)}
                          >
                            {expandedId === item.id ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </button>
                        </td>
                        <td>
                          <strong className={styles.invoiceNumber}>
                            {item.invoiceNumber}
                          </strong>
                        </td>
                        <td>{item.company}</td>
                        <td>
                          <span className={styles.origin}>{item.origin}</span>
                        </td>
                        <td className={styles.customer}>{item.customer}</td>
                        <td>
                          {item.issuedAt
                            ? dateFormatter.format(new Date(item.issuedAt))
                            : "—"}
                        </td>
                        <td className={styles.numeric}>{money(item.value)}</td>
                        <td className={styles.numericStrong}>
                          {money(item.commissionValue)}
                        </td>
                        <td className={styles.numeric}>
                          {percent(item.commissionPercent)}
                        </td>
                        <td className={styles.numericStrong}>
                          {money(item.freightValue)}
                        </td>
                        <td className={styles.numeric}>
                          {percent(item.freightPercent)}
                        </td>
                        <td className={styles.numeric}>
                          {money(item.discountValue)}
                        </td>
                      </tr>
                      {expandedId === item.id ? (
                        <>
                          {detailLoading === item.id ? (
                            <tr className={styles.detailRow}>
                              <td colSpan={12}>
                                <div className={styles.detailState}>
                                  <LoaderCircle
                                    className={shell.spin}
                                    size={18}
                                  />{" "}
                                  Carregando itens...
                                </div>
                              </td>
                            </tr>
                          ) : null}
                          {detailError[item.id] ? (
                            <tr className={styles.detailRow}>
                              <td colSpan={12}>
                                <div className={styles.detailError}>
                                  {detailError[item.id]}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                          {detailCache[item.id]?.items.map((detailItem) => (
                            <tr
                              key={`detail-${detailItem.id}`}
                              className={styles.itemDetailRow}
                            >
                              <td className={styles.itemBling}>
                                {detailItem.productId ? (
                                  <a
                                    href={blingProductUrl(detailItem.productId)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Abrir produto no Bling"
                                    aria-label={`Abrir ${detailItem.description} no Bling`}
                                  >
                                    <PackageSearch size={15} />
                                  </a>
                                ) : null}
                              </td>
                              <td colSpan={4} className={styles.itemProduct}>
                                <InvoiceProductCell
                                  name={detailItem.description}
                                  code={detailItem.code ?? detailItem.productId}
                                  productId={null}
                                />
                              </td>
                              <td>
                                <small>Qtd.</small>
                                <strong>
                                  {Number(detailItem.quantity).toLocaleString(
                                    "pt-BR",
                                  )}
                                </strong>
                              </td>
                              <td className={styles.numeric}>
                                <small>Valor do item</small>
                                <strong>{money(detailItem.itemValue)}</strong>
                              </td>
                              <td className={styles.numericStrong}>
                                <small>Comissão R$</small>
                                <strong>
                                  {money(detailItem.commissionValue)}
                                </strong>
                              </td>
                              <td className={styles.numeric}>
                                <small>Comissão %</small>
                                <strong>
                                  {percent(detailItem.commissionPercent)}
                                </strong>
                              </td>
                              <td className={styles.numericStrong}>
                                <small>Frete R$</small>
                                <strong>
                                  {money(detailItem.freightValue)}
                                </strong>
                              </td>
                              <td className={styles.numeric}>
                                <small>Frete %</small>
                                <strong>
                                  {percent(detailItem.freightPercent)}
                                </strong>
                              </td>
                              <td aria-hidden="true" />
                            </tr>
                          ))}
                        </>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className={styles.pagination}>
              <span>
                Página {data?.pagination.page ?? 1} de{" "}
                {data?.pagination.pages || 1}
              </span>
              <div>
                <button
                  type="button"
                  aria-label="Página anterior"
                  disabled={!data || data.pagination.page <= 1 || loading}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Próxima página"
                  disabled={
                    !data ||
                    data.pagination.page >= data.pagination.pages ||
                    loading
                  }
                  onClick={() => setPage((current) => current + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          </section>
        </div>
      </section>
    </main>
  );
}

function money(value: string) {
  return moneyFormatter.format(Number(value));
}

function percent(value: string) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
    Number(value),
  )}%`;
}
