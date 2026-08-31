"use client";

import type {
  NfeBulkActionResponse,
  NfeDetailResponse,
  InvoiceFilterOptionsResponse,
  ProfitabilityResponse,
  SessionResponse,
} from "@integrador/contracts";
import {
  Boxes,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Gauge,
  Goal,
  LoaderCircle,
  LogOut,
  Menu,
  Orbit,
  PackageSearch,
  Percent,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import { ApplicationSidebar } from "../layout/application-sidebar";
import { ApplicationHeaderActions } from "../layout/application-header-actions";
import { ApplicationGlobalSearch } from "../layout/application-global-search";
import { downloadXlsx } from "../../lib/csv";
import {
  clearListNavigationState,
  consumeListNavigationState,
  saveListNavigationState,
} from "../../lib/list-navigation-state";
import { blingProductUrl } from "../shared/invoice-items-detail";
import shell from "../nfe/nfe.module.css";
import styles from "./finance.module.css";

interface FinanceFilters {
  numero: string;
  nome: string;
  tipoVenda: string;
  dataInicial: string;
  dataFinal: string;
  calculo: string;
  somentePrejuizo: boolean;
}

interface FinanceNavigationState {
  draft: FinanceFilters;
  applied: FinanceFilters;
  page: number;
}

function currentPeriod(): FinanceFilters {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    numero: "",
    nome: "",
    tipoVenda: "",
    dataInicial: `${year}-${month}-01`,
    dataFinal: `${year}-${month}-${day}`,
    calculo: "",
    somentePrejuizo: false,
  };
}

