"use client";

import type {
  AdminUsersResponse,
  SessionResponse,
  TenantSettingsResponse,
} from "@integrador/contracts";
import {
  Activity,
  Bell,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Gauge,
  Goal,
  HelpCircle,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
  WalletCards,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import shell from "../nfe/nfe.module.css";
import styles from "./administration.module.css";

type Mode = "users" | "settings";
type Role = "owner" | "admin" | "operator" | "viewer";

interface NewUser {
  name: string;
  email: string;
  password: string;
  role: Role;
}

const blankUser: NewUser = {
  name: "",
  email: "",
  password: "",
  role: "operator",
};

export function AdministrationClient({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [settingsData, setSettingsData] =
    useState<TenantSettingsResponse | null>(null);
  const [newUser, setNewUser] = useState<NewUser>(blankUser);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionResponse = await fetch(`${API_URL}/v1/auth/session`, {
        credentials: "include",
      });
      if (sessionResponse.status === 401) {
        router.replace("/login");
        return;
      }
      if (!sessionResponse.ok) throw new Error("session");
      const nextSession = (await sessionResponse.json()) as SessionResponse;
      setSession(nextSession);
      const resource = mode === "users" ? "users" : "settings";
      const response = await fetch(`${API_URL}/v1/administration/${resource}`, {
        credentials: "include",
      });
      if (response.status === 403) throw new Error("forbidden");
      if (!response.ok) throw new Error("api");
      if (mode === "users")
        setUsers((await response.json()) as AdminUsersResponse);
      else setSettingsData((await response.json()) as TenantSettingsResponse);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "forbidden"
          ? "Seu perfil não possui permissão para administrar usuários."
          : "Não foi possível carregar esta área administrativa.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/v1/administration/users`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setUsers((await response.json()) as AdminUsersResponse);
      setNewUser(blankUser);
      setShowCreate(false);
      setSuccess("Usuário criado e vinculado à empresa.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar o usuário.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(
    userId: string,
    input: { role?: Role; active?: boolean },
  ) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/administration/users/${userId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setUsers((await response.json()) as AdminUsersResponse);
      setSuccess("Acesso atualizado.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o acesso.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    if (!settingsData) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/v1/administration/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: settingsData.organization.name,
          brandName: settingsData.organization.brandName,
          taxRegime: settingsData.organization.taxRegime,
          zoom: settingsData.preferences.zoom,
          fixedMenu: settingsData.preferences.fixedMenu,
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setSettingsData((await response.json()) as TenantSettingsResponse);
      setSuccess("Configurações salvas com sucesso.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar as configurações.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function switchTenant(tenantId: string) {
    if (tenantId === session?.tenant.id) return;
    setLoading(true);
    const response = await fetch(`${API_URL}/v1/auth/tenant`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    if (response.ok) {
      router.push("/app/dashboard");
      router.refresh();
    } else {
      setLoading(false);
      setError("Não foi possível trocar de organização.");
    }
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
      <main className={shell.statePage}>
        <LoaderCircle className={shell.spin} size={28} />
        <h1>Carregando administração</h1>
      </main>
    );
  if (!session)
    return (
      <main className={shell.statePage}>
        <LockKeyhole size={28} />
        <h1>Área administrativa indisponível</h1>
        <p>{error}</p>
        <Link href="/app/dashboard">Voltar ao painel</Link>
      </main>
    );
  const canEdit = session.role === "owner" || session.role === "admin";

  return (
    <main className={shell.shell}>
      <aside
        className={`${shell.sidebar} ${menuOpen ? shell.sidebarOpen : ""}`}
      >
        <Link className={shell.brand} href="/">
          <span>
            <Workflow size={18} />
          </span>
          <div>
            <strong>APBling</strong>
            <small>BLING OPERATIONS</small>
          </div>
        </Link>
        <div className={styles.tenantSelect}>
          <span>
            <Building2 size={16} />
          </span>
          <label>
            <small>Organização ativa</small>
            <select
              value={session.tenant.id}
              onChange={(event) => void switchTenant(event.target.value)}
              disabled={loading}
            >
              {session.availableTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <ChevronDown size={14} />
        </div>
        <nav className={shell.nav}>
          <p>OPERAÇÃO</p>
          <Link href="/app/dashboard">
            <Gauge size={17} /> Visão geral
          </Link>
          <Link href="/app/nfe">
            <FileText size={17} /> Notas fiscais
          </Link>
          <Link href="/app/documents">
            <WalletCards size={17} /> Boletos e rastreio
          </Link>
          <Link href="/app/products">
            <Boxes size={17} /> Produtos
          </Link>
          <Link href="/app/people">
            <Users size={17} /> Pessoas
          </Link>
          <Link href="/app/commercial">
            <Building2 size={17} /> Cadastros comerciais
          </Link>
          <Link href="/app/finance">
            <CircleDollarSign size={17} /> Custos e margem
          </Link>
          <Link href="/app/fiscal">
            <Settings size={17} /> Custos e tributação
          </Link>
          <Link href="/app/goals">
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
          {canEdit ? (
            <Link
              className={mode === "users" ? shell.active : ""}
              href="/app/users"
            >
              <ShieldCheck size={17} /> Usuários e acesso
            </Link>
          ) : null}
          <Link
            className={mode === "settings" ? shell.active : ""}
            href="/app/settings"
          >
            <Settings size={17} /> Configurações
          </Link>
        </nav>
        <div className={shell.sidebarFooter}>
          <span>
            <HelpCircle size={16} /> Central de ajuda
          </span>
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
          <div className={styles.topTitle}>
            {mode === "users" ? <UserCog size={16} /> : <Settings size={16} />}
            <span>Administração da empresa</span>
          </div>
          <span className={shell.dbBadge}>
            <KeyRound size={13} /> Perfil: {roleLabel(session.role)}
          </span>
          <button className={shell.iconButton} type="button">
            <Bell size={17} />
          </button>
          <div className={shell.avatar}>{initials(session.user.name)}</div>
        </header>
        <div className={shell.content}>
          <section className={shell.titleRow}>
            <div>
              <span className={shell.eyebrow}>
                {mode === "users"
                  ? "EQUIPE · PAPÉIS E ACESSOS"
                  : "EMPRESA · PREFERÊNCIAS"}
              </span>
              <h1>
                {mode === "users" ? "Usuários e acesso" : "Configurações"}
              </h1>
              <p>
                {mode === "users"
                  ? "Gerencie quem entra na empresa e o nível de permissão de cada pessoa."
                  : "Identidade da organização, regime tributário e experiência do usuário."}
              </p>
            </div>
            {mode === "users" && canEdit ? (
              <button
                className={shell.refreshButton}
                type="button"
                onClick={() => setShowCreate(true)}
              >
                <Plus size={15} /> Adicionar usuário
              </button>
            ) : (
              <button
                className={shell.refreshButton}
                type="button"
                onClick={() => void load()}
              >
                <RefreshCw className={loading ? shell.spin : ""} size={15} />{" "}
                Atualizar
              </button>
            )}
          </section>
          {error ? <div className={styles.feedbackError}>{error}</div> : null}
          {success ? (
            <div className={styles.feedbackSuccess}>
              <Check size={14} /> {success}
            </div>
          ) : null}
          {mode === "users" ? (
            <UsersView
              data={users}
              currentUserId={session.user.id}
              saving={saving}
              onUpdate={updateUser}
            />
          ) : (
            <SettingsView
              data={settingsData}
              canEdit={canEdit}
              saving={saving}
              onChange={setSettingsData}
              onSave={saveSettings}
            />
          )}
        </div>
      </section>

      {showCreate ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={() => setShowCreate(false)}
        >
          <section
            className={styles.modal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>NOVO ACESSO</span>
                <h2>Adicionar usuário</h2>
              </div>
              <button type="button" onClick={() => setShowCreate(false)}>
                <X size={17} />
              </button>
            </header>
            <div className={styles.formGrid}>
              <label>
                <span>Nome completo</span>
                <input
                  value={newUser.name}
                  onChange={(event) =>
                    setNewUser({ ...newUser, name: event.target.value })
                  }
                />
              </label>
              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(event) =>
                    setNewUser({ ...newUser, email: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Senha inicial</span>
                <input
                  type="password"
                  minLength={10}
                  value={newUser.password}
                  onChange={(event) =>
                    setNewUser({ ...newUser, password: event.target.value })
                  }
                />
                <small>Mínimo de 10 caracteres</small>
              </label>
              <label>
                <span>Papel</span>
                <select
                  value={newUser.role}
                  onChange={(event) =>
                    setNewUser({ ...newUser, role: event.target.value as Role })
                  }
                >
                  <option value="viewer">Visualização</option>
                  <option value="operator">Operador</option>
                  <option value="admin">Administrador</option>
                  {session.role === "owner" ? (
                    <option value="owner">Proprietário</option>
                  ) : null}
                </select>
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setShowCreate(false)}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void createUser()}
                disabled={
                  saving ||
                  !newUser.name ||
                  !newUser.email ||
                  newUser.password.length < 10
                }
              >
                {saving ? (
                  <LoaderCircle className={shell.spin} size={14} />
                ) : (
                  <Plus size={14} />
                )}{" "}
                Criar usuário
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function UsersView({
  data,
  currentUserId,
  saving,
  onUpdate,
}: {
  data: AdminUsersResponse | null;
  currentUserId: string;
  saving: boolean;
  onUpdate: (
    id: string,
    input: { role?: Role; active?: boolean },
  ) => Promise<void>;
}) {
  return (
    <>
      <section className={styles.metrics}>
        <Metric
          icon={<Users />}
          label="Pessoas vinculadas"
          value={data?.counts.total ?? 0}
        />
        <Metric
          icon={<UserCheck />}
          label="Acessos ativos"
          value={data?.counts.active ?? 0}
        />
        <Metric
          icon={<ShieldCheck />}
          label="Administradores"
          value={data?.counts.administrators ?? 0}
        />
      </section>
      <section className={styles.userPanel}>
        <header>
          <div>
            <strong>Equipe da organização</strong>
            <span>
              Alterações de papel e status são registradas na auditoria.
            </span>
          </div>
          <b>{data?.items.length ?? 0} USUÁRIOS</b>
        </header>
        <div className={styles.userList}>
          {data?.items.map((user) => (
            <article className={styles.userRow} key={user.id}>
              <div className={styles.userAvatar}>{initials(user.name)}</div>
              <div className={styles.userIdentity}>
                <strong>
                  {user.name}
                  {user.id === currentUserId ? <em>VOCÊ</em> : null}
                </strong>
                <span>{user.email}</span>
                <small>Desde {formatDate(user.joinedAt)}</small>
              </div>
              <label>
                <span>Papel</span>
                <select
                  value={user.role}
                  disabled={saving}
                  onChange={(event) =>
                    void onUpdate(user.id, { role: event.target.value as Role })
                  }
                >
                  <option value="viewer">Visualização</option>
                  <option value="operator">Operador</option>
                  <option value="admin">Administrador</option>
                  <option value="owner">Proprietário</option>
                </select>
              </label>
              <button
                className={`${styles.statusButton} ${user.active ? styles.statusActive : ""}`}
                type="button"
                disabled={saving || user.id === currentUserId}
                onClick={() => void onUpdate(user.id, { active: !user.active })}
              >
                <i /> {user.active ? "Ativo" : "Inativo"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SettingsView({
  data,
  canEdit,
  saving,
  onChange,
  onSave,
}: {
  data: TenantSettingsResponse | null;
  canEdit: boolean;
  saving: boolean;
  onChange: (data: TenantSettingsResponse) => void;
  onSave: () => Promise<void>;
}) {
  if (!data)
    return (
      <section className={styles.loadingPanel}>
        <LoaderCircle className={shell.spin} size={22} /> Carregando
        configurações...
      </section>
    );
  const organization = data.organization;
  return (
    <div className={styles.settingsGrid}>
      <section className={styles.settingsCard}>
        <header>
          <span>
            <Building2 size={17} />
          </span>
          <div>
            <strong>Identidade da empresa</strong>
            <small>Informações exibidas no produto e no contexto ativo.</small>
          </div>
        </header>
        <div className={styles.formGrid}>
          <label>
            <span>Razão social / nome</span>
            <input
              disabled={!canEdit}
              value={organization.name}
              onChange={(event) =>
                onChange({
                  ...data,
                  organization: { ...organization, name: event.target.value },
                })
              }
            />
          </label>
          <label>
            <span>Nome da marca</span>
            <input
              disabled={!canEdit}
              value={organization.brandName ?? ""}
              onChange={(event) =>
                onChange({
                  ...data,
                  organization: {
                    ...organization,
                    brandName: event.target.value || null,
                  },
                })
              }
              placeholder="APBling"
            />
          </label>
          <label>
            <span>Identificador</span>
            <input disabled value={organization.slug} />
          </label>
          <label>
            <span>Unidade legada</span>
            <input disabled value={`#${organization.legacyUnitId}`} />
          </label>
        </div>
      </section>
      <section className={styles.settingsCard}>
        <header>
          <span>
            <CircleDollarSign size={17} />
          </span>
          <div>
            <strong>Regime tributário</strong>
            <small>
              Parâmetro utilizado pelos cálculos financeiros do legado.
            </small>
          </div>
        </header>
        <label className={styles.wideField}>
          <span>Regime vigente</span>
          <select
            disabled={!canEdit}
            value={organization.taxRegime ?? ""}
            onChange={(event) =>
              onChange({
                ...data,
                organization: {
                  ...organization,
                  taxRegime: event.target.value || null,
                },
              })
            }
          >
            <option value="">Não informado</option>
            <option value="Simples Nacional">Simples Nacional</option>
            <option value="Lucro Presumido">Lucro Presumido</option>
          </select>
        </label>
        <div className={styles.infoBox}>
          <LockKeyhole size={15} />
          <p>
            Alterar este campo afeta o contexto de cálculos futuros. Valores já
            processados permanecem persistidos nas NF-e.
          </p>
        </div>
      </section>
      <section className={styles.settingsCard}>
        <header>
          <span>
            <Settings size={17} />
          </span>
          <div>
            <strong>Experiência do usuário</strong>
            <small>
              Compatível com as preferências pessoais do sistema legado.
            </small>
          </div>
        </header>
        <label className={styles.rangeField}>
          <span>
            Escala da interface <b>{data.preferences.zoom}%</b>
          </span>
          <input
            type="range"
            min="75"
            max="125"
            step="5"
            disabled={!canEdit}
            value={data.preferences.zoom}
            onChange={(event) =>
              onChange({
                ...data,
                preferences: {
                  ...data.preferences,
                  zoom: Number(event.target.value),
                },
              })
            }
          />
        </label>
        <label className={styles.switchField}>
          <div>
            <strong>Menu lateral fixado</strong>
            <small>Mantém a navegação sempre visível em telas amplas.</small>
          </div>
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={data.preferences.fixedMenu}
            onChange={(event) =>
              onChange({
                ...data,
                preferences: {
                  ...data.preferences,
                  fixedMenu: event.target.checked,
                },
              })
            }
          />
        </label>
      </section>
      <section className={styles.settingsCard}>
        <header>
          <span>
            <Workflow size={17} />
          </span>
          <div>
            <strong>Recursos da empresa</strong>
            <small>Flags provisionadas para este tenant.</small>
          </div>
        </header>
        <div className={styles.flagList}>
          {data.featureFlags.length ? (
            data.featureFlags.map((flag) => (
              <div key={flag.key}>
                <span>{flag.key}</span>
                <b className={flag.enabled ? styles.flagOn : ""}>
                  {flag.enabled ? "HABILITADO" : "DESABILITADO"}
                </b>
              </div>
            ))
          ) : (
            <p>Nenhum recurso adicional provisionado.</p>
          )}
        </div>
      </section>
      <footer className={styles.saveBar}>
        <div>
          <ShieldCheck size={17} />
          <span>
            {canEdit
              ? "Você pode editar as configurações desta empresa."
              : "Seu perfil possui acesso somente para leitura."}
          </span>
        </div>
        {canEdit ? (
          <button type="button" disabled={saving} onClick={() => void onSave()}>
            {saving ? (
              <LoaderCircle className={shell.spin} size={15} />
            ) : (
              <Save size={15} />
            )}{" "}
            Salvar alterações
          </button>
        ) : null}
      </footer>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <article>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
function roleLabel(role: Role): string {
  return {
    owner: "Proprietário",
    admin: "Administrador",
    operator: "Operador",
    viewer: "Visualização",
  }[role];
}
function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(value),
  );
}
async function responseMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return body?.message ?? "Não foi possível concluir a operação.";
}
