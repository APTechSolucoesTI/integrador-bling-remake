"use client";

import type {
  BusinessOverviewResponse,
  FixedCostDuplicateResponse,
  SessionResponse,
} from "@integrador/contracts";
import {
  Activity,
  Banknote,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  Copy,
  ExternalLink,
  FileText,
  Gauge,
  Goal,
  LoaderCircle,
  LogOut,
  Menu,
  Orbit,
  PackageCheck,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  UserRoundCheck,
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
import { homeRoute } from "../../lib/home-route";
import { ApplicationSidebar } from "../layout/application-sidebar";
import { ApplicationHeaderActions } from "../layout/application-header-actions";
import { ApplicationGlobalSearch } from "../layout/application-global-search";
import { SmartCsvImportButton } from "../imports/smart-csv-import";
import shell from "../nfe/nfe.module.css";
import styles from "./business.module.css";

type Mode = "documents" | "commercial" | "fiscal";
type FixedCost = BusinessOverviewResponse["fiscal"]["fixedCosts"][number];
type Sector = BusinessOverviewResponse["commercial"]["sectors"][number];
interface SectorDraft {
  id: number | null;
  name: string;
  active: boolean;
  sellerIds: number[];
}
const blankSector: SectorDraft = {
  id: null,
  name: "",
  active: true,
  sellerIds: [],
};
interface CostDraft {
  id: number | null;
  name: string;
  description: string;
  value: string;
  application: "Item" | "Nota";
  valueType: "F" | "P";
  categoryId: string;
  channelIds: number[];
}
const blankCost: CostDraft = {
  id: null,
  name: "",
  description: "",
  value: "",
  application: "Nota",
  valueType: "F",
  categoryId: "",
  channelIds: [],
};
interface DuplicateCostDraft {
  cost: FixedCost;
  targetTenantIds: string[];
}

const titles = {
  documents: {
    eyebrow: "COBRANÇA · LOGÍSTICA",
    title: "Boletos e rastreamento",
    text: "Cobranças vinculadas às notas e objetos enviados aos clientes.",
  },
  commercial: {
    eyebrow: "CADASTROS · BLING",
    title: "Estrutura comercial",
    text: "Setores, vendedores, pedidos e cadastros sincronizados do Bling.",
  },
  fiscal: {
    eyebrow: "REGRAS · RENTABILIDADE",
    title: "Custos e tributação",
    text: "Despesas aplicadas aos cálculos e referências fiscais do integrador.",
  },
} as const;

export function BusinessClient({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [data, setData] = useState<BusinessOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [costDraft, setCostDraft] = useState<CostDraft | null>(null);
  const [duplicateCostDraft, setDuplicateCostDraft] =
    useState<DuplicateCostDraft | null>(null);
  const [sectorDraft, setSectorDraft] = useState<SectorDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionResponse, overviewResponse] = await Promise.all([
        fetch(`${API_URL}/v1/auth/session`, { credentials: "include" }),
        fetch(`${API_URL}/v1/business/overview`, { credentials: "include" }),
      ]);
      if (sessionResponse.status === 401 || overviewResponse.status === 401) {
        router.replace("/login");
        return;
      }
      if (!sessionResponse.ok || !overviewResponse.ok) throw new Error("api");
      setSession((await sessionResponse.json()) as SessionResponse);
      setData((await overviewResponse.json()) as BusinessOverviewResponse);
    } catch {
      setError("Não foi possível carregar os dados desta empresa.");
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    void load();
  }, [load]);

  function editCost(cost: FixedCost) {
    setCostDraft({
      id: cost.id,
      name: cost.name,
      description: cost.description ?? "",
      value: cost.value,
      application: cost.application,
      valueType: cost.valueType,
      categoryId: cost.categoryId?.toString() ?? "",
      channelIds: cost.channelIds,
    });
  }
  async function saveCost() {
    if (!costDraft) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/business/fixed-costs${costDraft.id ? `/${costDraft.id}` : ""}`,
        {
          method: costDraft.id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: costDraft.name,
            description: costDraft.description || null,
            value: costDraft.value.replace(",", "."),
            application: costDraft.application,
            valueType: costDraft.valueType,
            categoryId: costDraft.categoryId
              ? Number(costDraft.categoryId)
              : null,
            channelIds: costDraft.channelIds,
          }),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setData((await response.json()) as BusinessOverviewResponse);
      setCostDraft(null);
      setSuccess("Custo salvo e associado aos canais selecionados.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o custo.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function duplicateCost() {
    if (!duplicateCostDraft) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/business/fixed-costs/${duplicateCostDraft.cost.id}/duplicate`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            targetTenantIds: duplicateCostDraft.targetTenantIds,
          }),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as FixedCostDuplicateResponse;
      const missingChannels = result.results.flatMap(
        (item) => item.missingChannels,
      ).length;
      setDuplicateCostDraft(null);
      setSuccess(
        `${duplicateCostDraft.cost.name} foi duplicado para ${result.results.length} ${result.results.length === 1 ? "unidade" : "unidades"}.${missingChannels ? ` ${missingChannels} vínculo(s) de canal não existiam nos destinos e foram ignorados.` : " Canais equivalentes também foram associados."}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível duplicar o custo para as outras unidades.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveSector() {
    if (!sectorDraft) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/business/sectors${sectorDraft.id ? `/${sectorDraft.id}` : ""}`,
        {
          method: sectorDraft.id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: sectorDraft.name,
            active: sectorDraft.active,
            sellerIds: sectorDraft.sellerIds,
          }),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setData((await response.json()) as BusinessOverviewResponse);
      setSectorDraft(null);
      setSuccess("Setor e equipe vinculada foram salvos.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o setor.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function deleteResource(
    kind: "fixed-costs" | "ncm-credits" | "sectors",
    id: number,
    label: string,
  ) {
    if (!window.confirm(`Excluir ${label}? Esta ação não poderá ser desfeita.`))
      return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/v1/business/${kind}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setData((await response.json()) as BusinessOverviewResponse);
      setSuccess(`${label} excluído.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `Não foi possível excluir ${label}.`,
      );
    } finally {
      setSaving(false);
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
        <h1>Carregando dados operacionais</h1>
      </main>
    );
  if (!session || !data)
    return (
      <main className={shell.statePage}>
        <Workflow size={28} />
        <h1>Área indisponível</h1>
        <p>{error}</p>
        <Link href={session ? homeRoute(session) : "/login"}>
          Voltar ao painel
        </Link>
      </main>
    );
  const canEdit =
    session.permissions.includes("commercial:manage") ||
    session.permissions.includes("costs:manage") ||
    session.permissions.includes("tax:manage");
  const copy = titles[mode];

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
          <Link
            className={mode === "documents" ? shell.active : ""}
            href="/app/documents"
          >
            <Truck size={17} /> Boletos e rastreio
          </Link>
          <Link href="/app/products">
            <Boxes size={17} /> Produtos
          </Link>
          <Link href="/app/people">
            <Users size={17} /> Pessoas
          </Link>
          <p>COMERCIAL</p>
          <Link
            className={mode === "commercial" ? shell.active : ""}
            href="/app/commercial"
          >
            <Store size={17} /> Cadastros comerciais
          </Link>
          <Link href="/app/goals">
            <Goal size={17} /> Metas
          </Link>
          <p>FINANCEIRO</p>
          <Link href="/app/finance">
            <CircleDollarSign size={17} /> Lucro e margem
          </Link>
          <Link
            className={mode === "fiscal" ? shell.active : ""}
            href="/app/fiscal"
          >
            <Percent size={17} /> Custos e tributação
          </Link>
          <p>PLATAFORMA</p>
          <Link href="/app/operations">
            <Activity size={17} /> Jobs e integrações
          </Link>
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
              <span className={shell.eyebrow}>{copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.text}</p>
            </div>
            <div className={styles.titleActions}>
              {mode !== "fiscal" &&
              (session.permissions.includes("commercial:manage") ||
                session.permissions.includes("nfe:manage")) &&
              session.permissions.includes("imports:manage") ? (
                <SmartCsvImportButton
                  defaultEntity={mode === "documents" ? "bills" : "sellers"}
                  onComplete={load}
                  compact
                />
              ) : null}
              {mode === "fiscal" && canEdit ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setCostDraft(blankCost)}
                >
                  <Plus size={14} /> Novo custo
                </button>
              ) : null}
              {mode === "commercial" && canEdit ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setSectorDraft(blankSector)}
                >
                  <Plus size={14} /> Novo setor
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw className={loading ? shell.spin : ""} size={14} />{" "}
                Atualizar
              </button>
            </div>
          </section>
          {error ? <div className={styles.feedbackError}>{error}</div> : null}
          {success ? (
            <div className={styles.feedbackSuccess}>
              <Check size={14} />
              {success}
            </div>
          ) : null}
          {mode === "documents" ? (
            <Documents data={data} />
          ) : mode === "commercial" ? (
            <Commercial
              data={data}
              canEdit={canEdit}
              onEditSector={(sector) =>
                setSectorDraft({
                  id: sector.id,
                  name: sector.name,
                  active: sector.active,
                  sellerIds: data.commercial.vendors
                    .filter((vendor) => vendor.sectorId === sector.id)
                    .map((vendor) => vendor.id),
                })
              }
              onDeleteSector={(sector) =>
                void deleteResource("sectors", sector.id, sector.name)
              }
            />
          ) : (
            <Fiscal
              data={data}
              canEdit={canEdit}
              saving={saving}
              onEdit={editCost}
              onDuplicate={(cost) =>
                setDuplicateCostDraft({ cost, targetTenantIds: [] })
              }
              onDelete={(cost) =>
                void deleteResource("fixed-costs", cost.id, cost.name)
              }
            />
          )}
        </div>
      </section>
      {costDraft ? (
        <CostModal
          draft={costDraft}
          data={data}
          saving={saving}
          onChange={setCostDraft}
          onClose={() => setCostDraft(null)}
          onSave={saveCost}
        />
      ) : null}
      {duplicateCostDraft ? (
        <DuplicateCostModal
          draft={duplicateCostDraft}
          session={session}
          saving={saving}
          onChange={setDuplicateCostDraft}
          onClose={() => setDuplicateCostDraft(null)}
          onSave={duplicateCost}
        />
      ) : null}
      {sectorDraft ? (
        <SectorModal
          draft={sectorDraft}
          data={data}
          saving={saving}
          onChange={setSectorDraft}
          onClose={() => setSectorDraft(null)}
          onSave={saveSector}
        />
      ) : null}
    </main>
  );
}

function Documents({ data }: { data: BusinessOverviewResponse }) {
  const open = data.documents.boletos.filter(
    (item) => item.status === 1,
  ).length;
  return (
    <>
      <section className={styles.metrics}>
        <Metric
          icon={<Banknote />}
          label="Boletos encontrados"
          value={data.documents.boletos.length}
        />
        <Metric icon={<WalletCards />} label="Em aberto" value={open} />
        <Metric
          icon={<Truck />}
          label="Objetos rastreados"
          value={data.documents.tracking.length}
        />
      </section>
      <div className={styles.split}>
        <Panel
          title="Boletos vinculados"
          eyebrow="COBRANÇA"
          count={data.documents.boletos.length}
        >
          <div className={styles.list}>
            {data.documents.boletos.map((item) => {
              const url = safeHttpUrl(item.link);
              return (
                <article key={item.id}>
                  <span className={styles.listIcon}>
                    <Banknote size={16} />
                  </span>
                  <div>
                    <strong>
                      {money(item.value)} · {item.customer}
                    </strong>
                    <small>
                      {item.invoiceNumber
                        ? `NF-e ${item.invoiceNumber}`
                        : "Sem NF-e localizada"}{" "}
                      · vence {dateLabel(item.dueDate)}
                    </small>
                  </div>
                  <Status text={boletoStatus(item.status)} />
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14} />
                    </a>
                  ) : null}
                </article>
              );
            })}
            <Empty
              show={!data.documents.boletos.length}
              text="Nenhum boleto localizado."
            />
          </div>
        </Panel>
        <Panel
          title="Rastreamentos"
          eyebrow="LOGÍSTICA"
          count={data.documents.tracking.length}
        >
          <div className={styles.list}>
            {data.documents.tracking.map((item) => (
              <article key={item.invoiceId}>
                <span className={styles.listIcon}>
                  <PackageCheck size={16} />
                </span>
                <div>
                  <Link href={`/app/nfe/${item.invoiceId}`}>
                    NF-e {item.invoiceNumber} · {item.customer}
                  </Link>
                  <small>
                    {item.primaryCode}
                    {item.secondaryCode ? ` · ${item.secondaryCode}` : ""} ·
                    emitida {dateLabel(item.issuedAt)}
                  </small>
                </div>
                <Status text={item.status} />
                {item.primaryCode ? (
                  <a
                    href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(item.primaryCode)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} />
                  </a>
                ) : null}
              </article>
            ))}
            <Empty
              show={!data.documents.tracking.length}
              text="Nenhum código de rastreamento localizado."
            />
          </div>
        </Panel>
      </div>
    </>
  );
}

function Commercial({
  data,
  canEdit,
  onEditSector,
  onDeleteSector,
}: {
  data: BusinessOverviewResponse;
  canEdit: boolean;
  onEditSector: (sector: Sector) => void;
  onDeleteSector: (sector: Sector) => void;
}) {
  const unassigned = data.commercial.vendors.filter(
    (vendor) => vendor.sectorId === null,
  );
  return (
    <>
      <section className={`${styles.metrics} ${styles.commercialMetrics}`}>
        <Metric
          icon={<Building2 />}
          label="Setores ativos"
          value={data.commercial.sectors.filter((item) => item.active).length}
        />
        <Metric
          icon={<UserRoundCheck />}
          label="Vendedores"
          value={data.commercial.vendors.length}
        />
        <Metric
          icon={<Store />}
          label="Canais de venda"
          value={data.commercial.channels.length}
        />
        <Metric
          icon={<ShoppingBag />}
          label="Pedidos de venda"
          value={data.commercial.salesOrders.length}
        />
      </section>
      <section className={styles.commercialSection}>
        <header className={styles.sectionHeading}>
          <div>
            <span>ORGANIZAÇÃO DA EQUIPE</span>
            <h2>Setores e vendedores</h2>
            <p>
              Defina as equipes e associe cada vendedor ao setor responsável.
            </p>
          </div>
          {unassigned.length ? (
            <strong>{unassigned.length} sem setor</strong>
          ) : (
            <strong className={styles.completeBadge}>Equipe organizada</strong>
          )}
        </header>
        <div className={styles.teamGrid}>
          <div className={styles.sectorBoard}>
            {data.commercial.sectors.map((sector) => {
              const members = data.commercial.vendors.filter(
                (vendor) => vendor.sectorId === sector.id,
              );
              return (
                <article className={styles.sectorCard} key={sector.id}>
                  <div className={styles.sectorCardHeader}>
                    <span className={styles.sectorIcon}>
                      <Building2 size={17} />
                    </span>
                    <div>
                      <h3>{sector.name}</h3>
                      <small>
                        {members.length === 1
                          ? "1 vendedor"
                          : `${members.length} vendedores`}
                      </small>
                    </div>
                    <Status text={sector.active ? "Ativo" : "Inativo"} />
                  </div>
                  <div className={styles.memberPreview}>
                    {members.slice(0, 4).map((member) => (
                      <span key={member.id}>{member.name}</span>
                    ))}
                    {!members.length ? (
                      <em>Nenhum vendedor vinculado</em>
                    ) : null}
                    {members.length > 4 ? (
                      <em>+{members.length - 4} vendedores</em>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <footer>
                      <button
                        type="button"
                        onClick={() => onEditSector(sector)}
                      >
                        <Pencil size={13} /> Definir equipe
                      </button>
                      <button
                        type="button"
                        aria-label={`Excluir setor ${sector.name}`}
                        title="Excluir setor"
                        onClick={() => onDeleteSector(sector)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </footer>
                  ) : null}
                </article>
              );
            })}
            {!data.commercial.sectors.length ? (
              <div className={styles.teamEmpty}>
                <Building2 size={22} />
                <strong>Nenhum setor criado</strong>
                <p>Use “Novo setor” para organizar os vendedores.</p>
              </div>
            ) : null}
          </div>
          <div className={styles.vendorRoster}>
            <header>
              <div>
                <span>VENDEDORES SINCRONIZADOS</span>
                <h3>Equipe comercial</h3>
              </div>
              <b>{data.commercial.vendors.length}</b>
            </header>
            <div>
              {data.commercial.vendors.map((vendor) => (
                <article key={vendor.id}>
                  <span className={styles.vendorAvatar}>
                    {initials(vendor.name)}
                  </span>
                  <div>
                    <strong>{vendor.name}</strong>
                    <small>ID Bling {vendor.blingId ?? "não informado"}</small>
                  </div>
                  <span
                    className={
                      vendor.sectorId ? styles.sectorTag : styles.unassignedTag
                    }
                  >
                    {vendor.sector ?? "Sem setor"}
                  </span>
                </article>
              ))}
              <Empty
                show={!data.commercial.vendors.length}
                text="Nenhum vendedor sincronizado."
              />
            </div>
          </div>
        </div>
      </section>
      <Panel
        title="Pedidos de venda recentes"
        eyebrow="ÚLTIMOS 100 SINCRONIZADOS"
        count={data.commercial.salesOrders.length}
      >
        <SimpleTable
          headers={["Pedido", "Data", "Total", "Situação", "NF-e Bling"]}
          rows={data.commercial.salesOrders.map((item) => [
            item.number ?? item.blingId,
            dateLabel(item.issuedAt),
            money(item.total),
            item.statusCode ?? "—",
            item.invoiceBlingId ?? "—",
          ])}
        />
      </Panel>
      <section className={styles.catalogSection}>
        <header className={styles.sectionHeading}>
          <div>
            <span>REFERÊNCIAS DO BLING</span>
            <h2>Cadastros sincronizados</h2>
            <p>
              Dados auxiliares utilizados nas vendas, custos e notas fiscais.
            </p>
          </div>
        </header>
        <div className={styles.catalogGrid}>
          <Panel
            title="Canais de venda"
            eyebrow="ORIGEM"
            count={data.commercial.channels.length}
          >
            <SimpleTable
              headers={["Descrição", "Tipo", "Loja"]}
              rows={data.commercial.channels.map((item) => [
                item.description,
                item.type ?? "Não informado",
                item.storeId ?? "—",
              ])}
            />
          </Panel>
          <Panel
            title="Formas de pagamento"
            eyebrow="RECEBIMENTO"
            count={data.commercial.paymentMethods.length}
          >
            <SimpleTable
              headers={["Descrição", "Tipo", "ID Bling"]}
              rows={data.commercial.paymentMethods.map((item) => [
                item.description,
                item.type ?? "Não informado",
                item.blingId ?? "—",
              ])}
            />
          </Panel>
          <Panel
            title="Grupos de produtos"
            eyebrow="CATÁLOGO"
            count={data.commercial.productGroups.length}
          >
            <SimpleTable
              headers={["Grupo", "ID Bling"]}
              rows={data.commercial.productGroups.map((item) => [
                item.name,
                item.blingId ?? "—",
              ])}
            />
          </Panel>
          <Panel
            title="Naturezas de operação"
            eyebrow="FISCAL COMERCIAL"
            count={data.commercial.operationNatures.length}
          >
            <SimpleTable
              headers={["Descrição", "ID Bling"]}
              rows={data.commercial.operationNatures.map((item) => [
                item.description,
                item.blingId ?? "—",
              ])}
            />
          </Panel>
        </div>
      </section>
    </>
  );
}

function Fiscal({
  data,
  canEdit,
  saving,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  data: BusinessOverviewResponse;
  canEdit: boolean;
  saving: boolean;
  onEdit: (cost: FixedCost) => void;
  onDuplicate: (cost: FixedCost) => void;
  onDelete: (cost: FixedCost) => void;
}) {
  return (
    <Panel
      title="Custos fixos e variáveis"
      eyebrow="COMPOSIÇÃO DO CÁLCULO"
      count={data.fiscal.fixedCosts.length}
    >
      <div className={styles.costGrid}>
        {data.fiscal.fixedCosts.map((cost) => (
          <article className={styles.costCard} key={cost.id}>
            <header>
              <span>
                {cost.valueType === "P" ? (
                  <Percent size={16} />
                ) : (
                  <CircleDollarSign size={16} />
                )}
              </span>
              {canEdit ? (
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onDuplicate(cost)}
                    title="Duplicar para outras unidades"
                  >
                    <Copy size={13} /> Duplicar
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onEdit(cost)}
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    className={styles.deleteAction}
                    type="button"
                    disabled={saving}
                    onClick={() => onDelete(cost)}
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                </div>
              ) : null}
            </header>
            <small>{cost.category ?? "SEM CATEGORIA"}</small>
            <h3>{cost.name}</h3>
            <p>{cost.description ?? "Sem descrição adicional."}</p>
            <footer>
              <strong>
                {cost.valueType === "P" ? `${cost.value}%` : money(cost.value)}
              </strong>
              <span>
                Por {cost.application.toLowerCase()} ·{" "}
                {cost.channelIds.length
                  ? `${cost.channelIds.length} canais`
                  : "todos os canais"}
              </span>
            </footer>
          </article>
        ))}
        {!data.fiscal.fixedCosts.length ? (
          <div className={styles.costEmpty}>
            Nenhum custo configurado nesta unidade.
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function Panel({
  title,
  eyebrow,
  count,
  children,
}: {
  title: string;
  eyebrow: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <header>
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <b>{count} REGISTROS</b>
      </header>
      {children}
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
function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <Empty show text="Nenhum registro localizado." /> : null}
    </div>
  );
}
function Status({ text }: { text: string }) {
  const tone = /pago|enviad|sucesso/i.test(text)
    ? styles.statusGreen
    : /cancel|erro|falha/i.test(text)
      ? styles.statusRed
      : styles.statusAmber;
  return (
    <span className={`${styles.status} ${tone}`}>
      <i />
      {text}
    </span>
  );
}
function Empty({ show, text }: { show: boolean; text: string }) {
  return show ? <div className={styles.empty}>{text}</div> : null;
}

function SectorModal({
  draft,
  data,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: SectorDraft;
  data: BusinessOverviewResponse;
  saving: boolean;
  onChange: (value: SectorDraft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  return (
    <div className={styles.modalBackdrop} onMouseDown={onClose}>
      <section
        className={styles.modal}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>ESTRUTURA COMERCIAL</span>
            <h2>{draft.id ? "Editar setor" : "Novo setor"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={17} />
          </button>
        </header>
        <div className={styles.formGrid}>
          <label className={styles.full}>
            <span>Nome do setor</span>
            <input
              autoFocus
              maxLength={120}
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
            />
          </label>
          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) =>
                onChange({ ...draft, active: event.target.checked })
              }
            />
            Setor ativo
          </label>
          <fieldset className={`${styles.full} ${styles.sellerPicker}`}>
            <legend>Vendedores deste setor</legend>
            <p>
              Selecione quem faz parte da equipe. Um vendedor pode pertencer a
              somente um setor.
            </p>
            <div>
              {data.commercial.vendors.map((vendor) => {
                const selected = draft.sellerIds.includes(vendor.id);
                return (
                  <label
                    key={vendor.id}
                    className={selected ? styles.selectedSeller : ""}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        onChange({
                          ...draft,
                          sellerIds: event.target.checked
                            ? [...draft.sellerIds, vendor.id]
                            : draft.sellerIds.filter((id) => id !== vendor.id),
                        })
                      }
                    />
                    <span className={styles.vendorAvatar}>
                      {initials(vendor.name)}
                    </span>
                    <span>
                      <strong>{vendor.name}</strong>
                      <small>
                        {vendor.sectorId && vendor.sectorId !== draft.id
                          ? `Atualmente em ${vendor.sector}`
                          : selected
                            ? "Selecionado para este setor"
                            : "Sem setor"}
                      </small>
                    </span>
                  </label>
                );
              })}
              {!data.commercial.vendors.length ? (
                <div className={styles.sellerPickerEmpty}>
                  Nenhum vendedor sincronizado com o Bling.
                </div>
              ) : null}
            </div>
          </fieldset>
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || draft.name.trim().length < 2}
            onClick={() => void onSave()}
          >
            {saving ? (
              <LoaderCircle className={shell.spin} size={14} />
            ) : (
              <Check size={14} />
            )}
            Salvar setor
          </button>
        </footer>
      </section>
    </div>
  );
}

function CostModal({
  draft,
  data,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: CostDraft;
  data: BusinessOverviewResponse;
  saving: boolean;
  onChange: (value: CostDraft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  return (
    <div className={styles.modalBackdrop} onMouseDown={onClose}>
      <section
        className={styles.modal}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>CUSTO DA EMPRESA</span>
            <h2>{draft.id ? "Editar custo" : "Novo custo"}</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        <div className={styles.formGrid}>
          <label>
            <span>Nome</span>
            <input
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
            />
          </label>
          <label>
            <span>Categoria</span>
            <select
              value={draft.categoryId}
              onChange={(event) =>
                onChange({ ...draft, categoryId: event.target.value })
              }
            >
              <option value="">Sem categoria</option>
              {data.fiscal.fixedCostTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.full}>
            <span>Descrição</span>
            <input
              value={draft.description}
              onChange={(event) =>
                onChange({ ...draft, description: event.target.value })
              }
            />
          </label>
          <label>
            <span>Valor</span>
            <input
              inputMode="decimal"
              value={draft.value}
              onChange={(event) =>
                onChange({ ...draft, value: event.target.value })
              }
              placeholder="0.00"
            />
          </label>
          <label>
            <span>Tipo do valor</span>
            <select
              value={draft.valueType}
              onChange={(event) =>
                onChange({
                  ...draft,
                  valueType: event.target.value as "F" | "P",
                })
              }
            >
              <option value="F">Valor fixo</option>
              <option value="P">Porcentagem</option>
            </select>
          </label>
          <label className={styles.full}>
            <span>Aplicar por</span>
            <select
              value={draft.application}
              onChange={(event) =>
                onChange({
                  ...draft,
                  application: event.target.value as "Item" | "Nota",
                })
              }
            >
              <option value="Item">Item da NF-e</option>
              <option value="Nota">Nota fiscal</option>
            </select>
          </label>
          <fieldset className={styles.full}>
            <legend>
              Canais de venda <small>(nenhum = todos)</small>
            </legend>
            <div>
              {data.commercial.channels.map((channel) => (
                <label key={channel.id}>
                  <input
                    type="checkbox"
                    checked={draft.channelIds.includes(channel.id)}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        channelIds: event.target.checked
                          ? [...draft.channelIds, channel.id]
                          : draft.channelIds.filter((id) => id !== channel.id),
                      })
                    }
                  />
                  {channel.description}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || draft.name.length < 2 || !draft.value}
          >
            {saving ? (
              <LoaderCircle className={shell.spin} size={14} />
            ) : (
              <Check size={14} />
            )}{" "}
            Salvar custo
          </button>
        </footer>
      </section>
    </div>
  );
}

function DuplicateCostModal({
  draft,
  session,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: DuplicateCostDraft;
  session: SessionResponse;
  saving: boolean;
  onChange: (value: DuplicateCostDraft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const targets = session.availableTenants.filter(
    (tenant) =>
      tenant.id !== session.tenant.id &&
      !tenant.demo &&
      tenant.permissions.includes("costs:manage"),
  );
  const allSelected =
    targets.length > 0 &&
    targets.every((tenant) => draft.targetTenantIds.includes(tenant.id));
  return (
    <div className={styles.modalBackdrop} onMouseDown={onClose}>
      <section
        className={`${styles.modal} ${styles.duplicateModal}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-cost-title"
      >
        <header>
          <div>
            <span>REAPROVEITAR CONFIGURAÇÃO</span>
            <h2 id="duplicate-cost-title">Duplicar para outras unidades</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={17} />
          </button>
        </header>
        <div className={styles.duplicateSummary}>
          <span>
            {draft.cost.valueType === "P" ? (
              <Percent size={16} />
            ) : (
              <CircleDollarSign size={16} />
            )}
          </span>
          <div>
            <small>{draft.cost.category ?? "SEM CATEGORIA"}</small>
            <strong>{draft.cost.name}</strong>
            <p>
              {draft.cost.valueType === "P"
                ? `${draft.cost.value}%`
                : money(draft.cost.value)}{" "}
              por {draft.cost.application.toLowerCase()}
            </p>
          </div>
        </div>
        <div className={styles.duplicateHeading}>
          <div>
            <strong>Unidades de destino</strong>
            <p>
              A categoria será criada quando necessário. Canais são vinculados
              pelo ID do Bling ou pelo mesmo nome.
            </p>
          </div>
          {targets.length > 1 ? (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...draft,
                  targetTenantIds: allSelected
                    ? []
                    : targets.map((tenant) => tenant.id),
                })
              }
            >
              {allSelected ? "Limpar seleção" : "Selecionar todas"}
            </button>
          ) : null}
        </div>
        <div className={styles.tenantPicker}>
          {targets.map((tenant) => {
            const selected = draft.targetTenantIds.includes(tenant.id);
            return (
              <label
                key={tenant.id}
                className={selected ? styles.selectedTenant : ""}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      targetTenantIds: event.target.checked
                        ? [...draft.targetTenantIds, tenant.id]
                        : draft.targetTenantIds.filter(
                            (id) => id !== tenant.id,
                          ),
                    })
                  }
                />
                <span>
                  <Building2 size={16} />
                </span>
                <div>
                  <strong>{tenant.name}</strong>
                  <small>
                    {tenant.permissions.includes("costs:manage")
                      ? "Acesso administrativo"
                      : "Permissão para gerenciar custos"}
                  </small>
                </div>
                {selected ? <Check size={15} /> : null}
              </label>
            );
          })}
          {!targets.length ? (
            <div className={styles.noTargetTenants}>
              <Building2 size={22} />
              <strong>Nenhuma outra unidade disponível</strong>
              <p>
                Seu usuário precisa ter acesso de custos em outra unidade da
                empresa.
              </p>
            </div>
          ) : null}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || draft.targetTenantIds.length === 0}
          >
            {saving ? (
              <LoaderCircle className={shell.spin} size={14} />
            ) : (
              <Check size={14} />
            )}
            Duplicar para {draft.targetTenantIds.length || 0}{" "}
            {draft.targetTenantIds.length === 1 ? "unidade" : "unidades"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function money(value: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}
function dateLabel(value: string | null): string {
  if (!value) return "não informado";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
function boletoStatus(value: number | null): string {
  return value === 1
    ? "Em aberto"
    : value === 2
      ? "Pago"
      : value === 3
        ? "Cancelado"
        : "Não informado";
}
function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
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
