"use client";

import type {
  AccessProfilesResponse,
  AdminUsersResponse,
  ModulePermission,
  SessionResponse,
  TenantSettingsResponse,
} from "@integrador/contracts";
import {
  Activity,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileText,
  Gauge,
  Goal,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Orbit,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  Trash2,
  WalletCards,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import { homeRoute } from "../../lib/home-route";
import { ApplicationSidebar } from "../layout/application-sidebar";
import { ApplicationHeaderActions } from "../layout/application-header-actions";
import { ApplicationGlobalSearch } from "../layout/application-global-search";
import { downloadCsv } from "../../lib/csv";
import shell from "../nfe/nfe.module.css";
import styles from "./administration.module.css";

type Mode = "users" | "settings";

interface NewUser {
  name: string;
  email: string;
  password: string;
  accessProfileId: string;
  tenantIds: string[];
}

type ManagedUser = AdminUsersResponse["items"][number];
type UserUpdateInput = {
  name?: string;
  email?: string;
  password?: string;
  active?: boolean;
  accessProfileId?: string;
  tenantIds?: string[];
};

const blankUser: NewUser = {
  name: "",
  email: "",
  password: "",
  accessProfileId: "",
  tenantIds: [],
};

const permissionGroups: Array<{
  label: string;
  items: Array<{ key: ModulePermission; name: string; description: string }>;
}> = [
  {
    label: "Operacional",
    items: [
      {
        key: "nfe:view",
        name: "NF-e",
        description: "Consulta notas fiscais e detalhes.",
      },
      {
        key: "nfe:manage",
        name: "Operar NF-e",
        description: "Sincroniza, normaliza e envia documentos.",
      },
      {
        key: "products:view",
        name: "Produtos",
        description: "Consulta catálogo e grupos de produtos.",
      },
      {
        key: "products:manage",
        name: "Gerenciar produtos",
        description: "Altera vínculos e dados operacionais de produtos.",
      },
      {
        key: "people:view",
        name: "Pessoas",
        description: "Consulta clientes e contatos.",
      },
      {
        key: "people:manage",
        name: "Gerenciar pessoas",
        description: "Altera preferências operacionais de contatos.",
      },
      {
        key: "documents:view",
        name: "Boletos e rastreamento",
        description: "Consulta cobranças e entregas.",
      },
      {
        key: "operations:view",
        name: "Jobs / Operações",
        description: "Acompanha filas e sincronizações.",
      },
      {
        key: "operations:manage",
        name: "Executar sincronizações",
        description: "Cria jobs e altera a automação.",
      },
    ],
  },
  {
    label: "Comercial",
    items: [
      {
        key: "commercial:view",
        name: "Cadastros comerciais",
        description: "Consulta vendedores, setores e pedidos.",
      },
      {
        key: "commercial:manage",
        name: "Gerenciar comercial",
        description: "Altera cadastros e responsáveis.",
      },
      {
        key: "goals:view",
        name: "Metas",
        description: "Consulta metas comerciais.",
      },
      {
        key: "goals:manage",
        name: "Gerenciar metas",
        description: "Cria e encerra metas.",
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      {
        key: "dashboard:view",
        name: "Dashboard Executivo",
        description: "Visualiza faturamento, lucro e indicadores estratégicos.",
      },
      {
        key: "finance:view",
        name: "Financeiro / Lucro",
        description: "Visualiza valores, custos, lucro e margem.",
      },
      {
        key: "marketplace-fees:view",
        name: "Taxas Mercado Livre",
        description:
          "Consulta comissão, frete e descontos das vendas do Mercado Livre.",
      },
      {
        key: "costs:view",
        name: "Custos",
        description: "Consulta custos e metas financeiras.",
      },
      {
        key: "tax:view",
        name: "Tributação",
        description: "Consulta regras e informações tributárias.",
      },
      {
        key: "costs:manage",
        name: "Gerenciar custos",
        description: "Altera custos e parâmetros financeiros.",
      },
      {
        key: "tax:manage",
        name: "Gerenciar tributação",
        description: "Altera regras tributárias.",
      },
    ],
  },
  {
    label: "Administração",
    items: [
      {
        key: "integrations:manage",
        name: "Integrações",
        description: "Configura Bling, APChat e canais externos.",
      },
      {
        key: "imports:manage",
        name: "Importação inteligente",
        description:
          "Importa e atualiza dados por CSV com mapeamento de colunas.",
      },
      {
        key: "settings:view",
        name: "Configurações",
        description: "Consulta preferências da empresa.",
      },
      {
        key: "settings:manage",
        name: "Gerenciar configurações",
        description: "Altera dados e preferências da empresa.",
      },
      {
        key: "users:manage",
        name: "Administração de usuários",
        description: "Gerencia usuários, perfis de acesso e permissões.",
      },
    ],
  },
];

export function AdministrationClient({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [profiles, setProfiles] = useState<AccessProfilesResponse | null>(null);
  const [settingsData, setSettingsData] =
    useState<TenantSettingsResponse | null>(null);
  const [newUser, setNewUser] = useState<NewUser>(blankUser);
  const [showCreate, setShowCreate] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({
    name: "",
    description: "",
    permissions: [] as ModulePermission[],
  });
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editUser, setEditUser] = useState<NewUser | null>(null);
  const [removingUser, setRemovingUser] = useState<ManagedUser | null>(null);
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
      if (mode === "users") {
        const [usersResponse, profilesResponse] = await Promise.all([
          fetch(`${API_URL}/v1/administration/users`, {
            credentials: "include",
          }),
          fetch(`${API_URL}/v1/administration/access-profiles`, {
            credentials: "include",
          }),
        ]);
        if (usersResponse.status === 403 || profilesResponse.status === 403)
          throw new Error("forbidden");
        if (!usersResponse.ok || !profilesResponse.ok) throw new Error("api");
        setUsers((await usersResponse.json()) as AdminUsersResponse);
        setProfiles((await profilesResponse.json()) as AccessProfilesResponse);
      } else {
        const response = await fetch(`${API_URL}/v1/administration/settings`, {
          credentials: "include",
        });
        if (response.status === 403) throw new Error("forbidden");
        if (!response.ok) throw new Error("api");
        setSettingsData((await response.json()) as TenantSettingsResponse);
      }
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
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          accessProfileId: newUser.accessProfileId,
          tenantIds: newUser.tenantIds,
        }),
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

  function openNewProfile() {
    setEditingProfileId(null);
    setProfileDraft({ name: "", description: "", permissions: [] });
    setShowProfiles(true);
  }

  function openEditProfile(profile: AccessProfilesResponse["items"][number]) {
    setEditingProfileId(profile.id);
    setProfileDraft({
      name: profile.name,
      description: profile.description ?? "",
      permissions: profile.permissions,
    });
    setShowProfiles(true);
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/administration/access-profiles${editingProfileId ? `/${editingProfileId}` : ""}`,
        {
          method: editingProfileId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...profileDraft,
            description: profileDraft.description.trim() || null,
          }),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setProfiles((await response.json()) as AccessProfilesResponse);
      setEditingProfileId(null);
      setProfileDraft({ name: "", description: "", permissions: [] });
      setSuccess("Perfil de acesso salvo.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeProfile(profileId: string) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/administration/access-profiles/${profileId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setProfiles((await response.json()) as AccessProfilesResponse);
      if (editingProfileId === profileId) {
        setEditingProfileId(null);
        setProfileDraft({ name: "", description: "", permissions: [] });
      }
      setSuccess(
        "Perfil de acesso removido. Usuários já vinculados mantêm os módulos atuais.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível remover o perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(
    userId: string,
    input: UserUpdateInput,
  ): Promise<boolean> {
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
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o acesso.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(user: ManagedUser) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/administration/users/${user.id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setUsers((await response.json()) as AdminUsersResponse);
      setRemovingUser(null);
      setSuccess(`${user.name} n\u00e3o possui mais acesso a esta empresa.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "N\u00e3o foi poss\u00edvel remover o acesso do usu\u00e1rio.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openEditUser(user: ManagedUser) {
    setEditingUser(user);
    setEditUser({
      name: user.name,
      email: user.email,
      password: "",
      accessProfileId: user.accessProfileId,
      tenantIds: user.tenantIds,
    });
  }

  async function saveEditedUser() {
    if (!editingUser || !editUser) return;
    const saved = await updateUser(editingUser.id, {
      name: editUser.name.trim(),
      email: editUser.email.trim(),
      ...(editUser.password ? { password: editUser.password } : {}),
      active: editingUser.active,
      accessProfileId: editUser.accessProfileId,
      tenantIds: editUser.tenantIds,
    });
    if (saved) {
      setEditingUser(null);
      setEditUser(null);
      setSuccess("Dados e perfil de acesso atualizados.");
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
          ...(session?.permissions.includes("settings:manage")
            ? {
                name: settingsData.organization.name,
                brandName: settingsData.organization.brandName,
                taxRegime: settingsData.organization.taxRegime,
              }
            : {}),
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
    if (!session || tenantId === session.tenant.id) return;
    setLoading(true);
    const response = await fetch(`${API_URL}/v1/auth/tenant`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    if (response.ok) {
      const tenant = session.availableTenants.find(
        (item) => item.id === tenantId,
      );
      router.push(
        tenant
          ? homeRoute({ user: session.user, permissions: tenant.permissions })
          : "/app/nfe",
      );
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

  function exportUsers() {
    if (!users?.items.length) return;
    downloadCsv(
      "usuarios-e-acessos",
      ["Nome", "E-mail", "Perfil de acesso", "Status", "Vinculado em"],
      users.items.map((user) => [
        user.name,
        user.email,
        user.accessProfileName,
        user.active ? "Ativo" : "Inativo",
        user.joinedAt,
      ]),
    );
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
        <Link href={session ? homeRoute(session) : "/login"}>
          Voltar ao painel
        </Link>
      </main>
    );
  const canEdit =
    mode === "users"
      ? session.permissions.includes("users:manage")
      : session.permissions.includes("settings:manage");

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
                  : "Identidade da organização e experiência do usuário."}
              </p>
            </div>
            {mode === "users" && canEdit ? (
              <div className={styles.titleActions}>
                <button
                  className={shell.refreshButton}
                  type="button"
                  disabled={!users?.items.length}
                  onClick={exportUsers}
                >
                  <Download size={15} /> Exportar CSV
                </button>
                <button
                  className={shell.refreshButton}
                  type="button"
                  onClick={() => setShowProfiles(true)}
                >
                  <ShieldCheck size={15} /> Perfis de acesso
                </button>
                <button
                  className={shell.refreshButton}
                  type="button"
                  onClick={() => {
                    setNewUser({
                      ...blankUser,
                      tenantIds: [session.tenant.id],
                    });
                    setShowCreate(true);
                  }}
                >
                  <Plus size={15} /> Adicionar usuário
                </button>
              </div>
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
              onEdit={openEditUser}
              onRemove={setRemovingUser}
            />
          ) : (
            <SettingsView
              data={settingsData}
              canEditOrganization={canEdit}
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
                <span>Perfil de acesso</span>
                <select
                  value={newUser.accessProfileId ?? ""}
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      accessProfileId: event.target.value,
                    })
                  }
                >
                  <option value="">Selecione um perfil</option>
                  {profiles?.items.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                <small>Os módulos do perfil são aplicados ao criar.</small>
              </label>
              <fieldset className={styles.unitPicker}>
                <legend>Unidades com acesso</legend>
                {session.availableTenants.map((tenant) => (
                  <label key={tenant.id}>
                    <input
                      type="checkbox"
                      checked={newUser.tenantIds.includes(tenant.id)}
                      onChange={(event) =>
                        setNewUser({
                          ...newUser,
                          tenantIds: event.target.checked
                            ? [...newUser.tenantIds, tenant.id]
                            : newUser.tenantIds.filter(
                                (id) => id !== tenant.id,
                              ),
                        })
                      }
                    />
                    <span>{tenant.name}</span>
                  </label>
                ))}
                <small>Mesmo perfil será aplicado em cada unidade.</small>
              </fieldset>
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
                  !newUser.accessProfileId ||
                  newUser.tenantIds.length === 0 ||
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
      {showProfiles ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={() => setShowProfiles(false)}
        >
          <section
            className={`${styles.modal} ${styles.profileModal}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>CONFIGURAÇÃO REUTILIZÁVEL</span>
                <h2>Perfis de acesso</h2>
              </div>
              <button type="button" onClick={() => setShowProfiles(false)}>
                <X size={17} />
              </button>
            </header>
            <p className={styles.modalIntro}>
              Crie perfis próprios da empresa e defina os módulos de cada um. No
              cadastro do usuário, basta selecionar o perfil desejado.
            </p>
            <div className={styles.profileManager}>
              <aside className={styles.profileListPanel}>
                <div className={styles.profileListHeader}>
                  <div>
                    <strong>Perfis salvos</strong>
                    <span>{profiles?.items.length ?? 0} configurados</span>
                  </div>
                </div>
                <button
                  className={styles.newProfileAction}
                  type="button"
                  onClick={openNewProfile}
                >
                  <Plus size={14} /> Novo perfil
                </button>
                <div className={styles.profileList}>
                  {profiles?.items.length ? (
                    profiles.items.map((profile) => (
                      <article
                        className={`${styles.savedProfile} ${editingProfileId === profile.id ? styles.savedProfileActive : ""}`}
                        key={profile.id}
                      >
                        <div>
                          <strong>{profile.name}</strong>
                          <span>{profile.description || "Sem descrição"}</span>
                          <small>
                            {profile.permissions.length} módulos ·{" "}
                            {profile.assignedUsers} usuários
                          </small>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => openEditProfile(profile)}
                          >
                            <Pencil size={13} /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeProfile(profile.id)}
                            disabled={saving}
                          >
                            <Trash2 size={13} /> Excluir
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className={styles.emptyProfiles}>
                      <ShieldCheck size={22} />
                      <strong>Nenhum perfil criado</strong>
                      <span>
                        Crie um perfil para reutilizar a mesma configuração em
                        vários usuários.
                      </span>
                    </div>
                  )}
                </div>
              </aside>
              <section className={styles.profileEditor}>
                <header className={styles.profileEditorHeader}>
                  <div>
                    <span>
                      {editingProfileId ? "EDITANDO PERFIL" : "NOVO PERFIL"}
                    </span>
                    <strong>
                      {editingProfileId
                        ? profileDraft.name || "Perfil sem nome"
                        : "Configure um novo acesso"}
                    </strong>
                  </div>
                  <button
                    className={styles.saveProfileAction}
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={saving || profileDraft.name.trim().length < 2}
                  >
                    <Save size={14} />{" "}
                    {editingProfileId ? "Salvar alterações" : "Criar perfil"}
                  </button>
                </header>
                <div className={styles.profileFields}>
                  <label>
                    <span>Nome do perfil</span>
                    <input
                      value={profileDraft.name}
                      onChange={(event) =>
                        setProfileDraft({
                          ...profileDraft,
                          name: event.target.value,
                        })
                      }
                      placeholder="Ex.: Expedição"
                    />
                  </label>
                  <label>
                    <span>Descrição</span>
                    <input
                      value={profileDraft.description}
                      onChange={(event) =>
                        setProfileDraft({
                          ...profileDraft,
                          description: event.target.value,
                        })
                      }
                      placeholder="Ex.: Acesso da equipe que separa e envia pedidos"
                    />
                  </label>
                </div>
                <PermissionPicker
                  value={profileDraft.permissions}
                  disabled={saving}
                  onChange={(permissions) =>
                    setProfileDraft({ ...profileDraft, permissions })
                  }
                />
              </section>
            </div>
          </section>
        </div>
      ) : null}
      {editingUser && editUser ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={() => {
            setEditingUser(null);
            setEditUser(null);
          }}
        >
          <section
            className={styles.modal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>GERENCIAR ACESSO</span>
                <h2>Editar usuário</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setEditUser(null);
                }}
              >
                <X size={17} />
              </button>
            </header>
            <div className={styles.formGrid}>
              <label>
                <span>Nome completo</span>
                <input
                  value={editUser.name}
                  onChange={(event) =>
                    setEditUser({ ...editUser, name: event.target.value })
                  }
                />
              </label>
              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  value={editUser.email}
                  onChange={(event) =>
                    setEditUser({ ...editUser, email: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Nova senha</span>
                <input
                  type="password"
                  minLength={10}
                  value={editUser.password}
                  onChange={(event) =>
                    setEditUser({ ...editUser, password: event.target.value })
                  }
                />
                <small>Deixe em branco para manter a senha atual.</small>
              </label>
              <label>
                <span>Perfil de acesso</span>
                <select
                  value={editUser.accessProfileId ?? ""}
                  onChange={(event) =>
                    setEditUser({
                      ...editUser,
                      accessProfileId: event.target.value,
                    })
                  }
                >
                  <option value="">Selecione um perfil</option>
                  {profiles?.items.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className={styles.unitPicker}>
                <legend>Unidades com acesso</legend>
                {session.availableTenants.map((tenant) => (
                  <label key={tenant.id}>
                    <input
                      type="checkbox"
                      checked={editUser.tenantIds.includes(tenant.id)}
                      disabled={
                        editingUser.id === session.user.id &&
                        tenant.id === session.tenant.id
                      }
                      onChange={(event) =>
                        setEditUser({
                          ...editUser,
                          tenantIds: event.target.checked
                            ? [...editUser.tenantIds, tenant.id]
                            : editUser.tenantIds.filter(
                                (id) => id !== tenant.id,
                              ),
                        })
                      }
                    />
                    <span>{tenant.name}</span>
                  </label>
                ))}
                <small>
                  Ao remover, vínculo desta pessoa com a unidade será excluído.
                </small>
              </fieldset>
            </div>
            <p className={styles.identityNotice}>
              Nome, e-mail e senha são da identidade do usuário. A alteração é
              aplicada aos vínculos que ele possui com outras empresas.
            </p>
            <footer>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setEditUser(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveEditedUser()}
                disabled={
                  saving ||
                  !editUser.name.trim() ||
                  !editUser.email.trim() ||
                  !editUser.accessProfileId ||
                  editUser.tenantIds.length === 0 ||
                  (editUser.password.length > 0 &&
                    editUser.password.length < 10)
                }
              >
                {saving ? (
                  <LoaderCircle className={shell.spin} size={14} />
                ) : (
                  <Save size={14} />
                )}{" "}
                Salvar alterações
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {removingUser ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={() => setRemovingUser(null)}
        >
          <section
            className={`${styles.modal} ${styles.dangerDialog}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>REMOVER ACESSO</span>
                <h2>Confirmar remoção</h2>
              </div>
              <button type="button" onClick={() => setRemovingUser(null)}>
                <X size={17} />
              </button>
            </header>
            <p>
              Remover <strong>{removingUser.name}</strong> desta empresa? A
              conta não será apagada e poderá ser vinculada novamente depois.
            </p>
            <footer>
              <button type="button" onClick={() => setRemovingUser(null)}>
                Cancelar
              </button>
              <button
                className={styles.removeConfirm}
                type="button"
                disabled={saving}
                onClick={() => void removeUser(removingUser)}
              >
                <Trash2 size={14} /> Remover acesso
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
  onEdit,
  onRemove,
}: {
  data: AdminUsersResponse | null;
  currentUserId: string;
  saving: boolean;
  onUpdate: (id: string, input: UserUpdateInput) => Promise<boolean>;
  onEdit: (user: ManagedUser) => void;
  onRemove: (user: ManagedUser) => void;
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
              Alterações de perfil de acesso e status são registradas na
              auditoria.
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
              <div className={styles.userAccess}>
                <span>{user.accessProfileName}</span>
                <small>
                  {user.permissions.length === 24
                    ? "Acesso completo"
                    : `${user.permissions.length} módulos`}
                </small>
              </div>
              <div className={styles.userActions}>
                <button
                  className={styles.editAction}
                  type="button"
                  disabled={saving}
                  onClick={() => onEdit(user)}
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  className={`${styles.statusButton} ${user.active ? styles.statusActive : ""}`}
                  type="button"
                  disabled={saving || user.id === currentUserId}
                  onClick={() =>
                    void onUpdate(user.id, { active: !user.active })
                  }
                >
                  <i /> {user.active ? "Ativo" : "Inativo"}
                </button>
                <button
                  className={styles.removeAction}
                  type="button"
                  disabled={saving || user.id === currentUserId}
                  onClick={() => onRemove(user)}
                  aria-label={`Remover acesso de ${user.name}`}
                  title="Remover acesso desta empresa"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function PermissionPicker({
  value,
  onChange,
  disabled = false,
  hidden = false,
}: {
  value: ModulePermission[];
  onChange: (value: ModulePermission[]) => void;
  disabled?: boolean;
  hidden?: boolean;
}) {
  const allPermissions = permissionGroups.flatMap((group) =>
    group.items.map((item) => item.key),
  );
  const toggle = (permission: ModulePermission) =>
    onChange(
      value.includes(permission)
        ? value.filter((item) => item !== permission)
        : [...value, permission],
    );
  return (
    <section
      className={styles.permissionPicker}
      hidden={hidden}
      aria-label="Acesso aos módulos"
    >
      <header>
        <div>
          <strong>Acesso aos módulos</strong>
          <span>Marque somente as áreas que este perfil poderá acessar.</span>
        </div>
        <div className={styles.permissionActions}>
          <b>
            {value.length} de {allPermissions.length}
          </b>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(allPermissions)}
          >
            Selecionar todos
          </button>
          <button
            type="button"
            disabled={disabled || value.length === 0}
            onClick={() => onChange([])}
          >
            Limpar
          </button>
        </div>
      </header>
      <div className={styles.permissionGroups}>
        {permissionGroups.map((group) => (
          <fieldset key={group.label}>
            <legend>{group.label}</legend>
            {group.items.map((item) => (
              <label key={item.key}>
                <input
                  type="checkbox"
                  checked={value.includes(item.key)}
                  disabled={disabled}
                  onChange={() => toggle(item.key)}
                />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </section>
  );
}

function SettingsView({
  data,
  canEditOrganization,
  saving,
  onChange,
  onSave,
}: {
  data: TenantSettingsResponse | null;
  canEditOrganization: boolean;
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
              disabled={!canEditOrganization}
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
              disabled={!canEditOrganization}
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
            <span>Regime tributário</span>
            <select
              disabled={!canEditOrganization}
              value={organization.taxRegime}
              onChange={(event) =>
                onChange({
                  ...data,
                  organization: {
                    ...organization,
                    taxRegime: event.target.value as
                      "Lucro Presumido" | "Simples Nacional",
                  },
                })
              }
            >
              <option value="Lucro Presumido">Lucro Presumido</option>
              <option value="Simples Nacional">Simples Nacional</option>
            </select>
            <small>
              Define a regra fiscal usada no cálculo das NF-e desta unidade.
            </small>
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
            value={data.preferences.zoom}
            onChange={(event) => {
              const preferences = {
                ...data.preferences,
                zoom: Number(event.target.value),
              };
              window.dispatchEvent(
                new CustomEvent("app-preferences", { detail: preferences }),
              );
              onChange({
                ...data,
                preferences,
              });
            }}
          />
        </label>
        <label className={styles.switchField}>
          <div>
            <strong>Menu lateral fixado</strong>
            <small>Mantém a navegação sempre visível em telas amplas.</small>
          </div>
          <input
            type="checkbox"
            checked={data.preferences.fixedMenu}
            onChange={(event) => {
              const preferences = {
                ...data.preferences,
                fixedMenu: event.target.checked,
              };
              window.dispatchEvent(
                new CustomEvent("app-preferences", { detail: preferences }),
              );
              onChange({
                ...data,
                preferences,
              });
            }}
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
      <PasswordCard />
      <footer className={styles.saveBar}>
        <div>
          <ShieldCheck size={17} />
          <span>
            {canEditOrganization
              ? "Você pode editar a empresa e suas preferências pessoais."
              : "Preferências pessoais podem ser alteradas sem modificar a empresa."}
          </span>
        </div>
        <button type="button" disabled={saving} onClick={() => void onSave()}>
          {saving ? (
            <LoaderCircle className={shell.spin} size={15} />
          ) : (
            <Save size={15} />
          )}{" "}
          Salvar alterações
        </button>
      </footer>
    </div>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [changing, setChanging] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function changePassword() {
    if (newPassword !== confirmation) {
      setFeedback("A confirmação não corresponde à nova senha.");
      return;
    }
    setChanging(true);
    setFeedback(null);
    try {
      const response = await fetch(`${API_URL}/v1/auth/password`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setFeedback("Senha alterada. As outras sessões foram encerradas.");
    } catch (cause) {
      setFeedback(
        cause instanceof Error
          ? cause.message
          : "Não foi possível alterar a senha.",
      );
    } finally {
      setChanging(false);
    }
  }

  return (
    <section className={styles.settingsCard}>
      <header>
        <span>
          <KeyRound size={17} />
        </span>
        <div>
          <strong>Senha do seu acesso</strong>
          <small>Ao trocar, as outras sessões abertas serão encerradas.</small>
        </div>
      </header>
      <div className={styles.formGrid}>
        <label className={styles.fullField}>
          <span>Senha atual</span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label>
          <span>Nova senha</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <label>
          <span>Confirmar nova senha</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.passwordAction}>
        {feedback ? (
          <span role="status">{feedback}</span>
        ) : (
          <span>Use no mínimo 10 caracteres.</span>
        )}
        <button
          type="button"
          disabled={
            changing ||
            !currentPassword ||
            newPassword.length < 10 ||
            confirmation.length < 10
          }
          onClick={() => void changePassword()}
        >
          {changing ? (
            <LoaderCircle className={shell.spin} size={14} />
          ) : (
            <KeyRound size={14} />
          )}{" "}
          Alterar senha
        </button>
      </div>
    </section>
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
