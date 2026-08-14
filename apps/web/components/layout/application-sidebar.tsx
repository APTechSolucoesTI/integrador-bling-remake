"use client";

import type { ModulePermission, SessionResponse } from "@integrador/contracts";
import {
  Activity,
  Boxes,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Gauge,
  Goal,
  LogOut,
  Orbit,
  Percent,
  BadgeDollarSign,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import { homeRoute } from "../../lib/home-route";
import styles from "./application-sidebar.module.css";

interface ApplicationSidebarProps {
  session: SessionResponse;
  open: boolean;
  onLogout: () => void | Promise<void>;
}
interface NavLink {
  href: string;
  label: string;
  icon: typeof Gauge;
  permissions: ModulePermission[];
}

const groups: Array<{ label: string; links: NavLink[] }> = [
  {
    label: "OPERAÇÃO",
    links: [
      {
        href: "/app/dashboard",
        label: "Visão geral",
        icon: Gauge,
        permissions: ["dashboard:view"],
      },
      {
        href: "/app/nfe",
        label: "Notas fiscais",
        icon: FileText,
        permissions: ["nfe:view"],
      },
      {
        href: "/app/documents",
        label: "Boletos e rastreio",
        icon: Truck,
        permissions: ["documents:view"],
      },
      {
        href: "/app/products",
        label: "Produtos",
        icon: Boxes,
        permissions: ["products:view"],
      },
      {
        href: "/app/people",
        label: "Pessoas",
        icon: Users,
        permissions: ["people:view"],
      },
    ],
  },
  {
    label: "COMERCIAL",
    links: [
      {
        href: "/app/commercial",
        label: "Cadastros comerciais",
        icon: Store,
        permissions: ["commercial:view"],
      },
      {
        href: "/app/goals",
        label: "Metas",
        icon: Goal,
        permissions: ["goals:view"],
      },
    ],
  },
  {
    label: "FINANCEIRO",
    links: [
      {
        href: "/app/finance",
        label: "Lucro e margem",
        icon: CircleDollarSign,
        permissions: ["finance:view"],
      },
      {
        href: "/app/marketplace-fees",
        label: "Taxas Mercado Livre",
        icon: BadgeDollarSign,
        permissions: ["marketplace-fees:view"],
      },
      {
        href: "/app/fiscal",
        label: "Custos e tributação",
        icon: Percent,
        permissions: ["costs:view", "tax:view"],
      },
    ],
  },
];

export function ApplicationSidebar({
  session,
  open,
  onLogout,
}: ApplicationSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [switchingTenant, setSwitchingTenant] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(session.preferences);
  const [collapsed, setCollapsed] = useState(!session.preferences.fixedMenu);
  const can = (...permissions: ModulePermission[]) =>
    permissions.some((permission) => session.permissions.includes(permission));
  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => can(...link.permissions)),
    }))
    .filter((group) => group.links.length > 0);
  const showPlatform =
    can("operations:view", "integrations:manage") ||
    session.user.superAdmin ||
    can("users:manage", "settings:view");

  useEffect(() => {
    setPreferences(session.preferences);
    setCollapsed(!session.preferences.fixedMenu);
  }, [session.preferences]);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<SessionResponse["preferences"]>)
        .detail;
      setPreferences(detail);
      setCollapsed(!detail.fixedMenu);
    };
    window.addEventListener("app-preferences", update);
    return () => window.removeEventListener("app-preferences", update);
  }, []);

  useEffect(() => {
    const scale = preferences.zoom / 100;
    const applyScaledViewport = () => {
      document.documentElement.style.setProperty(
        "--app-viewport-width",
        `${window.innerWidth / scale}px`,
      );
      document.documentElement.style.setProperty(
        "--app-viewport-height",
        `${window.innerHeight / scale}px`,
      );
    };
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      collapsed ? "76px" : "242px",
    );
    document.documentElement.style.setProperty(
      "--app-interface-scale",
      String(scale),
    );
    document.body.style.setProperty("zoom", String(scale));
    document.body.style.setProperty("width", `${100 / scale}%`);
    document.body.style.setProperty("min-height", `${100 / scale}vh`);
    applyScaledViewport();
    window.addEventListener("resize", applyScaledViewport);
    return () => {
      window.removeEventListener("resize", applyScaledViewport);
      document.documentElement.style.removeProperty("--app-sidebar-width");
      document.documentElement.style.removeProperty("--app-interface-scale");
      document.documentElement.style.removeProperty("--app-viewport-width");
      document.documentElement.style.removeProperty("--app-viewport-height");
      document.body.style.removeProperty("zoom");
      document.body.style.removeProperty("width");
      document.body.style.removeProperty("min-height");
    };
  }, [collapsed, preferences.zoom]);

  async function switchTenant(tenantId: string) {
    if (tenantId === session.tenant.id || switchingTenant) return;
    setSwitchingTenant(true);
    setTenantError(null);
    try {
      const response = await fetch(`${API_URL}/v1/auth/tenant`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!response.ok) throw new Error("tenant");
      const selectedTenant = session.availableTenants.find(
        (tenant) => tenant.id === tenantId,
      );
      router.push(
        selectedTenant
          ? homeRoute({
              user: session.user,
              permissions: selectedTenant.permissions,
            })
          : "/app/nfe",
      );
      router.refresh();
      window.location.reload();
    } catch {
      setTenantError("Não foi possível trocar de organização.");
      setSwitchingTenant(false);
    }
  }

  return (
    <aside
      data-app-sidebar
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""} ${open ? styles.sidebarOpen : ""}`}
    >
      <Link className={styles.brand} href="/">
        <span>
          <Orbit size={19} />
        </span>
        <div>
          <strong>APBling</strong>
          <small>BLING OPERATIONS</small>
        </div>
      </Link>
      <div className={styles.tenantSwitch} id="organization">
        <span>
          <Building2 size={17} />
        </span>
        <div>
          <small>Organização</small>
          <select
            aria-label="Organização ativa"
            value={session.tenant.id}
            disabled={switchingTenant}
            onChange={(event) => void switchTenant(event.target.value)}
          >
            {session.availableTenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </div>
        <ChevronDown size={15} />
      </div>
      {tenantError ? <p className={styles.tenantError}>{tenantError}</p> : null}
      <nav className={styles.nav} aria-label="Navegação da aplicação">
        {visibleGroups.map((group) => (
          <div className={styles.navGroup} key={group.label}>
            <p>{group.label}</p>
            {group.links.map(({ href, label, icon: Icon }) => (
                <Link
                  className={active(href) ? styles.active : undefined}
                  href={href}
                  key={href}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </Link>
            ))}
          </div>
        ))}
        {showPlatform ? <div className={styles.navGroup}>
          <p>PLATAFORMA</p>
          {can("operations:view", "integrations:manage") ? (
            <Link
              className={active("/app/operations") ? styles.active : undefined}
              href="/app/operations"
            >
              <Activity size={17} />
              <span>Jobs e integrações</span>
            </Link>
          ) : null}
          {session.user.superAdmin ? (
            <Link
              className={
                active("/app/organizations") ? styles.active : undefined
              }
              href="/app/organizations"
            >
              <Building2 size={17} />
              <span>Empresas</span>
            </Link>
          ) : null}
          {can("users:manage") ? (
            <Link
              className={active("/app/users") ? styles.active : undefined}
              href="/app/users"
            >
              <ShieldCheck size={17} />
              <span>Usuários e acesso</span>
            </Link>
          ) : null}
          {can("settings:view") ? (
            <Link
              className={active("/app/settings") ? styles.active : undefined}
              href="/app/settings"
            >
              <Settings size={17} />
              <span>Configurações</span>
            </Link>
          ) : null}
        </div> : null}
      </nav>
      <div className={styles.sidebarFooter}>
        <button
          className={styles.collapseButton}
          type="button"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          <span>{collapsed ? "Expandir" : "Recolher menu"}</span>
        </button>
        <button type="button" onClick={() => void onLogout()}>
          <LogOut size={16} /> <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
