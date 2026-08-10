"use client";

import type {
  MarketplaceFeeResponse,
  OperationsOverview,
  OperationsSettingsUpdate,
  SessionResponse,
} from "@integrador/contracts";
import {
  Activity,
  Bell,
  Boxes,
  Building2,
  CheckCircle2,
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  Gauge,
  Goal,
  HelpCircle,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  ShoppingBag,
  TriangleAlert,
  Users,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import shell from "../nfe/nfe.module.css";
import styles from "./operations.module.css";

const integrationMeta = {
  bling: { name: "Bling v3", icon: Zap, tone: "green" },
  apchat: { name: "APChat", icon: MessageCircle, tone: "blue" },
  mercado_livre: { name: "Mercado Livre", icon: ShoppingBag, tone: "yellow" },
} as const;

export function OperationsClient() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [overview, setOverview] = useState<OperationsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [queueingJob, setQueueingJob] = useState<string | null>(null);
  const [testingApchat, setTestingApchat] = useState(false);
  const [marketplaceOrderId, setMarketplaceOrderId] = useState("");
  const [marketplaceFee, setMarketplaceFee] = useState<string | null>(null);
  const [loadingMarketplaceFee, setLoadingMarketplaceFee] = useState(false);
  const [syncPeriod, setSyncPeriod] = useState(initialSyncPeriod);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionResponse, overviewResponse] = await Promise.all([
        fetch(`${API_URL}/v1/auth/session`, { credentials: "include" }),
        fetch(`${API_URL}/v1/operations`, { credentials: "include" }),
      ]);
      if (sessionResponse.status === 401 || overviewResponse.status === 401) {
        router.replace("/login");
        return;
      }
      if (!sessionResponse.ok || !overviewResponse.ok) throw new Error("api");
      setSession((await sessionResponse.json()) as SessionResponse);
      setOverview((await overviewResponse.json()) as OperationsOverview);
    } catch {
      setError("Não foi possível carregar o estado operacional desta empresa.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("oauth") !== "connected") return;
    const integration =
      query.get("integration") === "mercado_livre" ? "Mercado Livre" : "Bling";
    setSuccess(`${integration} conectado com sucesso.`);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  async function logout() {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    router.replace("/login");
  }

  async function saveConfiguration(input: OperationsSettingsUpdate) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/v1/operations/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setOverview((await response.json()) as OperationsOverview);
      setSuccess("Configuração operacional atualizada.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a configuração.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function authorize(kind: "bling" | "mercado_livre" | "apchat") {
    if (kind === "apchat") return;
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/operations/authorization/${kind}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const body = (await response.json()) as { url: string };
      window.location.assign(body.url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível iniciar a autorização.",
      );
    }
  }

  async function enqueueBlingSync(
    jobType:
      "bling.sync-nfe" | "bling.sync-products" | "bling.sync-sales-orders",
  ) {
    setQueueingJob(jobType);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/v1/operations/jobs`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          jobType === "bling.sync-products"
            ? { jobType }
            : { jobType, from: syncPeriod.from, to: syncPeriod.to },
        ),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const labels = {
        "bling.sync-nfe": "NF-e",
        "bling.sync-products": "produtos",
        "bling.sync-sales-orders": "pedidos de venda",
      } as const;
      setSuccess(
        `Sincronização de ${labels[jobType]} adicionada à fila. O andamento já aparece abaixo.`,
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível agendar a sincronização.",
      );
    } finally {
      setQueueingJob(null);
    }
  }

  async function enqueueApchatTest(recipient: string) {
    setTestingApchat(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/v1/operations/jobs`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobType: "apchat.deliver",
          recipient,
          body: `Mensagem de homologação APBling · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())}`,
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setSuccess(
        "Mensagem de homologação adicionada à fila. O número de teste configurado tem prioridade.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível agendar o teste do APChat.",
      );
    } finally {
      setTestingApchat(false);
    }
  }

  async function lookupMarketplaceFee() {
    setLoadingMarketplaceFee(true);
    setMarketplaceFee(null);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/integrations/mercado-livre/orders/${encodeURIComponent(marketplaceOrderId)}/fees`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as MarketplaceFeeResponse;
      setMarketplaceFee(result.fee);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível consultar a tarifa do Mercado Livre.",
      );
    } finally {
      setLoadingMarketplaceFee(false);
    }
  }

  if (!session && loading)
    return (
      <main className={shell.statePage}>
        <LoaderCircle className={shell.spin} size={28} />
        <h1>Carregando operação</h1>
      </main>
    );
  if (!session)
    return (
      <main className={shell.statePage}>
        <Activity size={28} />
        <h1>Central operacional indisponível</h1>
        <p>{error}</p>
        <Link href="/login">Voltar ao login</Link>
      </main>
    );

  const completed =
    overview?.jobs.filter((job) => job.status === "completed").length ?? 0;
  const failed =
    overview?.jobs.filter((job) => job.status === "failed").length ?? 0;
  const active =
    overview?.jobs.filter(
      (job) => job.status === "active" || job.status === "queued",
    ).length ?? 0;

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
        <button className={shell.tenant} type="button" disabled>
          <span>
            <Building2 size={16} />
          </span>
          <div>
            <small>Organização</small>
            <strong>{session.tenant.name}</strong>
          </div>
          <ChevronDown size={14} />
        </button>
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
            <ShoppingBag size={17} /> Cadastros comerciais
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
          <Link className={shell.active} href="/app/operations">
            <Activity size={17} /> Jobs e integrações
          </Link>
          <p>ADMINISTRAÇÃO</p>
          {session.user.superAdmin ? (
            <Link href="/app/organizations">
              <Building2 size={17} /> Empresas
            </Link>
          ) : null}
          {session.role === "owner" || session.role === "admin" ? (
            <Link href="/app/users">
              <ShieldCheck size={17} /> Usuários e acesso
            </Link>
          ) : null}
          <Link href="/app/settings">
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
            <Activity size={16} />
            <span>Monitor operacional</span>
          </div>
          <span className={shell.dbBadge}>
            <span className={styles.liveDot} /> Atualização sob demanda
          </span>
          <button className={shell.iconButton} type="button">
            <Bell size={17} />
          </button>
          <div className={shell.avatar}>{initials(session.user.name)}</div>
        </header>

        <div className={shell.content}>
          <section className={shell.titleRow}>
            <div>
              <span className={shell.eyebrow}>SAÚDE OPERACIONAL</span>
              <h1>Jobs e integrações</h1>
              <p>
                Conexões do legado, execuções BullMQ e eventos recentes por
                empresa.
              </p>
            </div>
            <button
              className={shell.refreshButton}
              type="button"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={loading ? shell.spin : ""} size={15} />{" "}
              Atualizar estado
            </button>
          </section>

          <section className={styles.metrics}>
            <Metric
              icon={<CheckCircle2 />}
              label="Concluídos"
              value={completed}
              tone="green"
            />
            <Metric
              icon={<Clock3 />}
              label="Em andamento"
              value={active}
              tone="blue"
            />
            <Metric
              icon={<XCircle />}
              label="Falhas"
              value={failed}
              tone="red"
            />
            <Metric
              icon={<Activity />}
              label="Eventos legados"
              value={overview?.legacyLogs.length ?? 0}
              tone="gray"
            />
          </section>

          <section className={styles.section}>
            <header>
              <div>
                <span>CONEXÕES</span>
                <h2>Integrações da empresa</h2>
              </div>
              <small>Nenhum token é retornado ao navegador</small>
            </header>
            <div className={styles.integrationGrid}>
              {overview?.integrations.map((integration) => {
                const meta = integrationMeta[integration.kind];
                const Icon = meta.icon;
                return (
                  <article
                    className={styles.integrationCard}
                    key={integration.kind}
                  >
                    <div
                      className={`${styles.integrationIcon} ${styles[meta.tone]}`}
                    >
                      <Icon size={20} />
                    </div>
                    <div className={styles.integrationCopy}>
                      <span>{integration.enabled ? "ATIVA" : "INATIVA"}</span>
                      <h3>{meta.name}</h3>
                      <p>
                        {integration.detail ??
                          "Credenciais ainda não configuradas"}
                      </p>
                    </div>
                    <span
                      className={`${styles.connection} ${integration.configured ? styles.connected : ""}`}
                    >
                      <i /> {integration.status}
                    </span>
                    <footer>
                      <small>
                        {integration.updatedAt
                          ? `Atualizada ${relativeTime(integration.updatedAt)}`
                          : "Sem atualização registrada"}
                      </small>
                      {integration.kind === "apchat" ? (
                        <a href="#operation-settings">Configurar</a>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            !(
                              session.role === "owner" ||
                              session.role === "admin"
                            ) ||
                            !(integration.kind === "bling"
                              ? overview.configuration.authorization.bling
                              : overview.configuration.authorization
                                  .mercadoLivre)
                          }
                          onClick={() => void authorize(integration.kind)}
                        >
                          Autorizar
                        </button>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.manualSync}>
            <div>
              <span>SINCRONIZAÇÃO SOB DEMANDA</span>
              <h2>Atualizar dados operacionais do Bling</h2>
              <p>
                NF-e e pedidos respeitam o período selecionado. Produtos usam a
                última atualização local com um dia de sobreposição, como no
                legado. Tudo é persistido na unidade ativa.
              </p>
            </div>
            <label>
              <span>Data inicial</span>
              <input
                type="date"
                value={syncPeriod.from}
                onChange={(event) =>
                  setSyncPeriod({ ...syncPeriod, from: event.target.value })
                }
              />
            </label>
            <label>
              <span>Data final</span>
              <input
                type="date"
                value={syncPeriod.to}
                onChange={(event) =>
                  setSyncPeriod({ ...syncPeriod, to: event.target.value })
                }
              />
            </label>
            <div className={styles.syncActions}>
              <button
                type="button"
                disabled={
                  Boolean(queueingJob) ||
                  session.role === "viewer" ||
                  !syncPeriod.from ||
                  !syncPeriod.to
                }
                onClick={() => void enqueueBlingSync("bling.sync-nfe")}
              >
                {queueingJob === "bling.sync-nfe" ? (
                  <LoaderCircle className={shell.spin} size={15} />
                ) : (
                  <FileText size={15} />
                )}
                Atualizar NF-e
              </button>
              <button
                type="button"
                disabled={Boolean(queueingJob) || session.role === "viewer"}
                onClick={() => void enqueueBlingSync("bling.sync-products")}
              >
                {queueingJob === "bling.sync-products" ? (
                  <LoaderCircle className={shell.spin} size={15} />
                ) : (
                  <Boxes size={15} />
                )}
                Atualizar produtos
              </button>
              <button
                type="button"
                disabled={
                  Boolean(queueingJob) ||
                  session.role === "viewer" ||
                  !syncPeriod.from ||
                  !syncPeriod.to
                }
                onClick={() => void enqueueBlingSync("bling.sync-sales-orders")}
              >
                {queueingJob === "bling.sync-sales-orders" ? (
                  <LoaderCircle className={shell.spin} size={15} />
                ) : (
                  <ShoppingBag size={15} />
                )}
                Atualizar pedidos
              </button>
            </div>
          </section>

          <section
            className={`${styles.manualSync} ${styles.marketplaceLookup}`}
          >
            <div>
              <span>MARKETPLACE EM TEMPO REAL</span>
              <h2>Consultar tarifa da order</h2>
              {marketplaceFee === null ? (
                <p>
                  Lê a order autenticada e prioriza a tarifa total informada
                  pelo pagamento, com fallback para a tarifa unitária dos itens.
                </p>
              ) : (
                <strong className={styles.feeResult}>
                  Tarifa Mercado Livre: {money(marketplaceFee)}
                </strong>
              )}
            </div>
            <label>
              <span>ID da order</span>
              <input
                inputMode="numeric"
                value={marketplaceOrderId}
                onChange={(event) =>
                  setMarketplaceOrderId(event.target.value.replace(/\D/g, ""))
                }
                placeholder="2000003508419013"
              />
            </label>
            <button
              type="button"
              disabled={loadingMarketplaceFee || !marketplaceOrderId}
              onClick={() => void lookupMarketplaceFee()}
            >
              {loadingMarketplaceFee ? (
                <LoaderCircle className={shell.spin} size={15} />
              ) : (
                <ShoppingBag size={15} />
              )}
              Consultar tarifa
            </button>
          </section>

          {overview ? (
            <OperationalSettings
              overview={overview}
              canEdit={session.role === "owner" || session.role === "admin"}
              saving={saving}
              testingApchat={testingApchat}
              onSave={saveConfiguration}
              onTestApchat={enqueueApchatTest}
            />
          ) : null}

          <section className={styles.activityGrid}>
            <article className={styles.listPanel}>
              <header>
                <div>
                  <span>CONTROL PLANE</span>
                  <h2>Execuções BullMQ</h2>
                </div>
                <Activity size={17} />
              </header>
              <div className={styles.listBody}>
                {overview?.jobs.length === 0 ? (
                  <Empty text="Nenhum job moderno executado para esta empresa." />
                ) : null}
                {overview?.jobs.map((job) => (
                  <div className={styles.jobRow} key={job.id}>
                    <StatusIcon status={job.status} />
                    <span>
                      <strong>{friendlyJob(job.type)}</strong>
                      <small>
                        {formatDateTime(job.createdAt)} · tentativa{" "}
                        {job.attempt}
                      </small>
                      {job.errorMessage ? <em>{job.errorMessage}</em> : null}
                    </span>
                    <b className={styles[job.status]}>{job.status}</b>
                  </div>
                ))}
              </div>
            </article>
            <article className={styles.listPanel}>
              <header>
                <div>
                  <span>SAAS AUDIT</span>
                  <h2>Auditoria moderna</h2>
                </div>
                <ShieldCheck size={17} />
              </header>
              <div className={styles.listBody}>
                {overview?.auditLogs.length === 0 ? (
                  <Empty text="Nenhum evento de auditoria registrado." />
                ) : null}
                {overview?.auditLogs.map((log) => (
                  <div className={styles.logRow} key={log.id}>
                    <span className={styles.logOk}>
                      <ShieldCheck size={14} />
                    </span>
                    <div>
                      <strong>{friendlyAudit(log.action)}</strong>
                      <small>
                        {log.entityType}
                        {log.entityId ? ` #${log.entityId}` : ""} ·{" "}
                        {formatDateTime(log.createdAt)}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.listPanel}>
              <header>
                <div>
                  <span>LEGADO</span>
                  <h2>Logs de operação</h2>
                </div>
                <Clock3 size={17} />
              </header>
              <div className={styles.listBody}>
                {overview?.legacyLogs.length === 0 ? (
                  <Empty text="Nenhum log legado registrado para esta empresa." />
                ) : null}
                {overview?.legacyLogs.map((log) => (
                  <div className={styles.logRow} key={log.id}>
                    <span
                      className={
                        log.status === 0 ? styles.logOk : styles.logError
                      }
                    >
                      {log.status === 0 ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <TriangleAlert size={14} />
                      )}
                    </span>
                    <div>
                      <strong>{log.message}</strong>
                      <small>
                        {log.source}.{log.method} ·{" "}
                        {formatDateTime(log.occurredAt)}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
          {error ? <div className={shell.error}>{error}</div> : null}
          {success ? (
            <div className={styles.success}>
              <CheckCircle2 size={13} /> {success}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <article className={styles.metric}>
      <span className={styles[tone]}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
function Empty({ text }: { text: string }) {
  return <div className={styles.empty}>{text}</div>;
}
function StatusIcon({
  status,
}: {
  status: OperationsOverview["jobs"][number]["status"];
}) {
  if (status === "completed")
    return <CheckCircle2 className={styles.okIcon} size={17} />;
  if (status === "failed")
    return <XCircle className={styles.failIcon} size={17} />;
  return <LoaderCircle className={styles.waitIcon} size={17} />;
}
function friendlyJob(type: string): string {
  const labels: Record<string, string> = {
    "bling.sync-nfe": "Sincronização de NF-e",
    "bling.sync-products": "Sincronização de produtos",
    "bling.sync-sales-orders": "Sincronização de pedidos de venda",
    "bling.refresh-token": "Renovação do token Bling",
    "nfe.sync-details": "Atualização de documentos da NF-e",
    "nfe.process-xml": "Processamento de XML",
    "apchat.deliver": "Envio APChat",
    "goals.process-expired": "Processamento de metas",
  };
  return labels[type] ?? type;
}
function friendlyAudit(action: string): string {
  const labels: Record<string, string> = {
    "auth.login": "Entrada no sistema",
    "administration.user.created": "Usuário criado",
    "administration.user.updated": "Acesso atualizado",
    "administration.settings.updated": "Configurações atualizadas",
    "business.fixed_cost.created": "Custo criado",
    "business.fixed_cost.updated": "Custo atualizado",
    "people.messaging.updated": "Preferência de mensagens atualizada",
    "goals.created": "Meta criada",
    "goals.finalized": "Meta finalizada e próxima competência criada",
    "goals.cancelled": "Meta cancelada",
    "operations.job.queued": "Rotina operacional enviada para a fila",
    "organization.created": "Organização criada",
    "bling.refresh.success": "Token Bling renovado",
    "bling.refresh.revoked": "Acesso Bling revogado",
    "bling.refresh.transient_failure": "Falha temporária ao renovar o Bling",
    "bling.refresh.not_found": "Token Bling não encontrado",
    "nfe.details.queued": "Atualização da NF-e enviada para a fila",
    "nfe.details.synchronized": "Documentos da NF-e atualizados",
    "apchat.message.accepted": "Mensagem aceita pelo APChat",
    "bling.oauth.connected": "OAuth do Bling conectado",
    "bling.products.synchronized": "Produtos sincronizados com o Bling",
    "bling.sales_orders.synchronized":
      "Pedidos de venda sincronizados com o Bling",
    "mercado_livre.oauth.connected": "OAuth do Mercado Livre conectado",
    "mercado_livre.order.fees_read": "Tarifa de order consultada",
  };
  return labels[action] ?? action;
}
function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
function relativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(0, Math.round(diff / 3_600_000));
  return hours < 24 ? `há ${hours}h` : `há ${Math.round(hours / 24)}d`;
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
function initialSyncPeriod(): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 7);
  return { from: localDate(start), to: localDate(today) };
}
function localDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function money(value: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function OperationalSettings({
  overview,
  canEdit,
  saving,
  testingApchat,
  onSave,
  onTestApchat,
}: {
  overview: OperationsOverview;
  canEdit: boolean;
  saving: boolean;
  testingApchat: boolean;
  onSave: (input: OperationsSettingsUpdate) => Promise<void>;
  onTestApchat: (recipient: string) => Promise<void>;
}) {
  const [hours, setHours] = useState(overview.configuration.schedule.hours);
  const [apchat, setApchat] = useState({
    ...overview.configuration.apchat,
    token: "",
  });
  const [survey, setSurvey] = useState({
    ...overview.configuration.satisfaction,
  });
  useEffect(() => {
    setHours(overview.configuration.schedule.hours);
    setApchat({ ...overview.configuration.apchat, token: "" });
    setSurvey({ ...overview.configuration.satisfaction });
  }, [overview]);
  return (
    <section className={styles.settingsSection} id="operation-settings">
      <header>
        <div>
          <span>AUTOMAÇÃO</span>
          <h2>Configurações operacionais</h2>
        </div>
        <small>Alterações aplicadas somente à empresa ativa</small>
      </header>
      <div className={styles.settingsGrid}>
        <article className={styles.settingsCard}>
          <header>
            <span>
              <CalendarClock size={18} />
            </span>
            <div>
              <h3>Sincronização automática</h3>
              <p>Horas em que o dispatcher legado agenda a sincronização.</p>
            </div>
          </header>
          <div className={styles.hours}>
            {Array.from({ length: 24 }, (_, hour) => (
              <button
                className={hours.includes(hour) ? styles.hourActive : ""}
                type="button"
                key={hour}
                disabled={!canEdit}
                onClick={() =>
                  setHours((current) =>
                    current.includes(hour)
                      ? current.filter((value) => value !== hour)
                      : [...current, hour].sort((a, b) => a - b),
                  )
                }
              >
                {String(hour).padStart(2, "0")}h
              </button>
            ))}
          </div>
          {canEdit ? (
            <button
              className={styles.saveButton}
              type="button"
              disabled={saving}
              onClick={() => void onSave({ kind: "schedule", hours })}
            >
              <Save size={13} /> Salvar horários
            </button>
          ) : null}
        </article>
        <article className={styles.settingsCard}>
          <header>
            <span>
              <MessageCircle size={18} />
            </span>
            <div>
              <h3>Canal APChat</h3>
              <p>
                Credenciais e números operacionais; o token nunca é retornado.
              </p>
            </div>
          </header>
          <div className={styles.configForm}>
            <label>
              <span>UUID</span>
              <input
                disabled={!canEdit}
                value={apchat.uuid ?? ""}
                onChange={(event) =>
                  setApchat({ ...apchat, uuid: event.target.value })
                }
              />
            </label>
            <label>
              <span>
                {apchat.configured ? "Novo token (opcional)" : "Token"}
              </span>
              <input
                disabled={!canEdit}
                type="password"
                value={apchat.token}
                onChange={(event) =>
                  setApchat({ ...apchat, token: event.target.value })
                }
                placeholder={
                  apchat.configured ? "Manter token atual" : "Informe o token"
                }
              />
            </label>
            <label>
              <span>Número de envio</span>
              <input
                disabled={!canEdit}
                value={apchat.sendNumber ?? ""}
                onChange={(event) =>
                  setApchat({ ...apchat, sendNumber: event.target.value })
                }
              />
            </label>
            <label>
              <span>Número de relatório</span>
              <input
                disabled={!canEdit}
                value={apchat.reportNumber ?? ""}
                onChange={(event) =>
                  setApchat({ ...apchat, reportNumber: event.target.value })
                }
              />
            </label>
            <label>
              <span>Número de homologação</span>
              <input
                disabled={!canEdit}
                value={apchat.testNumber ?? ""}
                onChange={(event) =>
                  setApchat({ ...apchat, testNumber: event.target.value })
                }
              />
            </label>
            <label className={styles.checkLabel}>
              <input
                disabled={!canEdit}
                type="checkbox"
                checked={apchat.messagesOpen}
                onChange={(event) =>
                  setApchat({ ...apchat, messagesOpen: event.target.checked })
                }
              />
              Manter ticket aberto após envio
            </label>
          </div>
          {canEdit ? (
            <div className={styles.settingsActions}>
              <button
                className={styles.saveButton}
                type="button"
                disabled={saving || !apchat.uuid}
                onClick={() =>
                  void onSave({
                    kind: "apchat",
                    uuid: apchat.uuid!,
                    token: apchat.token || undefined,
                    sendNumber: apchat.sendNumber || null,
                    reportNumber: apchat.reportNumber || null,
                    testNumber: apchat.testNumber || null,
                    messagesOpen: apchat.messagesOpen,
                  })
                }
              >
                <Save size={13} /> Salvar APChat
              </button>
              <button
                className={styles.saveButton}
                type="button"
                disabled={
                  testingApchat ||
                  !apchat.configured ||
                  !(apchat.testNumber || apchat.sendNumber)
                }
                onClick={() =>
                  void onTestApchat((apchat.testNumber || apchat.sendNumber)!)
                }
              >
                {testingApchat ? (
                  <LoaderCircle className={shell.spin} size={13} />
                ) : (
                  <MessageCircle size={13} />
                )}
                Enviar teste
              </button>
            </div>
          ) : null}
        </article>
        <article className={styles.settingsCard}>
          <header>
            <span>
              <MessageCircle size={18} />
            </span>
            <div>
              <h3>Pesquisa de satisfação</h3>
              <p>Disparo após o envio, usando as variáveis do legado.</p>
            </div>
          </header>
          <div className={styles.configForm}>
            <label className={styles.checkLabel}>
              <input
                disabled={!canEdit}
                type="checkbox"
                checked={survey.enabled}
                onChange={(event) =>
                  setSurvey({ ...survey, enabled: event.target.checked })
                }
              />
              Habilitar envio automático
            </label>
            <div className={styles.twoFields}>
              <label>
                <span>Dias após envio</span>
                <input
                  disabled={!canEdit}
                  type="number"
                  min="0"
                  max="20"
                  value={survey.daysAfterShipping}
                  onChange={(event) =>
                    setSurvey({
                      ...survey,
                      daysAfterShipping: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                <span>Horário</span>
                <select
                  disabled={!canEdit}
                  value={survey.hour ?? ""}
                  onChange={(event) =>
                    setSurvey({
                      ...survey,
                      hour: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">Selecione</option>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Link da pesquisa</span>
              <input
                disabled={!canEdit}
                value={survey.link ?? ""}
                onChange={(event) =>
                  setSurvey({ ...survey, link: event.target.value })
                }
              />
            </label>
            <label>
              <span>Mensagem</span>
              <textarea
                disabled={!canEdit}
                value={survey.message ?? ""}
                onChange={(event) =>
                  setSurvey({ ...survey, message: event.target.value })
                }
                placeholder="Olá {cliente}... {pesquisa}"
              />
            </label>
            <small className={styles.variables}>
              Variáveis: {"{cliente}"}, {"{empresa}"}, {"{pesquisa}"}
            </small>
          </div>
          {canEdit ? (
            <button
              className={styles.saveButton}
              type="button"
              disabled={saving}
              onClick={() =>
                void onSave({
                  kind: "satisfaction",
                  enabled: survey.enabled,
                  daysAfterShipping: survey.daysAfterShipping,
                  hour: survey.hour,
                  link: survey.link || null,
                  message: survey.message || null,
                })
              }
            >
              <Save size={13} /> Salvar pesquisa
            </button>
          ) : null}
        </article>
      </div>
    </section>
  );
}