export function FinanceClient() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [data, setData] = useState<ProfitabilityResponse | null>(null);
  const [filterOptions, setFilterOptions] =
    useState<InvoiceFilterOptionsResponse>({
      customers: [],
      salesChannels: [],
    });
  const [draft, setDraft] = useState<FinanceFilters>(currentPeriod);
  const [applied, setApplied] = useState<FinanceFilters>(currentPeriod);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [navigationReady, setNavigationReady] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<
    Record<number, NfeDetailResponse>
  >({});
  const [detailLoading, setDetailLoading] = useState<number | null>(null);
  const [detailError, setDetailError] = useState<Record<number, string>>({});

  const load = useCallback(
    async (filters: FinanceFilters, selectedPage: number) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(selectedPage),
        pageSize: "50",
        dataInicial: filters.dataInicial,
        dataFinal: filters.dataFinal,
      });
      if (filters.numero) params.set("numero", filters.numero);
      if (filters.nome) params.set("nome", filters.nome);
      if (filters.tipoVenda) params.set("tipoVenda", filters.tipoVenda);
      if (filters.calculo) params.set("calculo", filters.calculo);
      if (filters.somentePrejuizo) params.set("somentePrejuizo", "true");

      try {
        const [sessionResponse, financeResponse] = await Promise.all([
          fetch(`${API_URL}/v1/auth/session`, { credentials: "include" }),
          fetch(`${API_URL}/v1/finance/profitability?${params}`, {
            credentials: "include",
          }),
        ]);
        if (sessionResponse.status === 401 || financeResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (!sessionResponse.ok || !financeResponse.ok) throw new Error("api");
        setSession((await sessionResponse.json()) as SessionResponse);
        setData((await financeResponse.json()) as ProfitabilityResponse);
      } catch {
        setError("Não foi possível carregar a rentabilidade desta empresa.");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const restored =
      consumeListNavigationState<FinanceNavigationState>("finance");
    if (restored) {
      setDraft(restored.draft);
      setApplied(restored.applied);
      setPage(restored.page);
    }
    setNavigationReady(true);
  }, []);

  useEffect(() => {
    if (navigationReady) void load(applied, page);
  }, [applied, load, navigationReady, page, refreshKey]);

  useEffect(() => {
    let active = true;
    async function loadFilterOptions() {
      try {
        const response = await fetch(`${API_URL}/v1/finance/filter-options`, {
          credentials: "include",
        });
        if (response.ok && active) {
          setFilterOptions(
            (await response.json()) as InvoiceFilterOptionsResponse,
          );
        }
      } catch {
        // A listagem financeira continua utilizável mesmo sem opções auxiliares.
      }
    }
    void loadFilterOptions();
    return () => {
      active = false;
    };
  }, []);

  function applyFilters() {
    setPage(1);
    setApplied({ ...draft });
  }

  function clearFilters() {
    clearListNavigationState("finance");
    const period = currentPeriod();
    setDraft(period);
    setPage(1);
    setApplied(period);
  }

  function preserveNavigation() {
    saveListNavigationState<FinanceNavigationState>("finance", {
      draft,
      applied,
      page,
    });
  }

  function openDetail(id: number) {
    preserveNavigation();
    router.push(
      `/app/finance/nfe/${id}?returnTo=${encodeURIComponent("/app/finance")}`,
    );
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
      const response = await fetch(`${API_URL}/v1/nfe/${id}/financial`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("detail");
      const detail = (await response.json()) as NfeDetailResponse;
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

  async function logout() {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    router.replace("/login");
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selected) => selected !== id)
        : [...current, id],
    );
  }

  function toggleVisible() {
    const visibleIds = data?.items.map((item) => item.id) ?? [];
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : visibleIds);
  }

  async function resyncSelected() {
    if (selectedIds.length === 0) return;
    setSyncing(true);
    setSyncNotice(null);
    try {
      const response = await fetch(`${API_URL}/v1/nfe/sync`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as NfeBulkActionResponse;
      setSyncNotice({
        tone: "success",
        message: `${result.queued.length} NF-e(s) enviada(s) para ressincronização. Custos, impostos, lucro e margem serão recalculados pelo worker.${result.skipped.length ? ` ${result.skipped.length} nota(s) não foi(ram) enfileirada(s).` : ""}`,
      });
      setSelectedIds([]);
    } catch (cause) {
      setSyncNotice({
        tone: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "Não foi possível ressincronizar as NF-e selecionadas.",
      });
    } finally {
      setSyncing(false);
    }
  }

  if (!session && loading) {
    return (
      <main className={shell.statePage}>
        <LoaderCircle className={shell.spin} size={28} />
        <h1>Consolidando rentabilidade</h1>
      </main>
    );
  }
  if (!session) {
    return (
      <main className={shell.statePage}>
        <CircleDollarSign size={28} />
        <h1>Financeiro indisponível</h1>
        <p>{error}</p>
        <Link href="/login">Voltar ao login</Link>
      </main>
    );
  }

  const summary = data?.summary;
  const activeFilters = [
    applied.numero,
    applied.nome,
    applied.tipoVenda,
    applied.calculo,
    applied.somentePrejuizo ? "prejuízo" : "",
  ].filter(Boolean).length;

  function exportCurrentPage() {
    if (!data?.items.length) return;
    downloadXlsx(
      `rentabilidade-${applied.dataInicial}-${applied.dataFinal}-pagina-${data.pagination.page}`,
      [
        "NF-e",
        "Emissão",
        "Cliente",
        "Canal",
        "Venda bruta",
        "Venda líquida",
        "Custo líquido",
        "Impostos",
        "Taxas",
        "Frete",
        "Lucro",
        "Margem",
        "Cálculo",
        "Observação",
      ],
      data.items.map((item) => [
        item.numero,
        item.dataEmissao,
        item.nome,
        item.tipoVenda,
        item.valor,
        item.vendaLiquida,
        item.custoLiquido,
        item.impostos,
        item.taxa,
        item.frete,
        item.lucro,
        item.margemLucro,
        item.calculo,
        item.observacao,
      ]),
    );
  }

  return (
    <main className={shell.shell}>
      <ApplicationSidebar session={session} open={menuOpen} onLogout={logout} />
      <aside
        hidden
        style={{ display: "none" }}
        className={`${shell.sidebar} ${menuOpen ? shell.sidebarOpen : ""}`}
      >
        <Link className={shell.brand} href="/">
          <span>
            <Orbit size={18} />
          </span>
          <div>
            <strong>APBling</strong>
            <small>BLING OPERATIONS</small>
          </div>
        </Link>
        <Link
          className={shell.tenant}
          href="/app/dashboard#organization"
          title="Trocar organização"
        >
          <span>
            <Building2 size={16} />
          </span>
          <div>
            <small>Organização</small>
            <strong>{session.tenant.name}</strong>
          </div>
          <ChevronDown size={14} />
        </Link>
        <nav className={shell.nav}>
          <p>OPERAÇÃO</p>
          <Link href="/app/dashboard">
            <Gauge size={17} /> Visão geral
          </Link>
          <Link href="/app/nfe">
            <FileText size={17} /> Notas fiscais
          </Link>
          <Link href="/app/products">
            <Boxes size={17} /> Produtos
          </Link>
          <Link href="/app/people">
            <Users size={17} /> Pessoas
          </Link>
          <Link href="/app/documents">
            <FileText size={17} /> Boletos e rastreio
          </Link>
          <Link href="/app/commercial">
            <Boxes size={17} /> Cadastros comerciais
          </Link>
          <Link className={shell.active} href="/app/finance">
            <CircleDollarSign size={17} /> Custos e margem
          </Link>
          <Link href="/app/fiscal">
            <Percent size={17} /> Custos e tributação
          </Link>
          <Link href="/app/goals">
            <Goal size={17} /> Metas
          </Link>
          <Link href="/app/operations">
            <Workflow size={17} /> Jobs e integrações
          </Link>
          <p>ADMINISTRAÇÃO</p>
          {session.permissions.includes("users:manage") ? (
            <Link href="/app/users">
              <ShieldCheck size={17} /> Usuários e acesso
            </Link>
          ) : null}
          <Link href="/app/settings">
            <Settings size={17} /> Configurações
          </Link>
        </nav>
        <div className={shell.sidebarFooter}>
          <button type="button" onClick={() => void logout()}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <section className={shell.workspace}>
        <header className={shell.topbar}>
          <button
            className={shell.mobileMenu}
            type="button"
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
              <span className={shell.eyebrow}>RESULTADO REAL · NF-E</span>
              <h1>Custos, lucro e margem</h1>
              <p>
                Leitura consolidada dos cálculos fiscais e financeiros
                processados pelo integrador.
              </p>
            </div>
            <div className={styles.titleActions}>
              <button
                className={shell.refreshButton}
                type="button"
                disabled={!data?.items.length}
                onClick={exportCurrentPage}
              >
                <Download size={15} /> Exportar Excel
              </button>
              <button
                className={shell.refreshButton}
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
                disabled={loading}
              >
                <RefreshCw className={loading ? shell.spin : ""} size={15} />{" "}
                Atualizar dados
              </button>
            </div>
          </section>

          <section className={styles.summaryGrid}>
            <SummaryCard
              icon={<WalletCards />}
              label="Venda bruta"
              value={money(summary?.vendaBruta)}
              detail={`${summary?.notas ?? 0} notas no período`}
              tone="neutral"
            />
            <SummaryCard
              icon={<TrendingUp />}
              label="Venda líquida"
              value={money(summary?.vendaLiquida)}
              detail="Base líquida calculada"
              tone="green"
            />
            <SummaryCard
              icon={<TrendingDown />}
              label="Custo líquido"
              value={money(summary?.custoLiquido)}
              detail={`${money(summary?.impostos)} em impostos`}
              tone="amber"
            />
            <SummaryCard
              icon={<CircleDollarSign />}
              label="Lucro"
              value={money(summary?.lucro)}
              detail="Resultado acumulado"
              tone={Number(summary?.lucro ?? 0) < 0 ? "red" : "green"}
            />
            <SummaryCard
              icon={<Percent />}
              label="Margem líquida"
              value={`${summary?.margemSobreVendaLiquida ?? "0.00"}%`}
              detail="Lucro sobre venda líquida"
              tone={
                Number(summary?.margemSobreVendaLiquida ?? 0) < 0
                  ? "red"
                  : "blue"
              }
            />
          </section>

          <section className={shell.filters}>
            <div className={shell.filterHead}>
              <span>
                <Filter size={14} /> Filtros de análise{" "}
                {activeFilters > 0 ? <b>{activeFilters}</b> : null}
              </span>
              <button type="button" onClick={clearFilters}>
                <X size={13} /> Limpar filtros
              </button>
            </div>
            <div className={styles.filterGrid}>
              <label className={shell.field}>
                <span>Período inicial</span>
                <input
                  type="date"
                  value={draft.dataInicial}
                  onChange={(event) =>
                    setDraft({ ...draft, dataInicial: event.target.value })
                  }
                />
              </label>
              <label className={shell.field}>
                <span>Período final</span>
                <input
                  type="date"
                  value={draft.dataFinal}
                  onChange={(event) =>
                    setDraft({ ...draft, dataFinal: event.target.value })
                  }
                />
              </label>
              <label className={shell.field}>
                <span>Número da nota</span>
                <input
                  value={draft.numero}
                  onChange={(event) =>
                    setDraft({ ...draft, numero: event.target.value })
                  }
                  placeholder="Ex.: 10294"
                />
              </label>
              <label className={shell.field}>
                <span>Cliente</span>
                <select
                  value={draft.nome}
                  onChange={(event) =>
                    setDraft({ ...draft, nome: event.target.value })
                  }
                >
                  <option value="">Todos os clientes</option>
                  {filterOptions.customers.map((customer) => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
              </label>
              <label className={shell.field}>
                <span>Canal de venda</span>
                <select
                  value={draft.tipoVenda}
                  onChange={(event) =>
                    setDraft({ ...draft, tipoVenda: event.target.value })
                  }
                >
                  <option value="">Todos os canais</option>
                  {filterOptions.salesChannels.map((salesChannel) => (
                    <option key={salesChannel} value={salesChannel}>
                      {salesChannel}
                    </option>
                  ))}
                </select>
              </label>
              <label className={shell.field}>
                <span>Estado do cálculo</span>
                <select
                  value={draft.calculo}
                  onChange={(event) =>
                    setDraft({ ...draft, calculo: event.target.value })
                  }
                >
                  <option value="">Todos</option>
                  <option value="S">Sucesso</option>
                  <option value="I">Inconsistência</option>
                  <option value="N">Falha</option>
                </select>
              </label>
              <label className={styles.lossToggle}>
                <input
                  type="checkbox"
                  checked={draft.somentePrejuizo}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      somentePrejuizo: event.target.checked,
                    })
                  }
                />
                <span>
                  <TrendingDown size={14} /> Somente prejuízo
                </span>
              </label>
              <button
                className={shell.applyButton}
                type="button"
                onClick={applyFilters}
              >
                <Search size={14} /> Aplicar filtros
              </button>
            </div>
          </section>

          <section className={shell.bulkActions} aria-label="Ações em lote">
            <div>
              <strong>{selectedIds.length} selecionada(s)</strong>
              <span>Máximo de 50 NF-e por operação</span>
            </div>
            <button
              type="button"
              disabled={
                selectedIds.length === 0 ||
                syncing ||
                !session.permissions.includes("nfe:manage") ||
                !session.permissions.includes("nfe:manage")
              }
              onClick={() => void resyncSelected()}
            >
              {syncing ? (
                <LoaderCircle className={shell.spin} size={15} />
              ) : (
                <RefreshCw size={15} />
              )}
              Ressincronizar selecionadas
            </button>
          </section>

          <section className={shell.tablePanel}>
            <header className={shell.tableHead}>
              <div>
                <strong>Rentabilidade por nota fiscal</strong>
                <span>
                  {data?.pagination.total ?? 0} registros no recorte selecionado
                </span>
              </div>
              <span className={shell.readOnly}>
                <CalendarRange size={11} /> PERÍODO{" "}
                {dateLabel(applied.dataInicial)} —{" "}
                {dateLabel(applied.dataFinal)}
              </span>
            </header>
            {syncNotice ? (
              <div
                className={`${styles.syncNotice} ${
                  syncNotice.tone === "error" ? styles.syncNoticeError : ""
                }`}
                role={syncNotice.tone === "error" ? "alert" : "status"}
              >
                {syncNotice.tone === "success" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <TrendingDown size={15} />
                )}
                <span>{syncNotice.message}</span>
                {syncNotice.tone === "success" ? (
                  <Link href="/app/operations">Acompanhar job</Link>
                ) : null}
              </div>
            ) : null}
            {error ? <div className={shell.error}>{error}</div> : null}
            <div className={`${shell.tableWrap} ${styles.tableWrap}`}>
              <table>
                <thead>
                  <tr>
                    <th className={styles.expandCell}>
                      <span className={styles.srOnly}>Detalhes</span>
                    </th>
                    <th className={shell.checkCell}>
                      <input
                        type="checkbox"
                        checked={Boolean(
                          data?.items.length &&
                          data.items.every((item) =>
                            selectedIds.includes(item.id),
                          ),
                        )}
                        onChange={toggleVisible}
                        aria-label="Selecionar NF-e visíveis"
                      />
                    </th>
                    <th>Nota / emissão</th>
                    <th>Cliente / canal</th>
                    <th>Venda</th>
                    <th>Descontos e despesas</th>
                    <th>Custos e impostos</th>
                    <th>Lucro</th>
                    <th>Margem</th>
                    <th>Cálculo</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !data ? (
                    <tr>
                      <td className={shell.empty} colSpan={10}>
                        <LoaderCircle className={shell.spin} size={21} />
                        Carregando resultados...
                      </td>
                    </tr>
                  ) : null}
                  {!loading && data?.items.length === 0 ? (
                    <tr>
                      <td className={shell.empty} colSpan={10}>
                        <CircleDollarSign size={21} />
                        Nenhuma nota encontrada neste recorte.
                      </td>
                    </tr>
                  ) : null}
                  {data?.items.map((item) => (
                    <Fragment key={item.id}>
                      <tr
                        className={styles.clickableRow}
                        onClick={() => openDetail(item.id)}
                      >
                        <td className={styles.expandCell}>
                          <button
                            type="button"
                            className={styles.expandButton}
                            aria-expanded={expandedId === item.id}
                            aria-label={`${expandedId === item.id ? "Fechar" : "Abrir"} itens da NF-e ${item.numero}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleDetail(item.id);
                            }}
                          >
                            {expandedId === item.id ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </button>
                        </td>
                        <td className={shell.checkCell}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelected(item.id)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Selecionar NF-e ${item.numero}`}
                          />
                        </td>
                        <td>
                          <Link
                            href={`/app/finance/nfe/${item.id}?returnTo=${encodeURIComponent("/app/finance")}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (
                                !event.ctrlKey &&
                                !event.metaKey &&
                                !event.shiftKey
                              )
                                preserveNavigation();
                            }}
                          >
                            <strong>NF-e {item.numero}</strong>
                          </Link>
                          <a
                            className={styles.newTabLink}
                            href={`/app/finance/nfe/${item.id}?returnTo=${encodeURIComponent("/app/finance")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            title="Abrir em nova guia"
                            aria-label={`Abrir NF-e ${item.numero} em nova guia`}
                          >
                            <ExternalLink size={13} />
                          </a>
                          <small>
                            {item.dataEmissao
                              ? dateLabel(item.dataEmissao)
                              : "Sem data"}
                          </small>
                        </td>
                        <td>
                          <strong>{item.nome}</strong>
                          <small>{item.tipoVenda}</small>
                        </td>
                        <td className={shell.money}>
                          {money(item.valor)}
                          <small>Líquida: {money(item.vendaLiquida)}</small>
                        </td>
                        <td>
                          <strong>
                            {money(
                              String(
                                Number(item.desconto) +
                                  Number(item.outrasDespesas),
                              ),
                            )}
                          </strong>
                          <small>
                            Frete: {money(item.frete)} · Taxa:{" "}
                            {money(item.taxa)}
                          </small>
                        </td>
                        <td>
                          <strong>{money(item.custoLiquido)}</strong>
                          <small>Impostos: {money(item.impostos)}</small>
                        </td>
                        <td
                          className={
                            Number(item.lucro) < 0 ? styles.loss : styles.profit
                          }
                        >
                          {money(item.lucro)}
                        </td>
                        <td>
                          <strong
                            className={
                              Number(item.margemLucro) < 0
                                ? styles.loss
                                : styles.profit
                            }
                          >
                            {item.margemLucro}%
                          </strong>
                        </td>
                        <td>
                          <CalculationBadge value={item.calculo} />
                          <small className={styles.observation}>
                            {item.observacao ?? "Sem observações"}
                          </small>
                        </td>
                      </tr>
                      {expandedId === item.id ? (
                        <>
                          {detailLoading === item.id ? (
                            <tr className={styles.detailRow}>
                              <td colSpan={10}>
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
                              <td colSpan={10}>
                                <div className={styles.detailError}>
                                  {detailError[item.id]}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                          {detailCache[item.id]?.items.map((detailItem) => (
                            <tr
                              key={`detail-${detailItem.id}`}
                              className={`${styles.itemDetailRow} ${detailItem.inconsistencia ? styles.itemDetailWarning : ""}`}
                            >
                              <td className={styles.itemBling} colSpan={2}>
                                  {detailItem.produtoId ? (
                                    <a
                                      href={blingProductUrl(detailItem.produtoId)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Abrir produto no Bling"
                                      aria-label={`Abrir ${detailItem.nome} no Bling`}
                                    >
                                      <PackageSearch size={15} />
                                    </a>
                                  ) : null}
                                </td>
                                <td className={styles.itemName}>
                                <strong>{detailItem.nome}</strong>
                                <small>
                                  {detailItem.codigo ??
                                    detailItem.produtoId ??
                                    "Sem código"}
                                </small>
                              </td>
                              <td className={styles.itemMeta}>
                                <small>CFOP · Quantidade</small>
                                <strong>
                                  {detailItem.cfop ?? "—"} ·{" "}
                                  {Number(detailItem.quantidade).toLocaleString(
                                    "pt-BR",
                                  )}
                                </strong>
                                {detailItem.inconsistencia ? (
                                  <small className={styles.itemIssue}>
                                    {detailItem.inconsistencia}
                                  </small>
                                ) : null}
                              </td>
                              <td>
                                <small>Venda líquida</small>
                                <strong>
                                  {money(detailItem.vendaLiquida)}
                                </strong>
                              </td>
                              <td>
                                <small>Desconto · Frete · Outras</small>
                                <strong>
                                  {money(detailItem.desconto)} ·{" "}
                                  {money(detailItem.frete)} ·{" "}
                                  {money(detailItem.outrasDespesas)}
                                </strong>
                              </td>
                              <td>
                                <small>Custo · Impostos</small>
                                <strong>
                                  {money(detailItem.custoLiquido)} ·{" "}
                                  {money(detailItem.impostos)}
                                </strong>
                                <small>
                                  Créditos:{" "}
                                  {money(
                                    String(
                                      Number(detailItem.creditoIpi) +
                                        Number(detailItem.creditoIcms),
                                    ),
                                  )}
                                </small>
                              </td>
                              <td
                                className={
                                  Number(detailItem.lucro) < 0
                                    ? styles.loss
                                    : styles.profit
                                }
                              >
                                <small>Lucro</small>
                                <strong>{money(detailItem.lucro)}</strong>
                              </td>
                              <td
                                className={
                                  Number(detailItem.margemLucro) < 0
                                    ? styles.loss
                                    : styles.profit
                                }
                              >
                                <small>Margem</small>
                                <strong>{detailItem.margemLucro}%</strong>
                              </td>
                              <td>
                                <small>Item</small>
                                <strong>
                                  {detailItem.inconsistencia
                                    ? "Revisar"
                                    : "Conferido"}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className={shell.pagination}>
              <span>
                Página {data?.pagination.page ?? page} de{" "}
                {Math.max(data?.pagination.pages ?? 0, 1)}
              </span>
              <div>
                <button
                  type="button"
                  aria-label="Página anterior"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Próxima página"
                  disabled={loading || page >= (data?.pagination.pages ?? 0)}
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </footer>
          </section>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className={`${styles.summaryCard} ${styles[tone]}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

function CalculationBadge({ value }: { value: string | null }) {
  const meta =
    value === "S"
      ? { label: "Sucesso", className: styles.success }
      : value === "I"
        ? { label: "Inconsistência", className: styles.warning }
        : { label: "Falha", className: styles.failure };
  return (
    <span className={`${styles.calculation} ${meta.className}`}>
      <i /> {meta.label}
    </span>
  );
}

function money(value: string | undefined): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function dateLabel(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (typeof payload.message === "string") return payload.message;
    if (Array.isArray(payload.message)) return payload.message.join(". ");
  } catch {
    return "Não foi possível concluir a ressincronização.";
  }
  return "Não foi possível concluir a ressincronização.";
}
