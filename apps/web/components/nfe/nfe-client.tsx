"use client";

import type { NfeListResponse, SessionResponse } from "@integrador/contracts";
import {
  Activity,
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Gauge,
  Goal,
  HelpCircle,
  LoaderCircle,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Store,
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
import styles from "./nfe.module.css";

interface Filters {
  numero: string;
  serie: string;
  nome: string;
  envio: string;
  valor: string;
  dataInicial: string;
  dataFinal: string;
  temCodigo: string;
  statusId: string;
  order: string;
  direction: string;
}

const emptyFilters: Filters = {
  numero: "",
  serie: "",
  nome: "",
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
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
      } catch {
        setError(
          "Não foi possível consultar a view_nfe. Confirme a API e o vínculo da empresa com o banco legado.",
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
          const search = new URLSearchParams(window.location.search).get("search")?.trim() ?? "";
          const initial = search ? { ...emptyFilters, ...( /^\d+$/.test(search) ? { numero: search } : { nome: search } ) } : emptyFilters;
          setFilters(initial);
          await requestList(initial);
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
    setFilters(emptyFilters);
    void requestList(emptyFilters, 1);
  }

  function selectStatus(statusId: number | null) {
    const next = { ...filters, statusId: statusId?.toString() ?? "" };
    setFilters(next);
    void requestList(next, 1);
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
      <aside
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
      >
        <Link className={styles.brand} href="/">
          <span>
            <Workflow size={18} />
          </span>
          <div>
            <strong>APBling</strong>
            <small>BLING OPERATIONS</small>
          </div>
        </Link>
        <button className={styles.tenant} type="button" disabled>
          <span>
            <Building2 size={16} />
          </span>
          <div>
            <small>Organização</small>
            <strong>{session.tenant.name}</strong>
          </div>
          <ChevronDown size={14} />
        </button>
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
          <Link href="/app/documents"><Truck size={17} /> Boletos e rastreio</Link>
          <Link href="/app/commercial"><Store size={17} /> Cadastros comerciais</Link>
          <Link href="/app/finance">
            <CircleDollarSign size={17} /> Custos e margem
          </Link>
          <Link href="/app/fiscal"><Percent size={17} /> Custos e tributação</Link>
          <Link href="/app/goals">
            <Goal size={17} /> Metas
          </Link>
          <Link href="/app/operations">
            <Activity size={17} /> Jobs e integrações
          </Link>
          <p>ADMINISTRAÇÃO</p>
          {session.role === "owner" || session.role === "admin" ? <Link href="/app/users">
            <ShieldCheck size={17} /> Usuários e acesso
          </Link> : null}
          <Link href="/app/settings">
            <Settings size={17} /> Configurações
          </Link>
        </nav>
        <div className={styles.sidebarFooter}>
          <span>
            <HelpCircle size={16} /> Central de ajuda
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
          <label className={styles.globalSearch}>
            <Search size={16} />
            <input
              aria-label="Buscar pelo nome do cliente"
              placeholder="Buscar cliente..."
              value={filters.nome}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  nome: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") void requestList(filters, 1);
              }}
            />
            <kbd>⌘ K</kbd>
          </label>
          <span className={styles.dbBadge}>
            <Database size={14} /> PostgreSQL conectado
          </span>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Avisos"
          >
            <Bell size={17} />
          </button>
          <div className={styles.avatar}>{initials(session.user.name)}</div>
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
            <button
              className={styles.refreshButton}
              type="button"
              onClick={() =>
                void requestList(appliedFilters, data?.pagination.page)
              }
              disabled={loading}
            >
              <RefreshCw className={loading ? styles.spin : ""} size={16} />
              Atualizar
            </button>
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

          <section className={styles.tablePanel}>
            <div className={styles.tableHead}>
              <div>
                <strong>Resultado da consulta</strong>
                <span>{data?.pagination.total ?? 0} notas · 50 por página</span>
              </div>
              <span className={styles.readOnly}>READ-ONLY SEGURO</span>
            </div>
            {error ? <div className={styles.error}>{error}</div> : null}
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
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
                      <td className={styles.empty} colSpan={7}>
                        <LoaderCircle className={styles.spin} size={21} />
                        Consultando PostgreSQL...
                      </td>
                    </tr>
                  ) : null}
                  {!loading && data?.items.length === 0 ? (
                    <tr>
                      <td className={styles.empty} colSpan={7}>
                        Nenhuma nota corresponde aos filtros aplicados.
                      </td>
                    </tr>
                  ) : null}
                  {data?.items.map((invoice) => {
                    const pdf = safeHttpUrl(invoice.linkPdf);
                    return (
                      <tr key={invoice.id}>
                        <td>
                          <Link href={`/app/nfe/${invoice.id}`}><strong>#{invoice.numero}</strong></Link>
                          <small>Série {invoice.serie ?? "—"}</small>
                        </td>
                        <td>
                          <strong>{invoice.nome}</strong>
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
                          {invoice.temBoleto ? <small>Com boleto</small> : null}
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
    </main>
  );
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

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
