"use client";

import type {
  GoalDetailResponse,
  GoalListResponse,
  GoalResourcesResponse,
  SessionResponse,
} from "@integrador/contracts";
import {
  Activity,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  Filter,
  Gauge,
  Goal,
  LoaderCircle,
  LogOut,
  Menu,
  Orbit,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  WalletCards,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import { ApplicationSidebar } from "../layout/application-sidebar";
import { ApplicationHeaderActions } from "../layout/application-header-actions";
import { ApplicationGlobalSearch } from "../layout/application-global-search";
import { downloadCsv } from "../../lib/csv";
import shell from "../nfe/nfe.module.css";
import styles from "./goals.module.css";

interface GoalFilters {
  competencia: string;
  dataInicial: string;
  dataFinal: string;
  statusId: string;
}

const emptyFilters: GoalFilters = {
  competencia: "",
  dataInicial: "",
  dataFinal: "",
  statusId: "",
};

interface TargetDraft {
  id: number;
  value: string;
  commissionType: "P" | "R" | null;
  commission: string;
}
interface GoalDraft {
  id: number | null;
  competencia: string;
  dataInicial: string;
  dataFinal: string;
  vendors: TargetDraft[];
  sectors: TargetDraft[];
  costs: Array<{ description: string; value: string }>;
}

function initialGoal(): GoalDraft {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const last = String(
    new Date(year, date.getMonth() + 1, 0).getDate(),
  ).padStart(2, "0");
  return {
    id: null,
    competencia: `${month}/${year}`,
    dataInicial: `${year}-${month}-01`,
    dataFinal: `${year}-${month}-${last}`,
    vendors: [],
    sectors: [],
    costs: [],
  };
}

export function GoalsClient() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [data, setData] = useState<GoalListResponse | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resources, setResources] = useState<GoalResourcesResponse | null>(
    null,
  );
  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [goalAction, setGoalAction] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const requestList = useCallback(
    async (next: GoalFilters, page = 1) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      Object.entries(next).forEach(([key, value]) => {
        if (typeof value === "string" && value) params.set(key, value);
      });
      try {
        const response = await fetch(`${API_URL}/v1/goals?${params}`, {
          credentials: "include",
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("api");
        setData((await response.json()) as GoalListResponse);
        setApplied(next);
      } catch {
        setError("Não foi possível consultar as metas sincronizadas.");
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
          const resourcesResponse = await fetch(`${API_URL}/v1/goals/resources`, {
            credentials: "include",
          });
          if (resourcesResponse.ok && active) {
            setResources(
              (await resourcesResponse.json()) as GoalResourcesResponse,
            );
          }
          await requestList(emptyFilters);
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
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void requestList(filters);
  }

  function chooseStatus(statusId = "") {
    const next = { ...filters, statusId };
    setFilters(next);
    void requestList(next);
  }

  async function openCreate() {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/v1/goals/resources`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("api");
      setResources((await response.json()) as GoalResourcesResponse);
      setGoalDraft(initialGoal());
    } catch {
      setError("Não foi possível carregar vendedores e setores da empresa.");
    }
  }

  async function openEdit(id: number) {
    setGoalAction(`${id}:edit`);
    setError(null);
    try {
      const [resourcesResponse, goalResponse] = await Promise.all([
        fetch(`${API_URL}/v1/goals/resources`, { credentials: "include" }),
        fetch(`${API_URL}/v1/goals/${id}`, { credentials: "include" }),
      ]);
      if (!resourcesResponse.ok || !goalResponse.ok)
        throw new Error(await responseMessage(goalResponse));
      const detail = (await goalResponse.json()) as GoalDetailResponse;
      setResources((await resourcesResponse.json()) as GoalResourcesResponse);
      setGoalDraft({
        id: detail.id,
        competencia: detail.competencia,
        dataInicial: detail.dataInicial,
        dataFinal: detail.dataFinal,
        vendors: detail.vendors,
        sectors: detail.sectors,
        costs: detail.costs,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar a meta.",
      );
    } finally {
      setGoalAction(null);
    }
  }

  async function saveGoal() {
    if (!goalDraft) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/goals${goalDraft.id ? `/${goalDraft.id}` : ""}`,
        {
          method: goalDraft.id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            competencia: goalDraft.competencia,
            dataInicial: goalDraft.dataInicial,
            dataFinal: goalDraft.dataFinal,
            vendors: goalDraft.vendors.map((target) => ({
              ...target,
              value: normalizeMoney(target.value),
              commission: normalizeMoney(target.commission),
            })),
            sectors: goalDraft.sectors.map((target) => ({
              ...target,
              value: normalizeMoney(target.value),
              commission: normalizeMoney(target.commission),
            })),
            costs: goalDraft.costs.map((cost) => ({
              ...cost,
              value: normalizeMoney(cost.value),
            })),
          }),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setData((await response.json()) as GoalListResponse);
      setGoalDraft(null);
      setSuccess(
        goalDraft.id
          ? "Meta atualizada com sua estrutura comercial."
          : "Meta aberta e vinculada à estrutura comercial.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a meta.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeGoal(id: number, action: "finalize" | "cancel") {
    const verb = action === "finalize" ? "finalizar" : "cancelar";
    if (!window.confirm(`Deseja realmente ${verb} a meta #${id}?`)) return;
    setGoalAction(`${id}:${action}`);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/v1/goals/${id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setData((await response.json()) as GoalListResponse);
      setSuccess(
        action === "finalize"
          ? "Meta finalizada e ciclo seguinte preparado automaticamente."
          : "Meta cancelada com sucesso.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível alterar a meta.",
      );
    } finally {
      setGoalAction(null);
    }
  }

  if (!session && loading) {
    return (
      <main className={shell.statePage}>
        <LoaderCircle className={shell.spin} size={28} />
        <h1>Carregando metas</h1>
      </main>
    );
  }
  if (!session) {
    return (
      <main className={shell.statePage}>
        <Goal size={28} />
        <h1>Não foi possível abrir as metas</h1>
        <p>{error}</p>
        <Link href="/login">Voltar ao login</Link>
      </main>
    );
  }

  function exportCurrentPage() {
    if (!data?.items.length) return;
    downloadCsv(
      `metas-pagina-${data.pagination.page}`,
      [
        "Competência",
        "Início",
        "Fim",
        "Status",
        "Meta vendedores",
        "Meta setores",
        "Custo planejado",
        "Vendedores",
        "Setores",
        "Custos",
      ],
      data.items.map((item) => [
        item.competencia,
        item.dataInicial,
        item.dataFinal,
        item.status,
        item.valorMetaVendedores,
        item.valorMetaSetores,
        item.custoPlanejado,
        item.vendedores,
        item.setores,
        item.custos,
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
            <WalletCards size={17} /> Boletos e rastreio
          </Link>
          <Link href="/app/commercial">
            <Workflow size={17} /> Cadastros comerciais
          </Link>
          <Link href="/app/finance">
            <CircleDollarSign size={17} /> Custos e margem
          </Link>
          <Link href="/app/fiscal">
            <Filter size={17} /> Custos e tributação
          </Link>
          <Link className={shell.active} href="/app/goals">
            <Goal size={17} /> Metas
          </Link>
          <Link href="/app/operations">
            <Activity size={17} /> Jobs e integrações
          </Link>
          <p>ADMINISTRAÇÃO</p>
          {session.user.superAdmin ? (
            <Link href="/app/organizations">
              <Building2 size={17} /> Empresas
            </Link>
          ) : null}
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
              <span className={shell.eyebrow}>PLANEJAMENTO · METAS</span>
              <h1>Metas comerciais</h1>
              <p>
                Competências, custos planejados, setores e vendedores
                sincronizados.
              </p>
            </div>
            <div className={styles.actions}>
              <button
                className={shell.refreshButton}
                type="button"
                disabled={!data?.items.length}
                onClick={exportCurrentPage}
              >
                <Download size={15} /> Exportar CSV
              </button>
              {session.permissions.includes("goals:manage") ? (
                <button
                  className={styles.createButton}
                  type="button"
                  onClick={() => void openCreate()}
                >
                  <Plus size={15} /> Nova meta
                </button>
              ) : null}
              <button
                className={shell.refreshButton}
                type="button"
                onClick={() => void requestList(applied, data?.pagination.page)}
              >
                <RefreshCw className={loading ? shell.spin : ""} size={15} />{" "}
                Atualizar
              </button>
            </div>
          </section>

          <section className={styles.statusCards}>
            <button
              className={!applied.statusId ? styles.selected : ""}
              onClick={() => chooseStatus()}
            >
              <span>Todos os ciclos</span>
              <strong>
                {data?.statusCounts.reduce(
                  (sum, status) => sum + status.count,
                  0,
                ) ?? 0}
              </strong>
            </button>
            {data?.statusCounts.map((status) => (
              <button
                className={
                  applied.statusId === String(status.statusId)
                    ? styles.selected
                    : ""
                }
                key={status.statusId}
                onClick={() => chooseStatus(String(status.statusId))}
              >
                <i className={statusClass(status.statusId)} />
                <span>{status.label}</span>
                <strong>{status.count}</strong>
              </button>
            ))}
          </section>

          <form className={shell.filters} onSubmit={submit}>
            <div className={shell.filterHead}>
              <span>
                <Filter size={15} /> Filtros de metas
              </span>
              <button
                type="button"
                onClick={() => {
                  setFilters(emptyFilters);
                  void requestList(emptyFilters);
                }}
              >
                <X size={14} /> Limpar
              </button>
            </div>
            <div className={styles.filtersGrid}>
              <label className={shell.field}>
                <span>Competência</span>
                <select
                  value={filters.competencia}
                  onChange={(event) =>
                    setFilters({ ...filters, competencia: event.target.value })
                  }
                >
                  <option value="">Todas as competências</option>
                  {resources?.competences.map((competence) => (
                    <option key={competence} value={competence}>
                      {competence}
                    </option>
                  ))}
                </select>
              </label>
              <label className={shell.field}>
                <span>Data inicial exata</span>
                <input
                  type="date"
                  value={filters.dataInicial}
                  onChange={(event) =>
                    setFilters({ ...filters, dataInicial: event.target.value })
                  }
                />
              </label>
              <label className={shell.field}>
                <span>Data final exata</span>
                <input
                  type="date"
                  value={filters.dataFinal}
                  onChange={(event) =>
                    setFilters({ ...filters, dataFinal: event.target.value })
                  }
                />
              </label>
              <label className={shell.field}>
                <span>Status</span>
                <select
                  value={filters.statusId}
                  onChange={(event) =>
                    setFilters({ ...filters, statusId: event.target.value })
                  }
                >
                  <option value="">Todos</option>
                  {data?.statusCounts.map((status) => (
                    <option value={status.statusId} key={status.statusId}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className={shell.applyButton} type="submit">
                <Search size={15} /> Filtrar
              </button>
            </div>
          </form>

          {error ? <div className={shell.error}>{error}</div> : null}
          {success ? (
            <div className={styles.success}>
              <Check size={14} /> {success}
            </div>
          ) : null}
          <section className={styles.goalGrid}>
            {loading && !data ? (
              <div className={styles.empty}>
                <LoaderCircle className={shell.spin} /> Consultando metas...
              </div>
            ) : null}
            {!loading && data?.items.length === 0 ? (
              <div className={styles.empty}>
                Nenhuma meta corresponde aos filtros.
              </div>
            ) : null}
            {data?.items.map((goal) => {
              const target =
                Number(goal.valorMetaVendedores) +
                Number(goal.valorMetaSetores);
              const canManage = session.permissions.includes("goals:manage");
              return (
                <article className={styles.goalCard} key={goal.id}>
                  <header>
                    <div>
                      <span>Meta #{goal.id}</span>
                      <h2>{goal.competencia ?? "Sem competência"}</h2>
                    </div>
                    <span
                      className={`${styles.status} ${statusClass(goal.statusId)}`}
                    >
                      {goal.status}
                    </span>
                  </header>
                  <div className={styles.period}>
                    <CalendarDays size={16} />
                    <span>
                      <small>Período</small>
                      {formatDate(goal.dataInicial)} —{" "}
                      {formatDate(goal.dataFinal)}
                    </span>
                  </div>
                  <div className={styles.mainValue}>
                    <small>Meta consolidada</small>
                    <strong>{brl(target)}</strong>
                    <span>Soma dos objetivos por vendedor e setor</span>
                  </div>
                  <div className={styles.breakdown}>
                    <div>
                      <Users size={15} />
                      <span>
                        <small>{goal.vendedores} vendedores</small>
                        <strong>{brl(goal.valorMetaVendedores)}</strong>
                      </span>
                    </div>
                    <div>
                      <Building2 size={15} />
                      <span>
                        <small>{goal.setores} setores</small>
                        <strong>{brl(goal.valorMetaSetores)}</strong>
                      </span>
                    </div>
                    <div>
                      <WalletCards size={15} />
                      <span>
                        <small>{goal.custos} custos</small>
                        <strong>{brl(goal.custoPlanejado)}</strong>
                      </span>
                    </div>
                  </div>
                  <footer>
                    <span>Ciclo registrado no PostgreSQL</span>
                    {canManage && goal.statusId === 1 ? (
                      <div className={styles.goalActions}>
                        <button
                          type="button"
                          onClick={() => void openEdit(goal.id)}
                          disabled={Boolean(goalAction)}
                        >
                          {goalAction === `${goal.id}:edit` ? (
                            <LoaderCircle className={shell.spin} size={13} />
                          ) : (
                            <Pencil size={13} />
                          )}{" "}
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void changeGoal(goal.id, "cancel")}
                          disabled={Boolean(goalAction)}
                        >
                          {goalAction === `${goal.id}:cancel` ? (
                            <LoaderCircle className={shell.spin} size={13} />
                          ) : (
                            <X size={13} />
                          )}{" "}
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => void changeGoal(goal.id, "finalize")}
                          disabled={Boolean(goalAction)}
                        >
                          {goalAction === `${goal.id}:finalize` ? (
                            <LoaderCircle className={shell.spin} size={13} />
                          ) : (
                            <Check size={13} />
                          )}{" "}
                          Finalizar
                        </button>
                      </div>
                    ) : (
                      <ChevronRight size={15} />
                    )}
                  </footer>
                </article>
              );
            })}
          </section>

          <footer className={styles.pagination}>
            <span>
              Página {data?.pagination.page ?? 1} de{" "}
              {data?.pagination.pages || 1}
            </span>
            <div>
              <button
                disabled={!data || data.pagination.page <= 1 || loading}
                onClick={() =>
                  void requestList(applied, data!.pagination.page - 1)
                }
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={
                  !data ||
                  data.pagination.page >= data.pagination.pages ||
                  loading
                }
                onClick={() =>
                  void requestList(applied, data!.pagination.page + 1)
                }
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        </div>
      </section>
      {goalDraft && resources ? (
        <GoalModal
          draft={goalDraft}
          resources={resources}
          saving={saving}
          onChange={setGoalDraft}
          onClose={() => setGoalDraft(null)}
          onSave={saveGoal}
        />
      ) : null}
    </main>
  );
}

function statusClass(id: number): string {
  if (id === 1) return styles.pending ?? "";
  if (id === 2) return styles.done ?? "";
  if (id === 3) return styles.cancelled ?? "";
  return styles.unknown ?? "";
}
function brl(value: string | number): string {
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
function normalizeMoney(value: string): string {
  const normalized = value.replace(",", ".");
  return normalized.includes(".") ? normalized : `${normalized}.00`;
}
async function responseMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return body?.message ?? "Não foi possível concluir a operação.";
}

function GoalModal({
  draft,
  resources,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: GoalDraft;
  resources: GoalResourcesResponse;
  saving: boolean;
  onChange: (value: GoalDraft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  function toggle(
    collection: "vendors" | "sectors",
    id: number,
    enabled: boolean,
  ) {
    const current = draft[collection];
    onChange({
      ...draft,
      [collection]: enabled
        ? [
            ...current,
            {
              id,
              value: "0.00",
              commissionType: null,
              commission: "0.00",
            },
          ]
        : current.filter((item) => item.id !== id),
    });
  }
  function targetValue(
    collection: "vendors" | "sectors",
    id: number,
    value: string,
  ) {
    onChange({
      ...draft,
      [collection]: draft[collection].map((item) =>
        item.id === id ? { ...item, value } : item,
      ),
    });
  }
  return (
    <div className={styles.modalBackdrop} onMouseDown={onClose}>
      <section
        className={styles.modal}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>PLANEJAMENTO COMERCIAL</span>
            <h2>{draft.id ? "Editar meta mensal" : "Nova meta mensal"}</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        <div className={styles.goalForm}>
          <label>
            <span>Competência</span>
            <input
              value={draft.competencia}
              onChange={(event) =>
                onChange({ ...draft, competencia: event.target.value })
              }
            />
          </label>
          <label>
            <span>Data inicial</span>
            <input
              type="date"
              value={draft.dataInicial}
              onChange={(event) =>
                onChange({ ...draft, dataInicial: event.target.value })
              }
            />
          </label>
          <label>
            <span>Data final</span>
            <input
              type="date"
              value={draft.dataFinal}
              onChange={(event) =>
                onChange({ ...draft, dataFinal: event.target.value })
              }
            />
          </label>
        </div>
        <div className={styles.targetColumns}>
          <TargetPicker
            title="Metas por vendedor"
            items={resources.vendors.map((item) => ({
              id: item.id,
              name: item.name,
              detail: item.sector,
            }))}
            selected={draft.vendors}
            onToggle={(id, enabled) => toggle("vendors", id, enabled)}
            onValue={(id, value) => targetValue("vendors", id, value)}
          />
          <TargetPicker
            title="Metas por setor"
            items={resources.sectors.map((item) => ({
              id: item.id,
              name: item.name,
              detail: null,
            }))}
            selected={draft.sectors}
            onToggle={(id, enabled) => toggle("sectors", id, enabled)}
            onValue={(id, value) => targetValue("sectors", id, value)}
          />
        </div>
        <section className={styles.costEditor}>
          <header>
            <div>
              <strong>Custos planejados</strong>
              <small>Valores adicionais vinculados ao ciclo</small>
            </div>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...draft,
                  costs: [...draft.costs, { description: "", value: "0.00" }],
                })
              }
            >
              <Plus size={13} /> Adicionar
            </button>
          </header>
          {draft.costs.map((cost, index) => (
            <div key={index}>
              <input
                placeholder="Descrição"
                value={cost.description}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    costs: draft.costs.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, description: event.target.value }
                        : item,
                    ),
                  })
                }
              />
              <input
                inputMode="decimal"
                value={cost.value}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    costs: draft.costs.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, value: event.target.value }
                        : item,
                    ),
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...draft,
                    costs: draft.costs.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </section>
        <footer>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={
              saving ||
              !draft.competencia ||
              !draft.dataInicial ||
              !draft.dataFinal
            }
            onClick={() => void onSave()}
          >
            {saving ? (
              <LoaderCircle className={shell.spin} size={14} />
            ) : (
              <Check size={14} />
            )}{" "}
            {draft.id ? "Salvar meta" : "Criar meta"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function TargetPicker({
  title,
  items,
  selected,
  onToggle,
  onValue,
}: {
  title: string;
  items: Array<{ id: number; name: string; detail: string | null }>;
  selected: TargetDraft[];
  onToggle: (id: number, enabled: boolean) => void;
  onValue: (id: number, value: string) => void;
}) {
  return (
    <section className={styles.targetPicker}>
      <header>
        <strong>{title}</strong>
        <span>{selected.length} selecionados</span>
      </header>
      <div>
        {items.map((item) => {
          const target = selected.find((entry) => entry.id === item.id);
          return (
            <article key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(target)}
                  onChange={(event) => onToggle(item.id, event.target.checked)}
                />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.detail ?? "Disponível"}</small>
                </span>
              </label>
              {target ? (
                <input
                  inputMode="decimal"
                  aria-label={`Meta de ${item.name}`}
                  value={target.value}
                  onChange={(event) => onValue(item.id, event.target.value)}
                />
              ) : null}
            </article>
          );
        })}
        {items.length === 0 ? <p>Nenhum cadastro disponível.</p> : null}
      </div>
    </section>
  );
}
