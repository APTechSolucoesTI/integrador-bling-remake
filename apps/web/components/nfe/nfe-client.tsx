"use client";

import type {
  NfeBulkActionResponse,
  NfeDetailResponse,
  InvoiceFilterOptionsResponse,
  NfeListResponse,
  SessionResponse,
} from "@integrador/contracts";
import {
  Activity,
  Banknote,
  Boxes,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Filter,
  Gauge,
  Goal,
  LoaderCircle,
  LogOut,
  Menu,
  MapPin,
  Orbit,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Save,
  Settings,
  ShieldCheck,
  Store,
  UserRound,
  Percent,
  Truck,
  Users,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import {
  clearListNavigationState,
  consumeListNavigationState,
  saveListNavigationState,
} from "../../lib/list-navigation-state";
import { ApplicationSidebar } from "../layout/application-sidebar";
import { ApplicationHeaderActions } from "../layout/application-header-actions";
import { ApplicationGlobalSearch } from "../layout/application-global-search";
import { SmartCsvImportButton } from "../imports/smart-csv-import";
import styles from "./nfe.module.css";

interface Filters {
  numero: string;
  serie: string;
  nome: string;
  tipoVenda: string;
  envio: string;
  valor: string;
  dataInicial: string;
  dataFinal: string;
  temCodigo: string;
  statusId: string;
  order: string;
  direction: string;
}
interface NfeNavigationState {
  filters: Filters;
  appliedFilters: Filters;
  page: number;
}

const emptyFilters: Filters = {
  numero: "",
  serie: "",
  nome: "",
  tipoVenda: "",
  envio: "",
  valor: "",
  dataInicial: "",
  dataFinal: "",
  temCodigo: "",
  statusId: "",
  order: "data_emissao",
  direction: "desc",
};

export function NfeClient() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [data, setData] = useState<NfeListResponse | null>(null);
  const [filterOptions, setFilterOptions] =
    useState<InvoiceFilterOptionsResponse>({
      customers: [],
      salesChannels: [],
    });
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [actionPending, setActionPending] = useState<"sync" | "send" | null>(
    null,
  );
  const [drawerInvoice, setDrawerInvoice] = useState<NfeDetailResponse | null>(
    null,
  );
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"contact" | "bills">("contact");
  const [mobilePhone, setMobilePhone] = useState("");
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  const requestList = useCallback(
    async (nextFilters: Filters, page = 1) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "50",
      });
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (typeof value === "string" && value) params.set(key, value);
      });
      try {
        const response = await fetch(`${API_URL}/v1/nfe?${params}`, {
          credentials: "include",
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("api");
        setData((await response.json()) as NfeListResponse);
        setAppliedFilters(nextFilters);
        setSelectedIds([]);
      } catch {
        setError(
          "Não foi possível consultar as notas sincronizadas. Confirme a API e tente novamente.",
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
        const nextSession = (await response.json()) as SessionResponse;
        if (active) {
          setSession(nextSession);
          const optionsResponse = await fetch(
            `${API_URL}/v1/nfe/filter-options`,
            {
              credentials: "include",
            },
          );
          if (optionsResponse.ok && active) {
            setFilterOptions(
              (await optionsResponse.json()) as InvoiceFilterOptionsResponse,
            );
          }
          const shouldRestore = new URLSearchParams(window.location.search).has(
            "restoreFilters",
          );
          const restored = shouldRestore
            ? consumeListNavigationState<NfeNavigationState>("nfe")
            : null;
          if (!shouldRestore) clearListNavigationState("nfe");
          if (shouldRestore) {
            window.history.replaceState(window.history.state, "", "/app/nfe");
          }
          const search =
            new URLSearchParams(window.location.search).get("search")?.trim() ??
            "";
          const initial =
            restored?.filters ??
            (/^\d+$/.test(search)
              ? { ...emptyFilters, numero: search }
              : emptyFilters);
          setFilters(initial);
          await requestList(
            restored?.appliedFilters ?? initial,
            restored?.page ?? 1,
          );
        }
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
  }, [requestList, router]);

  async function logout() {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void requestList(filters, 1);
  }

  function clearFilters() {
    clearListNavigationState("nfe");
    setFilters(emptyFilters);
    void requestList(emptyFilters, 1);
  }

  function preserveNavigation() {
    saveListNavigationState<NfeNavigationState>("nfe", {
      filters,
      appliedFilters,
      page: data?.pagination.page ?? 1,
    });
    window.history.replaceState(
      window.history.state,
      "",
      "/app/nfe?restoreFilters=1",
    );
  }

  function selectStatus(statusId: number | null) {
    const next = { ...filters, statusId: statusId?.toString() ?? "" };
    setFilters(next);
    void requestList(next, 1);
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
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : visibleIds);
  }

  async function runBulkAction(action: "sync" | "send") {
    if (selectedIds.length === 0) return;
    setActionPending(action);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/v1/nfe/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as NfeBulkActionResponse;
      const actionLabel =
        action === "sync" ? "ressincronização" : "envio pelo APChat";
      setSuccess(
        `${result.queued.length} job(s) de ${actionLabel} adicionados à fila${result.skipped.length ? ` · ${result.skipped.length} ignorado(s)` : ""}.`,
      );
      setSelectedIds([]);
      await requestList(appliedFilters, data?.pagination.page ?? 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível executar a ação selecionada.",
      );
    } finally {
      setActionPending(null);
    }
  }

  async function openDrawer(id: number, tab: "contact" | "bills") {
    setDrawerTab(tab);
    setDrawerInvoice(null);
    setDrawerError(null);
    setDrawerLoading(true);
    try {
      const response = await fetch(`${API_URL}/v1/nfe/${id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const detail = (await response.json()) as NfeDetailResponse;
      setDrawerInvoice(detail);
      setMobilePhone(detail.contact?.mobilePhone ?? "");
      setMessagingDisabled(detail.contact?.messagingDisabled ?? false);
    } catch (cause) {
      setDrawerError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os dados da NF-e.",
      );
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    if (savingContact) return;
    setDrawerInvoice(null);
    setDrawerError(null);
    setDrawerLoading(false);
  }

  async function saveContact() {
    const invoiceId = drawerInvoice?.invoice.id;
    if (!invoiceId || !drawerInvoice.contact) return;
    setSavingContact(true);
    setDrawerError(null);
    try {
      const response = await fetch(`${API_URL}/v1/nfe/${invoiceId}/contact`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mobilePhone, messagingDisabled }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const queued =
        (await response.json()) as NfeBulkActionResponse["queued"][number];
      setSuccess(
        `Atualização do contato enviada ao Bling (${queued.id.slice(0, 8)}). O status das notas será reavaliado pelo worker.`,
      );
      closeDrawer();
      await requestList(appliedFilters, data?.pagination.page ?? 1);
    } catch (cause) {
      setDrawerError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o contato no Bling.",
      );
    } finally {
      setSavingContact(false);
    }
  }

  if (!session && loading) {
    return (
      <main className={styles.statePage}>
        <LoaderCircle className={styles.spin} size={29} />
        <h1>Consultando suas notas fiscais</h1>
        <p>Aplicando o contexto seguro da empresa no PostgreSQL.</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={styles.statePage}>
        <Workflow size={29} />
        <h1>Não foi possível abrir esta operação</h1>
        <p>{error}</p>
        <Link href="/login">Voltar ao login</Link>
      </main>
    );
  }

  const activeFilterCount = Object.entries(appliedFilters).filter(
    ([key, value]) =>
      value &&
      !["order", "direction"].includes(key) &&
      value !== emptyFilters[key as keyof Filters],
  ).length;

  return (
    <main className={styles.shell}>
      <ApplicationSidebar session={session} open={menuOpen} onLogout={logout} />
      <aside
        hidden
        style={{ display: "none" }}
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
      >
        <Link className={styles.brand} href="/">
          <span>
            <Orbit size={18} />
          </span>
          <div>
            <strong>APBling</strong>
            <small>BLING OPERATIONS</small>
          </div>
        </Link>
        <Link
          className={styles.tenant}
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
        <nav className={styles.nav} aria-label="Navegação da aplicação">
          <p>OPERAÇÃO</p>
          <Link href="/app/dashboard">
            <Gauge size={17} /> Visão geral
          </Link>
          <Link className={styles.active} href="/app/nfe">
            <FileText size={17} /> Notas fiscais
          </Link>
          <Link href="/app/products">
            <Boxes size={17} /> Produtos
          </Link>
          <Link href="/app/people">
            <Users size={17} /> Pessoas
          </Link>
          <Link href="/app/documents">
            <Truck size={17} /> Boletos e rastreio
          </Link>
          <Link href="/app/commercial">
            <Store size={17} /> Cadastros comerciais
          </Link>
          <Link href="/app/finance">
            <CircleDollarSign size={17} /> Custos e margem
          </Link>
          <Link href="/app/fiscal">
            <Percent size={17} /> Custos e tributação
          </Link>
          <Link href="/app/goals">
            <Goal size={17} /> Metas
          </Link>
          <Link href="/app/operations">
            <Activity size={17} /> Jobs e integrações
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
        <div className={styles.sidebarFooter}>
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
          <ApplicationGlobalSearch />
          <ApplicationHeaderActions session={session} onLogout={logout} />
        </header>

        <div className={styles.content}>
          <section className={styles.titleRow}>
            <div>
              <span className={styles.eyebrow}>OPERAÇÃO FISCAL · VIEW_NFE</span>
              <h1>Notas fiscais</h1>
              <p>
                Consulta read-only com os mesmos campos e filtros essenciais da
                listagem Adianti.
              </p>
            </div>
            <div className={styles.titleActions}>
              {session.permissions.includes("nfe:manage") &&
              session.permissions.includes("imports:manage") ? (
                <SmartCsvImportButton
                  defaultEntity="invoices"
                  onComplete={() =>
                    requestList(appliedFilters, data?.pagination.page)
                  }
                  compact
                />
              ) : null}
              <Link
                className={styles.syncButton}
                href="/app/operations#bling-sync"
              >
                <Workflow size={16} /> Sincronizar NF-e
              </Link>
              <button
                className={styles.refreshButton}
                type="button"
                onClick={() =>
                  void requestList(appliedFilters, data?.pagination.page)
                }
                disabled={loading}
              >
                <RefreshCw className={loading ? styles.spin : ""} size={16} />
                Atualizar lista
              </button>
            </div>
          </section>

          <section
            className={styles.statusStrip}
            aria-label="Totais por status"
          >
            <button
              className={!appliedFilters.statusId ? styles.statusActive : ""}
              type="button"
              onClick={() => selectStatus(null)}
            >
              <span>Todos</span>
              <strong>
                {data?.statusCounts.reduce(
                  (sum, item) => sum + item.count,
                  0,
                ) ?? 0}
              </strong>
            </button>
            {data?.statusCounts.map((status) => (
              <button
                className={
                  appliedFilters.statusId === String(status.statusId)
                    ? styles.statusActive
                    : ""
                }
                type="button"
                key={status.statusId ?? "null"}
                onClick={() => selectStatus(status.statusId)}
              >
                <i className={statusTone(status.statusId)} />
                <span>{status.label}</span>
                <strong>{status.count}</strong>
              </button>
            ))}
          </section>

          <form className={styles.filters} onSubmit={submit}>
            <div className={styles.filterHead}>
              <span>
                <Filter size={15} /> Filtros avançados
                {activeFilterCount ? <b>{activeFilterCount}</b> : null}
              </span>
              <button type="button" onClick={clearFilters}>
                <X size={14} /> Limpar
              </button>
            </div>
            <div className={styles.filterGrid}>
              <Field label="Número">
                <input
                  value={filters.numero}
                  onChange={(event) =>
                    setFilters({ ...filters, numero: event.target.value })
                  }
                  placeholder="Exato"
                />
              </Field>
              <Field label="Série">
                <input
                  inputMode="numeric"
                  value={filters.serie}
                  onChange={(event) =>
                    setFilters({ ...filters, serie: event.target.value })
                  }
                  placeholder="Exata"
                />
              </Field>
              <Field label="Cliente">
                <select
                  value={filters.nome}
                  onChange={(event) =>
                    setFilters({ ...filters, nome: event.target.value })
                  }
                >
                  <option value="">Todos os clientes</option>
                  {filterOptions.customers.map((customer) => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Canal de venda">
                <select
                  value={filters.tipoVenda}
                  onChange={(event) =>
                    setFilters({ ...filters, tipoVenda: event.target.value })
                  }
                >
                  <option value="">Todos os canais</option>
                  {filterOptions.salesChannels.map((salesChannel) => (
                    <option key={salesChannel} value={salesChannel}>
                      {salesChannel}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor">
                <input
                  inputMode="decimal"
                  value={filters.valor}
                  onChange={(event) =>
                    setFilters({ ...filters, valor: event.target.value })
                  }
                  placeholder="0,00"
                />
              </Field>
              <Field label="Emissão inicial">
                <input
                  type="date"
                  value={filters.dataInicial}
                  onChange={(event) =>
                    setFilters({ ...filters, dataInicial: event.target.value })
                  }
                />
              </Field>
              <Field label="Emissão final">
                <input
                  type="date"
                  value={filters.dataFinal}
                  onChange={(event) =>
                    setFilters({ ...filters, dataFinal: event.target.value })
                  }
                />
              </Field>
              <Field label="Rastreio">
                <select
                  value={filters.temCodigo}
                  onChange={(event) =>
                    setFilters({ ...filters, temCodigo: event.target.value })
                  }
                >
                  <option value="">Todos</option>
                  <option value="S">Com código</option>
                  <option value="N">Sem código</option>
                </select>
              </Field>
              <Field label="Mensagens">
                <select
                  value={filters.envio}
                  onChange={(event) =>
                    setFilters({ ...filters, envio: event.target.value })
                  }
                >
                  <option value="">Todas</option>
                  <option value="S">Desabilitadas</option>
                  <option value="N">Habilitadas</option>
                </select>
              </Field>
              <Field label="Ordenação">
                <select
                  value={`${filters.order}:${filters.direction}`}
                  onChange={(event) => {
                    const [order = "data_emissao", direction = "desc"] =
                      event.target.value.split(":");
                    setFilters({ ...filters, order, direction });
                  }}
                >
                  <option value="data_emissao:desc">Mais recentes</option>
                  <option value="data_emissao:asc">Mais antigas</option>
                  <option value="numero:asc">Número crescente</option>
                  <option value="valor:desc">Maior valor</option>
                  <option value="nome:asc">Cliente A–Z</option>
                </select>
              </Field>
              <button className={styles.applyButton} type="submit">
                <Search size={15} /> Aplicar filtros
              </button>
            </div>
          </form>

          <section className={styles.bulkActions} aria-label="Ações em lote">
            <div>
              <strong>{selectedIds.length} selecionada(s)</strong>
              <span>Máximo de 50 NF-e por operação</span>
            </div>
            <button
              type="button"
              disabled={
                selectedIds.length === 0 ||
                Boolean(actionPending) ||
                !session.permissions.includes("nfe:manage")
              }
              onClick={() => void runBulkAction("sync")}
            >
              {actionPending === "sync" ? (
                <LoaderCircle className={styles.spin} size={15} />
              ) : (
                <RotateCcw size={15} />
              )}
              Ressincronizar
            </button>
            <button
              className={styles.sendButton}
              type="button"
              disabled={
                selectedIds.length === 0 ||
                Boolean(actionPending) ||
                !session.permissions.includes("nfe:manage")
              }
              onClick={() => void runBulkAction("send")}
            >
              {actionPending === "send" ? (
                <LoaderCircle className={styles.spin} size={15} />
              ) : (
                <Send size={15} />
              )}
              Enviar pelo APChat
            </button>
          </section>
          {success ? <div className={styles.success}>{success}</div> : null}

          <section className={styles.tablePanel}>
            <div className={styles.tableHead}>
              <div>
                <strong>Resultado da consulta</strong>
                <span>{data?.pagination.total ?? 0} notas · 50 por página</span>
              </div>
              <span className={styles.readOnly}>
                DADOS FISCAIS SOMENTE LEITURA
              </span>
            </div>
            {error ? <div className={styles.error}>{error}</div> : null}
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th className={styles.checkCell}>
                      <input
                        type="checkbox"
                        checked={Boolean(
                          data?.items.length &&
                          data.items.every((item) =>
                            selectedIds.includes(item.id),
                          ),
                        )}
                        onChange={toggleVisible}
                        aria-label="Selecionar notas visíveis"
                      />
                    </th>
                    <th>Número</th>
                    <th>Cliente</th>
                    <th>Emissão</th>
                    <th>Valor</th>
                    <th>DANFE</th>
                    <th>Rastreio</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !data ? (
                    <tr>
                      <td className={styles.empty} colSpan={8}>
                        <LoaderCircle className={styles.spin} size={21} />
                        Consultando PostgreSQL...
                      </td>
                    </tr>
                  ) : null}
                  {!loading && data?.items.length === 0 ? (
                    <tr>
                      <td className={styles.empty} colSpan={8}>
                        Nenhuma nota corresponde aos filtros aplicados.
                      </td>
                    </tr>
                  ) : null}
                  {data?.items.map((invoice) => {
                    const pdf = safeHttpUrl(invoice.linkPdf);
                    return (
                      <tr key={invoice.id}>
                        <td className={styles.checkCell}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(invoice.id)}
                            onChange={() => toggleSelected(invoice.id)}
                            aria-label={`Selecionar NF-e ${invoice.numero}`}
                          />
                        </td>
                        <td>
                          <Link
                            href={`/app/nfe/${invoice.id}?returnTo=${encodeURIComponent("/app/nfe?restoreFilters=1")}`}
                            onClick={(event) => {
                              if (
                                !event.ctrlKey &&
                                !event.metaKey &&
                                !event.shiftKey
                              )
                                preserveNavigation();
                            }}
                          >
                            <strong>#{invoice.numero}</strong>
                          </Link>
                          <small>Série {invoice.serie ?? "—"}</small>
                        </td>
                        <td>
                          <button
                            className={styles.contactButton}
                            type="button"
                            onClick={() =>
                              void openDrawer(invoice.id, "contact")
                            }
                          >
                            <strong>{invoice.nome}</strong>
                          </button>
                          <small>
                            {invoice.envioDesabilitado
                              ? "Mensagens desabilitadas"
                              : `Bling ${invoice.blingId}`}
                          </small>
                        </td>
                        <td>{formatDate(invoice.dataEmissao)}</td>
                        <td className={styles.money}>{brl(invoice.valor)}</td>
                        <td>
                          {pdf ? (
                            <a
                              href={pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink size={15} /> Abrir
                            </a>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                        <td>
                          {invoice.codigoRastreio ? (
                            <a
                              href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(invoice.codigoRastreio)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Truck size={15} /> {invoice.codigoRastreio}
                            </a>
                          ) : (
                            <span className={styles.muted}>Sem código</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${statusTone(invoice.statusId)}`}
                            title={invoice.observacaoEnvio ?? undefined}
                          >
                            {invoice.statusEnvio}
                          </span>
                          <small className={styles.statusReason}>
                            {deliveryReason(invoice)}
                          </small>
                          {invoice.temBoleto ? (
                            <button
                              className={styles.billButton}
                              type="button"
                              onClick={() =>
                                void openDrawer(invoice.id, "bills")
                              }
                            >
                              <Banknote size={12} /> Ver boleto
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
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
                  disabled={!data || data.pagination.page <= 1 || loading}
                  onClick={() =>
                    void requestList(appliedFilters, data!.pagination.page - 1)
                  }
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  disabled={
                    !data ||
                    data.pagination.page >= data.pagination.pages ||
                    loading
                  }
                  onClick={() =>
                    void requestList(appliedFilters, data!.pagination.page + 1)
                  }
                  aria-label="Próxima página"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          </section>
        </div>
      </section>
      {drawerLoading || drawerInvoice || drawerError ? (
        <div className={styles.drawerBackdrop} onMouseDown={closeDrawer}>
          <aside
            className={styles.detailDrawer}
            aria-label="Dados operacionais da NF-e"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>NF-e {drawerInvoice?.invoice.numero ?? ""}</span>
                <h2>Contato e cobrança</h2>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Fechar painel"
              >
                <X size={18} />
              </button>
            </header>
            {drawerLoading ? (
              <div className={styles.drawerState}>
                <LoaderCircle className={styles.spin} size={24} />
                Carregando dados vinculados...
              </div>
            ) : null}
            {drawerError ? (
              <div className={styles.drawerError}>{drawerError}</div>
            ) : null}
            {drawerInvoice ? (
              <>
                <nav className={styles.drawerTabs}>
                  <button
                    className={
                      drawerTab === "contact" ? styles.drawerTabActive : ""
                    }
                    type="button"
                    onClick={() => setDrawerTab("contact")}
                  >
                    <UserRound size={14} /> Contato
                  </button>
                  <button
                    className={
                      drawerTab === "bills" ? styles.drawerTabActive : ""
                    }
                    type="button"
                    onClick={() => setDrawerTab("bills")}
                  >
                    <Banknote size={14} /> Boletos (
                    {drawerInvoice.boletos.length})
                  </button>
                </nav>
                {drawerTab === "contact" ? (
                  <ContactDrawer
                    detail={drawerInvoice}
                    mobilePhone={mobilePhone}
                    messagingDisabled={messagingDisabled}
                    disabled={
                      !session.permissions.includes("people:manage") ||
                      savingContact
                    }
                    onMobilePhone={setMobilePhone}
                    onMessagingDisabled={setMessagingDisabled}
                    onSave={() => void saveContact()}
                    saving={savingContact}
                  />
                ) : (
                  <BillsDrawer detail={drawerInvoice} />
                )}
              </>
            ) : null}
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function ContactDrawer({
  detail,
  mobilePhone,
  messagingDisabled,
  disabled,
  saving,
  onMobilePhone,
  onMessagingDisabled,
  onSave,
}: {
  detail: NfeDetailResponse;
  mobilePhone: string;
  messagingDisabled: boolean;
  disabled: boolean;
  saving: boolean;
  onMobilePhone: (value: string) => void;
  onMessagingDisabled: (value: boolean) => void;
  onSave: () => void;
}) {
  const contact = detail.contact;
  if (!contact)
    return (
      <div className={styles.drawerState}>
        <UserRound size={24} />
        <strong>Contato não localizado</strong>
        <span>Esta é a razão pela qual a nota não pode ser enviada.</span>
      </div>
    );
  return (
    <div className={styles.drawerBody}>
      <section className={styles.contactSummary}>
        <div>
          <small>ID BLING</small>
          <strong>{contact.blingId}</strong>
        </div>
        <div>
          <small>NOME</small>
          <strong>{contact.name}</strong>
        </div>
        <div>
          <small>DOCUMENTO</small>
          <strong>{contact.documentNumber ?? "Não informado"}</strong>
        </div>
        <div>
          <small>IE / RG</small>
          <strong>
            {contact.stateRegistration ??
              contact.identityDocument ??
              "Não informado"}
          </strong>
        </div>
        <div>
          <small>TELEFONE</small>
          <strong>
            {contact.contactPhone ?? contact.phone ?? "Não informado"}
          </strong>
        </div>
        <div>
          <small>E-MAIL</small>
          <strong>{contact.email ?? "Não informado"}</strong>
        </div>
      </section>
      {contact.address ? (
        <div className={styles.addressBox}>
          <MapPin size={15} />
          <span>
            {[
              contact.address.street,
              contact.address.number,
              contact.address.district,
              contact.address.city,
              contact.address.state,
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        </div>
      ) : null}
      <section className={styles.deliveryDiagnosis}>
        <strong>Diagnóstico do envio</strong>
        <p>
          {detail.invoice.observacaoEnvio ??
            "Aguardando avaliação operacional da nota."}
        </p>
      </section>
      <section className={styles.contactForm}>
        <label>
          Celular com DDD
          <input
            value={mobilePhone}
            maxLength={25}
            placeholder="(00) 00000-0000"
            disabled={disabled}
            onChange={(event) => onMobilePhone(event.target.value)}
          />
          <small>
            O cadastro completo atual é buscado e reenviado ao Bling; somente o
            celular é alterado.
          </small>
        </label>
        <label className={styles.switchRow}>
          <input
            type="checkbox"
            checked={messagingDisabled}
            disabled={disabled}
            onChange={(event) => onMessagingDisabled(event.target.checked)}
          />
          <span>
            <strong>Desabilitar envio</strong>
            <small>Ignora mensagens desta pessoa em todas as NF-e.</small>
          </span>
        </label>
        <button
          className={styles.saveContactButton}
          type="button"
          disabled={disabled}
          onClick={onSave}
        >
          {saving ? (
            <LoaderCircle className={styles.spin} size={15} />
          ) : (
            <Save size={15} />
          )}
          {saving ? "Enviando ao Bling" : "Salvar contato"}
        </button>
      </section>
    </div>
  );
}

function BillsDrawer({ detail }: { detail: NfeDetailResponse }) {
  return (
    <div className={styles.drawerBody}>
      {detail.boletos.map((bill) => (
        <article className={styles.billCard} key={bill.id}>
          <span>
            <Banknote size={17} />
          </span>
          <div>
            <strong>{brl(bill.valor)}</strong>
            <small>
              {bill.numeroExterno ?? `Boleto #${bill.id}`} · vence{" "}
              {formatDate(bill.vencimento)}
            </small>
            <small>Situação: {billStatusLabel(bill.situacao)}</small>
          </div>
          {safeHttpUrl(bill.link) ? (
            <a
              href={safeHttpUrl(bill.link)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir <ExternalLink size={13} />
            </a>
          ) : (
            <span className={styles.muted}>Link pendente</span>
          )}
        </article>
      ))}
      {detail.boletos.length === 0 ? (
        <div className={styles.drawerState}>
          <Banknote size={24} />
          <strong>Nenhum boleto vinculado</strong>
          <span>
            Ressincronize a nota se a forma de pagamento exigir boleto.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function deliveryReason(invoice: NfeListResponse["items"][number]) {
  if (invoice.observacaoEnvio) return invoice.observacaoEnvio;
  if (invoice.envioDesabilitado)
    return "Mensagens desabilitadas para o contato";
  if (invoice.statusId === 1) return "Envio concluído";
  if (invoice.statusId === 2) return "NF-e pronta para envio";
  if (invoice.statusId === 3)
    return "Falha operacional; abra a nota para conferir";
  return "Ignorada pela regra operacional";
}

function billStatusLabel(value: number | null) {
  if (value === 1) return "Em aberto";
  if (value === 2) return "Pago";
  if (value === 3) return "Cancelado";
  return "Não informada";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function statusTone(statusId: number | null): string {
  if (statusId === 1) return styles.green ?? "";
  if (statusId === 2) return styles.amber ?? "";
  if (statusId === 4 || statusId === 6) return styles.red ?? "";
  if (statusId === 5) return styles.blue ?? "";
  return styles.gray ?? "";
}

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function brl(value: string): string {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (typeof payload.message === "string") return payload.message;
    if (Array.isArray(payload.message)) return payload.message.join(". ");
  } catch {
    return "Não foi possível concluir a operação.";
  }
  return "Não foi possível concluir a operação.";
}
