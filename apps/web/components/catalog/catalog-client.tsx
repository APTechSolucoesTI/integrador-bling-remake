"use client";

import type {
  PeopleListResponse,
  ProductListResponse,
  SessionResponse,
} from "@integrador/contracts";
import {
  Activity,
  Boxes,
  Building2,
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
  Mail,
  Orbit,
  MapPin,
  Menu,
  PackageSearch,
  Phone,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "../../lib/api";
import { ApplicationSidebar } from "../layout/application-sidebar";
import { ApplicationHeaderActions } from "../layout/application-header-actions";
import { ApplicationGlobalSearch } from "../layout/application-global-search";
import { SmartCsvImportButton } from "../imports/smart-csv-import";
import { downloadCsv } from "../../lib/csv";
import shellStyles from "../nfe/nfe.module.css";
import styles from "./catalog.module.css";

type CatalogKind = "products" | "people";
type CatalogResponse = ProductListResponse | PeopleListResponse;

interface CatalogFilters {
  search: string;
  idProduto: string;
  nome: string;
  codigo: string;
  flag: string;
  order: string;
  direction: string;
}

function initialFilters(kind: CatalogKind): CatalogFilters {
  return {
    search: "",
    idProduto: "",
    nome: "",
    codigo: "",
    flag: "",
    order: kind === "products" ? "id_produto" : "nome",
    direction: "asc",
  };
}

export function CatalogClient({ kind }: { kind: CatalogKind }) {
  const router = useRouter();
  const defaults = useMemo(() => initialFilters(kind), [kind]);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [filters, setFilters] = useState<CatalogFilters>(defaults);
  const [applied, setApplied] = useState<CatalogFilters>(defaults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const requestList = useCallback(
    async (next: CatalogFilters, page = 1) => {
      setLoading(true);
      setError(null);
      const pageSize = kind === "products" ? "20" : "30";
      const params = new URLSearchParams({ page: String(page), pageSize });
      if (kind === "products") {
        if (next.idProduto) params.set("idProduto", next.idProduto);
        if (next.search) params.set("search", next.search);
        if (next.nome) params.set("nome", next.nome);
        if (next.codigo) params.set("codigo", next.codigo);
        if (next.flag) params.set("fabricacaoPropria", next.flag);
      } else {
        if (next.search) params.set("search", next.search);
        if (next.flag) params.set("envioDesabilitado", next.flag);
      }
      params.set("order", next.order);
      params.set("direction", next.direction);
      try {
        const response = await fetch(`${API_URL}/v1/${kind}?${params}`, {
          credentials: "include",
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("api");
        setData((await response.json()) as CatalogResponse);
        setApplied(next);
      } catch {
        setError(
          `Não foi possível consultar ${kind === "products" ? "os produtos" : "as pessoas"} sincronizados.`,
        );
      } finally {
        setLoading(false);
      }
    },
    [kind, router],
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
          const search = new URLSearchParams(window.location.search)
            .get("search")
            ?.trim();
          const initial = search ? { ...defaults, search } : defaults;
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
  }, [defaults, requestList, router]);

  async function logout() {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  async function updateMessaging(personId: number, disabled: boolean) {
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/people/${personId}/messaging`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ disabled }),
        },
      );
      if (!response.ok) throw new Error("api");
      await requestList(
        applied,
        (data as PeopleListResponse | null)?.pagination.page ?? 1,
      );
    } catch {
      setError("Não foi possível atualizar a preferência de comunicação.");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void requestList(filters);
  }

  function clear() {
    setFilters(defaults);
    void requestList(defaults);
  }

  function exportCurrentPage() {
    if (!data) return;
    if (kind === "products") {
      const products = data as ProductListResponse;
      downloadCsv(
        `produtos-pagina-${products.pagination.page}`,
        [
          "ID Bling",
          "Nome",
          "Código",
          "NCM",
          "Custo",
          "Situação",
          "Fabricação própria",
          "Atualizado em",
        ],
        products.items.map((item) => [
          item.blingId,
          item.nome,
          item.codigo,
          item.ncm,
          item.custo,
          item.situacao,
          item.fabricacaoPropria === null
            ? ""
            : item.fabricacaoPropria
              ? "Sim"
              : "Não",
          item.atualizadoEm,
        ]),
      );
      return;
    }
    const people = data as PeopleListResponse;
    downloadCsv(
      `pessoas-pagina-${people.pagination.page}`,
      [
        "ID Bling",
        "Nome",
        "Documento",
        "Telefone",
        "Celular",
        "E-mail",
        "Mensagens",
        "Cidade",
        "UF",
      ],
      people.items.map((item) => [
        item.blingId,
        item.nome,
        item.documento,
        item.telefone,
        item.celular,
        item.email,
        item.envioDesabilitado ? "Desabilitadas" : "Habilitadas",
        item.endereco?.municipio,
        item.endereco?.uf,
      ]),
    );
  }

  if (!session && loading) {
    return (
      <main className={shellStyles.statePage}>
        <LoaderCircle className={shellStyles.spin} size={29} />
        <h1>Carregando {kind === "products" ? "produtos" : "pessoas"}</h1>
      </main>
    );
  }
  if (!session) {
    return (
      <main className={shellStyles.statePage}>
        <Workflow size={29} />
        <h1>Não foi possível abrir o cadastro</h1>
        <p>{error}</p>
        <Link href="/login">Voltar ao login</Link>
      </main>
    );
  }

  const title = kind === "products" ? "Produtos" : "Pessoas";
  const subtitle =
    kind === "products"
      ? "Catálogo e custos sincronizados com o Bling."
      : "Contatos consolidados com comunicação e endereço principal.";

  return (
    <main className={shellStyles.shell}>
      <ApplicationSidebar session={session} open={menuOpen} onLogout={logout} />
      <aside
        hidden
        style={{ display: "none" }}
        className={`${shellStyles.sidebar} ${menuOpen ? shellStyles.sidebarOpen : ""}`}
      >
        <Link className={shellStyles.brand} href="/">
          <span>
            <Orbit size={18} />
          </span>
          <div>
            <strong>APBling</strong>
            <small>BLING OPERATIONS</small>
          </div>
        </Link>
        <Link
          className={shellStyles.tenant}
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
        <nav className={shellStyles.nav} aria-label="Navegação da aplicação">
          <p>OPERAÇÃO</p>
          <Nav
            href="/app/dashboard"
            label="Visão geral"
            icon={<Gauge size={17} />}
          />
          <Nav
            href="/app/nfe"
            label="Notas fiscais"
            icon={<FileText size={17} />}
          />
          <Nav
            active={kind === "products"}
            href="/app/products"
            label="Produtos"
            icon={<Boxes size={17} />}
          />
          <Nav
            active={kind === "people"}
            href="/app/people"
            label="Pessoas"
            icon={<Users size={17} />}
          />
          <Nav
            href="/app/documents"
            label="Boletos e rastreio"
            icon={<PackageSearch size={17} />}
          />
          <Nav
            href="/app/commercial"
            label="Cadastros comerciais"
            icon={<Sparkles size={17} />}
          />
          <Nav
            href="/app/finance"
            label="Custos e margem"
            icon={<CircleDollarSign size={17} />}
          />
          <Nav
            href="/app/fiscal"
            label="Custos e tributação"
            icon={<Filter size={17} />}
          />
          <Nav href="/app/goals" label="Metas" icon={<Goal size={17} />} />
          <Nav
            href="/app/operations"
            label="Jobs e integrações"
            icon={<Activity size={17} />}
          />
          <p>ADMINISTRAÇÃO</p>
          {session.permissions.includes("users:manage") ? (
            <Nav
              href="/app/users"
              label="Usuários e acesso"
              icon={<ShieldCheck size={17} />}
            />
          ) : null}
          <Nav
            href="/app/settings"
            label="Configurações"
            icon={<Settings size={17} />}
          />
        </nav>
        <div className={shellStyles.sidebarFooter}>
          <button type="button" onClick={() => void logout()}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <section className={shellStyles.workspace}>
        <header className={shellStyles.topbar}>
          <button
            className={shellStyles.mobileMenu}
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <ApplicationGlobalSearch />
          <ApplicationHeaderActions session={session} onLogout={logout} />
        </header>

        <div className={shellStyles.content}>
          <section className={shellStyles.titleRow}>
            <div>
              <span className={shellStyles.eyebrow}>
                CADASTRO · POSTGRESQL LEGADO
              </span>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <div className={styles.headerActions}>
              {session.permissions.includes(
                kind === "products" ? "products:manage" : "people:manage",
              ) && session.permissions.includes("imports:manage") ? (
                <SmartCsvImportButton
                  defaultEntity={kind === "products" ? "products" : "contacts"}
                  onComplete={() => requestList(applied, data?.pagination.page)}
                />
              ) : null}
              <Link
                className={styles.syncDisabled}
                href="/app/operations#operation-settings"
              >
                <RefreshCw size={15} /> Configurar sincronização
              </Link>
              <button
                className={shellStyles.refreshButton}
                type="button"
                disabled={!data?.items.length}
                onClick={exportCurrentPage}
              >
                <Download size={15} /> Exportar CSV
              </button>
              <button
                className={shellStyles.refreshButton}
                type="button"
                disabled={loading}
                onClick={() => void requestList(applied, data?.pagination.page)}
              >
                <RefreshCw
                  className={loading ? shellStyles.spin : ""}
                  size={15}
                />{" "}
                Atualizar
              </button>
            </div>
          </section>

          <section className={styles.summaryBar}>
            <div>
              <span>
                {kind === "products" ? (
                  <PackageSearch size={18} />
                ) : (
                  <Users size={18} />
                )}
              </span>
              <small>Total encontrado</small>
              <strong>{data?.pagination.total ?? 0}</strong>
            </div>
            <p>
              {kind === "products"
                ? "A fabricação própria segue a flag S/N do cadastro legado."
                : "A edição não dispara integrações nesta tela; os dados são somente leitura."}
            </p>
          </section>

          <form className={shellStyles.filters} onSubmit={submit}>
            <div className={shellStyles.filterHead}>
              <span>
                <Filter size={15} /> Filtros do cadastro
              </span>
              <button type="button" onClick={clear}>
                <X size={14} /> Limpar
              </button>
            </div>
            {kind === "products" ? (
              <div className={styles.productFilters}>
                <Field label="ID Bling">
                  <input
                    value={filters.idProduto}
                    onChange={(event) =>
                      setFilters({ ...filters, idProduto: event.target.value })
                    }
                  />
                </Field>
                <Field label="Nome">
                  <input
                    value={filters.nome}
                    onChange={(event) =>
                      setFilters({ ...filters, nome: event.target.value })
                    }
                  />
                </Field>
                <Field label="Código / SKU">
                  <input
                    value={filters.codigo}
                    onChange={(event) =>
                      setFilters({ ...filters, codigo: event.target.value })
                    }
                  />
                </Field>
                <Field label="Fabricação própria">
                  <select
                    value={filters.flag}
                    onChange={(event) =>
                      setFilters({ ...filters, flag: event.target.value })
                    }
                  >
                    <option value="">Todos</option>
                    <option value="S">Sim</option>
                    <option value="N">Não</option>
                  </select>
                </Field>
                <Field label="Ordenação">
                  <select
                    value={`${filters.order}:${filters.direction}`}
                    onChange={(event) => {
                      const [order = "id_produto", direction = "asc"] =
                        event.target.value.split(":");
                      setFilters({ ...filters, order, direction });
                    }}
                  >
                    <option value="id_produto:asc">ID Bling crescente</option>
                    <option value="nome:asc">Nome A–Z</option>
                    <option value="codigo:asc">Código A–Z</option>
                    <option value="custo:desc">Maior custo</option>
                  </select>
                </Field>
                <button className={shellStyles.applyButton} type="submit">
                  <Search size={15} /> Filtrar
                </button>
              </div>
            ) : (
              <div className={styles.peopleFilters}>
                <Field label="Busca geral">
                  <input
                    value={filters.search}
                    onChange={(event) =>
                      setFilters({ ...filters, search: event.target.value })
                    }
                    placeholder="Nome, documento, e-mail..."
                  />
                </Field>
                <Field label="Envio de mensagens">
                  <select
                    value={filters.flag}
                    onChange={(event) =>
                      setFilters({ ...filters, flag: event.target.value })
                    }
                  >
                    <option value="">Todos</option>
                    <option value="N">Habilitado</option>
                    <option value="S">Desabilitado</option>
                  </select>
                </Field>
                <Field label="Ordenação">
                  <select
                    value={`${filters.order}:${filters.direction}`}
                    onChange={(event) => {
                      const [order = "nome", direction = "asc"] =
                        event.target.value.split(":");
                      setFilters({ ...filters, order, direction });
                    }}
                  >
                    <option value="nome:asc">Nome A–Z</option>
                    <option value="nome:desc">Nome Z–A</option>
                    <option value="id_bling:asc">ID Bling crescente</option>
                  </select>
                </Field>
                <button className={shellStyles.applyButton} type="submit">
                  <Search size={15} /> Filtrar
                </button>
              </div>
            )}
          </form>

          <section className={shellStyles.tablePanel}>
            <div className={shellStyles.tableHead}>
              <div>
                <strong>{title} cadastrados</strong>
                <span>{data?.pagination.total ?? 0} registros encontrados</span>
              </div>
              <span className={shellStyles.readOnly}>
                DADOS REAIS · READ-ONLY
              </span>
            </div>
            {error ? <div className={shellStyles.error}>{error}</div> : null}
            {kind === "products" ? (
              <ProductTable
                data={data as ProductListResponse | null}
                loading={loading}
              />
            ) : (
              <PeopleTable
                data={data as PeopleListResponse | null}
                loading={loading}
                canEdit={session.permissions.includes("products:manage")}
                onMessaging={updateMessaging}
              />
            )}
            <footer className={shellStyles.pagination}>
              <span>
                Página {data?.pagination.page ?? 1} de{" "}
                {data?.pagination.pages || 1}
              </span>
              <div>
                <button
                  type="button"
                  disabled={!data || data.pagination.page <= 1 || loading}
                  onClick={() =>
                    void requestList(applied, data!.pagination.page - 1)
                  }
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
                    void requestList(applied, data!.pagination.page + 1)
                  }
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

function Nav({
  href,
  label,
  icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
}) {
  return (
    <Link className={active ? shellStyles.active : ""} href={href}>
      {icon}
      {label}
    </Link>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={shellStyles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ProductTable({
  data,
  loading,
}: {
  data: ProductListResponse | null;
  loading: boolean;
}) {
  return (
    <div className={shellStyles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>ID Bling</th>
            <th>Produto</th>
            <th>Código / NCM</th>
            <th>Custo bruto</th>
            <th>Fabricação</th>
            <th>Situação</th>
            <th>Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {loading && !data ? <Empty loading colSpan={7} /> : null}
          {!loading && data?.items.length === 0 ? <Empty colSpan={7} /> : null}
          {data?.items.map((product) => (
            <tr key={product.id}>
              <td>
                <strong>{product.blingId ?? "—"}</strong>
                <small>Local #{product.id}</small>
              </td>
              <td>
                <strong>{product.nome}</strong>
                <small>{product.descricao ?? "Sem descrição"}</small>
              </td>
              <td>
                <strong>{product.codigo ?? "—"}</strong>
                <small>NCM {product.ncm ?? "—"}</small>
              </td>
              <td className={shellStyles.money}>
                {product.custo ? brl(product.custo) : "Não informado"}
              </td>
              <td>
                <span
                  className={`${styles.flag} ${product.fabricacaoPropria ? styles.flagYes : ""}`}
                >
                  {product.fabricacaoPropria === null
                    ? "Não definido"
                    : product.fabricacaoPropria
                      ? "Própria"
                      : "Terceiros"}
                </span>
              </td>
              <td>{product.situacao ?? "—"}</td>
              <td>{formatDateTime(product.atualizadoEm)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeopleTable({
  data,
  loading,
  canEdit,
  onMessaging,
}: {
  data: PeopleListResponse | null;
  loading: boolean;
  canEdit: boolean;
  onMessaging: (id: number, disabled: boolean) => Promise<void>;
}) {
  return (
    <div className={shellStyles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Contato</th>
            <th>Documento</th>
            <th>Comunicação</th>
            <th>Endereço principal</th>
            <th>Mensagens</th>
            <th>ID Bling</th>
          </tr>
        </thead>
        <tbody>
          {loading && !data ? <Empty loading colSpan={6} /> : null}
          {!loading && data?.items.length === 0 ? <Empty colSpan={6} /> : null}
          {data?.items.map((person) => (
            <tr key={person.id}>
              <td>
                <div className={styles.person}>
                  <span>{initials(person.nome)}</span>
                  <div>
                    <strong>{person.nome}</strong>
                    <small>Cadastro #{person.id}</small>
                  </div>
                </div>
              </td>
              <td>
                <strong>{person.documento ?? "Não informado"}</strong>
                <small>IE {person.inscricaoEstadual ?? "—"}</small>
              </td>
              <td>
                <div className={styles.contact}>
                  {person.celular || person.telefone ? (
                    <span>
                      <Phone size={13} /> {person.celular ?? person.telefone}
                    </span>
                  ) : null}
                  {person.email ? (
                    <span>
                      <Mail size={13} /> {person.email}
                    </span>
                  ) : null}
                  {!person.celular && !person.telefone && !person.email ? (
                    <small>Sem contato</small>
                  ) : null}
                </div>
              </td>
              <td>
                {person.endereco ? (
                  <div className={styles.address}>
                    <MapPin size={14} />
                    <span>
                      {person.endereco.logradouro ?? "Endereço"}
                      {person.endereco.numero
                        ? `, ${person.endereco.numero}`
                        : ""}
                      <small>
                        {[person.endereco.municipio, person.endereco.uf]
                          .filter(Boolean)
                          .join(" · ") || "Localidade não informada"}
                      </small>
                    </span>
                  </div>
                ) : (
                  <span className={shellStyles.muted}>Sem endereço</span>
                )}
              </td>
              <td>
                <button
                  className={`${styles.messageToggle} ${person.envioDesabilitado ? styles.messageOff : ""}`}
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    void onMessaging(person.id, !person.envioDesabilitado)
                  }
                >
                  <i />
                  {person.envioDesabilitado ? "Desabilitadas" : "Habilitadas"}
                </button>
              </td>
              <td>
                <strong>{person.blingId}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({
  colSpan,
  loading = false,
}: {
  colSpan: number;
  loading?: boolean;
}) {
  return (
    <tr>
      <td className={shellStyles.empty} colSpan={colSpan}>
        {loading ? (
          <>
            <LoaderCircle className={shellStyles.spin} size={20} />
            Consultando PostgreSQL...
          </>
        ) : (
          "Nenhum registro corresponde aos filtros."
        )}
      </td>
    </tr>
  );
}

function brl(value: string): string {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
function formatDateTime(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}
function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
