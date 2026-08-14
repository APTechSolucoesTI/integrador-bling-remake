"use client";

import type {
  OrganizationsResponse,
  SessionResponse,
} from "@integrador/contracts";
import {
  Activity,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Gauge,
  Goal,
  LoaderCircle,
  LogOut,
  Menu,
  Orbit,
  Network,
  Plus,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import { homeRoute } from "../../lib/home-route";
import { ApplicationSidebar } from "../layout/application-sidebar";
import { ApplicationHeaderActions } from "../layout/application-header-actions";
import { ApplicationGlobalSearch } from "../layout/application-global-search";
import shell from "../nfe/nfe.module.css";
import styles from "./administration.module.css";

interface OrganizationDraft {
  name: string;
  slug: string;
  brandName: string;
  legacyUnitId: string;
}
const blank: OrganizationDraft = {
  name: "",
  slug: "",
  brandName: "",
  legacyUnitId: "",
};

export function OrganizationsClient() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [data, setData] = useState<OrganizationsResponse | null>(null);
  const [draft, setDraft] = useState<OrganizationDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
      if (!nextSession.user.superAdmin) throw new Error("forbidden");
      const response = await fetch(
        `${API_URL}/v1/administration/organizations`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("api");
      setData((await response.json()) as OrganizationsResponse);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "forbidden"
          ? "Esta área é exclusiva para superadministradores."
          : "Não foi possível carregar as empresas.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    void load();
  }, [load]);
  async function create() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/administration/organizations`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            slug: draft.slug,
            brandName: draft.brandName || null,
            legacyUnitId: draft.legacyUnitId
              ? Number(draft.legacyUnitId)
              : null,
          }),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setData((await response.json()) as OrganizationsResponse);
      setDraft(null);
      setSuccess("Empresa provisionada e vinculada ao seu acesso.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar a empresa.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function switchTenant(tenantId: string) {
    const response = await fetch(`${API_URL}/v1/auth/tenant`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    if (response.ok) {
      const tenant = session?.availableTenants.find(
        (item) => item.id === tenantId,
      );
      router.push(
        tenant && session
          ? homeRoute({ user: session.user, permissions: tenant.permissions })
          : "/app/nfe",
      );
      router.refresh();
    } else setError("Não foi possível acessar a empresa.");
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
        <h1>Carregando empresas</h1>
      </main>
    );
  if (!session || !session.user.superAdmin || !data)
    return (
      <main className={shell.statePage}>
        <ShieldCheck size={28} />
        <h1>Superadministração indisponível</h1>
        <p>{error}</p>
        <Link href="/app/dashboard">Voltar ao painel</Link>
      </main>
    );
  const active = data.items.filter((tenant) => tenant.active).length;
  const linked = data.items.filter(
    (tenant) => tenant.legacyUnitId !== null,
  ).length;
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
            <small>Contexto atual</small>
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
          <Link href="/app/documents">
            <Truck size={17} /> Boletos e rastreio
          </Link>
          <Link href="/app/products">
            <Boxes size={17} /> Produtos
          </Link>
          <Link href="/app/people">
            <Users size={17} /> Pessoas
          </Link>
          <Link href="/app/commercial">
            <Store size={17} /> Cadastros comerciais
          </Link>
          <Link href="/app/finance">
            <CircleDollarSign size={17} /> Lucro e margem
          </Link>
          <Link href="/app/goals">
            <Goal size={17} /> Metas
          </Link>
          <Link href="/app/operations">
            <Activity size={17} /> Jobs e integrações
          </Link>
          <p>SUPERADMIN</p>
          <Link className={shell.active} href="/app/organizations">
            <Network size={17} /> Empresas
          </Link>
          <Link href="/app/users">
            <ShieldCheck size={17} /> Usuários e acesso
          </Link>
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
            onClick={() => setMenuOpen((value) => !value)}
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
                MULTIEMPRESA · PROVISIONAMENTO
              </span>
              <h1>Empresas</h1>
              <p>
                Tenants comerciais, vínculos com unidades legadas e acesso ao
                contexto.
              </p>
            </div>
            <button
              className={shell.refreshButton}
              type="button"
              onClick={() => setDraft(blank)}
            >
              <Plus size={15} /> Nova empresa
            </button>
          </section>
          {error ? <div className={styles.feedbackError}>{error}</div> : null}
          {success ? (
            <div className={styles.feedbackSuccess}>
              <Check size={14} />
              {success}
            </div>
          ) : null}
          <section className={styles.metrics}>
            <Metric label="Empresas" value={data.items.length} />
            <Metric label="Ativas" value={active} />
            <Metric label="Com origem importada" value={linked} />
          </section>
          <section
            className={`${styles.userPanel} ${styles.organizationPanel}`}
          >
            <header>
              <div>
                <strong>Organizações provisionadas</strong>
                <span>
                  O identificador de origem é opcional e serve apenas para
                  rastrear dados existentes.
                </span>
              </div>
              <b>{data.items.length} EMPRESAS</b>
            </header>
            <div className={styles.organizationGrid}>
              {data.items.map((tenant) => (
                <article key={tenant.id}>
                  <div className={styles.organizationMark}>
                    {initials(tenant.brandName ?? tenant.name)}
                  </div>
                  <div>
                    <span>
                      {tenant.active ? "ATIVA" : "INATIVA"}
                      {tenant.demo ? " · DEMO" : ""}
                    </span>
                    <h2>{tenant.brandName ?? tenant.name}</h2>
                    <p>{tenant.name}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Slug</dt>
                      <dd>{tenant.slug}</dd>
                    </div>
                    <div>
                      <dt>Unidade legada</dt>
                      <dd>
                        {tenant.legacyUnitId
                          ? `#${tenant.legacyUnitId}`
                          : "Não vinculada"}
                      </dd>
                    </div>
                    <div>
                      <dt>Membros</dt>
                      <dd>{tenant.members}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void switchTenant(tenant.id)}
                    disabled={!tenant.active}
                  >
                    Acessar empresa
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
      {draft ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={() => setDraft(null)}
        >
          <section
            className={styles.modal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>NOVO TENANT</span>
                <h2>Provisionar empresa</h2>
              </div>
              <button type="button" onClick={() => setDraft(null)}>
                <X size={17} />
              </button>
            </header>
            <div className={styles.formGrid}>
              <label>
                <span>Nome da organização</span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Nome da marca</span>
                <input
                  value={draft.brandName}
                  onChange={(event) =>
                    setDraft({ ...draft, brandName: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Slug</span>
                <input
                  value={draft.slug}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      slug: event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                  placeholder="minha-empresa"
                />
              </label>
              <label>
                <span>ID da unidade legada</span>
                <input
                  type="number"
                  min="1"
                  value={draft.legacyUnitId}
                  onChange={(event) =>
                    setDraft({ ...draft, legacyUnitId: event.target.value })
                  }
                  placeholder="Opcional"
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setDraft(null)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving || draft.name.length < 2 || !draft.slug}
                onClick={() => void create()}
              >
                {saving ? (
                  <LoaderCircle className={shell.spin} size={14} />
                ) : (
                  <Plus size={14} />
                )}{" "}
                Criar empresa
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>
        <Building2 size={17} />
      </span>
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
async function responseMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return body?.message ?? "Não foi possível concluir a operação.";
}
