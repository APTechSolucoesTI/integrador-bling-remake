"use client";

import type {
  NfeDetailResponse,
  NfeSyncResponse,
  SessionResponse,
} from "@integrador/contracts";
import {
  Activity,
  ArrowLeft,
  Banknote,
  Bell,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CloudDownload,
  ExternalLink,
  FileCode2,
  FileText,
  Gauge,
  Goal,
  HelpCircle,
  Info,
  LoaderCircle,
  LogOut,
  Menu,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import styles from "./nfe-detail.module.css";
import shell from "./nfe.module.css";

export function NfeDetailClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [data, setData] = useState<NfeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionResponse, invoiceResponse] = await Promise.all([
        fetch(`${API_URL}/v1/auth/session`, { credentials: "include" }),
        fetch(`${API_URL}/v1/nfe/${params.id}`, { credentials: "include" }),
      ]);
      if (sessionResponse.status === 401 || invoiceResponse.status === 401) {
        router.replace("/login");
        return;
      }
      if (!sessionResponse.ok || !invoiceResponse.ok)
        throw new Error(invoiceResponse.status === 404 ? "not-found" : "api");
      setSession((await sessionResponse.json()) as SessionResponse);
      setData((await invoiceResponse.json()) as NfeDetailResponse);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "not-found"
          ? "Esta NF-e não existe ou pertence a outra empresa."
          : "Não foi possível carregar os detalhes da NF-e.",
      );
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    void load();
  }, [load]);
  async function syncDetails() {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/v1/nfe/${params.id}/sync`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const queued = (await response.json()) as NfeSyncResponse;
      setSuccess(
        `Atualização enviada para a fila (${queued.id.slice(0, 8)}). Acompanhe o processamento em Jobs e integrações.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível enfileirar a atualização da NF-e.",
      );
    } finally {
      setSyncing(false);
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
        <h1>Abrindo a NF-e</h1>
        <p>Carregando itens, documentos e cálculos persistidos.</p>
      </main>
    );
  if (!session || !data)
    return (
      <main className={shell.statePage}>
        <FileText size={28} />
        <h1>NF-e indisponível</h1>
        <p>{error}</p>
        <Link href="/app/nfe">Voltar às notas</Link>
      </main>
    );
  const invoice = data.invoice;
  const pdf = safeHttpUrl(invoice.linkPdf);
  const xml = safeHttpUrl(invoice.linkXml);

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
          <Link className={shell.active} href="/app/nfe">
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
            <Building2 size={17} /> Cadastros comerciais
          </Link>
          <Link href="/app/finance">
            <CircleDollarSign size={17} /> Custos e margem
          </Link>
          <Link href="/app/fiscal">
            <ReceiptText size={17} /> Custos e tributação
          </Link>
          <Link href="/app/goals">
            <Goal size={17} /> Metas
          </Link>
          <Link href="/app/operations">
            <Activity size={17} /> Jobs e integrações
          </Link>
          <p>ADMINISTRAÇÃO</p>
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
          <div className={styles.breadcrumb}>
            <Link href="/app/nfe">Notas fiscais</Link>
            <span>/</span>
            <strong>NF-e {invoice.numero}</strong>
          </div>
          <span className={shell.dbBadge}>
            <CheckCircle2 size={13} /> PostgreSQL legado
          </span>
          <button className={shell.iconButton} type="button">
            <Bell size={17} />
          </button>
          <div className={shell.avatar}>{initials(session.user.name)}</div>
        </header>
        <div className={shell.content}>
          <Link className={styles.back} href="/app/nfe">
            <ArrowLeft size={14} /> Voltar à listagem
          </Link>
          <section className={styles.hero}>
            <div>
              <span className={shell.eyebrow}>
                DOCUMENTO FISCAL · BLING {invoice.blingId}
              </span>
              <h1>NF-e {invoice.numero}</h1>
              <p>
                {invoice.cliente} · emitida em {dateLabel(invoice.dataEmissao)}
              </p>
            </div>
            <div className={styles.heroActions}>
              <button
                type="button"
                disabled={syncing || session.role === "viewer"}
                onClick={() => void syncDetails()}
              >
                <RefreshCw className={syncing ? shell.spin : ""} size={15} />{" "}
                {syncing ? "Enfileirando" : "Atualizar no Bling"}
              </button>
              {xml ? (
                <a href={xml} target="_blank" rel="noopener noreferrer">
                  <FileCode2 size={15} /> XML <ExternalLink size={11} />
                </a>
              ) : (
                <button disabled>
                  <FileCode2 size={15} /> XML indisponível
                </button>
              )}
              {pdf ? (
                <a
                  className={styles.primaryAction}
                  href={pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CloudDownload size={15} /> Abrir DANFE
                </a>
              ) : (
                <button disabled>
                  <ReceiptText size={15} /> DANFE indisponível
                </button>
              )}
            </div>
          </section>
          {success ? (
            <div className={styles.syncFeedback}>
              <CheckCircle2 size={15} />
              <span>{success}</span>
              <Link href="/app/operations">Ver fila</Link>
            </div>
          ) : null}
          {error ? (
            <div className={`${styles.syncFeedback} ${styles.syncError}`}>
              <Info size={15} />
              <span>{error}</span>
            </div>
          ) : null}
          <section className={styles.metrics}>
            <Metric
              label="Valor da nota"
              value={money(invoice.valor)}
              icon={<ReceiptText />}
            />
            <Metric
              label="Venda líquida"
              value={money(invoice.vendaLiquida)}
              icon={<Banknote />}
            />
            <Metric
              label="Lucro"
              value={money(invoice.lucro)}
              icon={<CircleDollarSign />}
              tone={Number(invoice.lucro) < 0 ? "red" : "green"}
            />
            <Metric
              label="Margem"
              value={`${invoice.margemLucro}%`}
              icon={<Activity />}
              tone={Number(invoice.margemLucro) < 0 ? "red" : "blue"}
            />
          </section>
          <div className={styles.detailGrid}>
            <section className={styles.panel}>
              <header>
                <div>
                  <span>DADOS DA NOTA</span>
                  <h2>Resumo operacional</h2>
                </div>
                <Status value={invoice.statusEnvio} />
              </header>
              <dl className={styles.infoGrid}>
                <InfoItem label="Cliente" value={invoice.cliente} />
                <InfoItem
                  label="Série"
                  value={invoice.serie?.toString() ?? "Não informada"}
                />
                <InfoItem
                  label="Canal de venda"
                  value={invoice.canalVenda ?? "Não informado"}
                />
                <InfoItem
                  label="Vendedor"
                  value={invoice.vendedor ?? "Não informado"}
                />
                <InfoItem
                  label="Natureza da operação"
                  value={invoice.naturezaOperacao ?? "Não informada"}
                />
                <InfoItem
                  label="Chave de acesso"
                  value={invoice.chaveAcesso ?? "Não informada"}
                  wide
                />
              </dl>
              {invoice.observacaoEnvio ? (
                <div className={styles.note}>
                  <Info size={14} />
                  <span>
                    <b>Observação de envio</b>
                    {invoice.observacaoEnvio}
                  </span>
                </div>
              ) : null}
            </section>
            <section className={styles.panel}>
              <header>
                <div>
                  <span>LOGÍSTICA</span>
                  <h2>Rastreamento</h2>
                </div>
                <Truck size={18} />
              </header>
              <div className={styles.trackingList}>
                {[invoice.codigoRastreio, invoice.codigoRastreio2]
                  .filter(Boolean)
                  .map((code) => (
                    <a
                      key={code}
                      href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(code!)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>
                        <Truck size={15} />
                      </span>
                      <div>
                        <small>CÓDIGO DE RASTREIO</small>
                        <strong>{code}</strong>
                      </div>
                      <ExternalLink size={13} />
                    </a>
                  ))}
                {!invoice.codigoRastreio && !invoice.codigoRastreio2 ? (
                  <div className={styles.emptyBlock}>
                    <PackageSearch size={22} />
                    <span>Sem código de rastreamento.</span>
                  </div>
                ) : null}
              </div>
              {invoice.dataEnvio ? (
                <p className={styles.sentAt}>
                  <Calendar size={13} /> Envio registrado em{" "}
                  {dateTime(invoice.dataEnvio)}
                </p>
              ) : null}
            </section>
          </div>
          <section className={styles.panel}>
            <header>
              <div>
                <span>COMPOSIÇÃO</span>
                <h2>Itens da NF-e</h2>
              </div>
              <b>{data.items.length} ITENS</b>
            </header>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Item / produto</th>
                    <th>CFOP</th>
                    <th>Quantidade</th>
                    <th>Venda líquida</th>
                    <th>Custo líquido</th>
                    <th>Impostos</th>
                    <th>Lucro</th>
                    <th>Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.nome}</strong>
                        <small>
                          {item.codigo ?? item.produtoId ?? "Sem código"}
                          {item.inconsistencia
                            ? ` · ${item.inconsistencia}`
                            : ""}
                        </small>
                      </td>
                      <td>{item.cfop ?? "—"}</td>
                      <td>{number(item.quantidade)}</td>
                      <td>{money(item.vendaLiquida)}</td>
                      <td>{money(item.custoLiquido)}</td>
                      <td>
                        {money(item.impostos)}
                        <small>
                          Créditos:{" "}
                          {money(
                            String(
                              Number(item.creditoIpi) +
                                Number(item.creditoIcms),
                            ),
                          )}
                        </small>
                      </td>
                      <td
                        className={
                          Number(item.lucro) < 0
                            ? styles.negative
                            : styles.positive
                        }
                      >
                        {money(item.lucro)}
                      </td>
                      <td
                        className={
                          Number(item.margemLucro) < 0
                            ? styles.negative
                            : styles.positive
                        }
                      >
                        {item.margemLucro}%
                      </td>
                    </tr>
                  ))}
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={styles.tableEmpty}>
                        Nenhum item persistido para esta nota.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
          <div className={styles.detailGrid}>
            <section className={styles.panel}>
              <header>
                <div>
                  <span>FINANCEIRO</span>
                  <h2>Composição do resultado</h2>
                </div>
                <CircleDollarSign size={18} />
              </header>
              <div className={styles.breakdown}>
                <Breakdown label="Valor bruto" value={invoice.valor} />
                <Breakdown label="Desconto" value={invoice.desconto} negative />
                <Breakdown label="Frete" value={invoice.frete} />
                <Breakdown
                  label="Outras despesas"
                  value={invoice.outrasDespesas}
                />
                <Breakdown
                  label="Custos líquidos"
                  value={invoice.custoLiquido}
                  negative
                />
                <Breakdown label="Impostos" value={invoice.impostos} negative />
                <Breakdown label="Taxas" value={invoice.taxa} negative />
                <Breakdown
                  label="Créditos fiscais"
                  value={String(
                    Number(invoice.creditoIpi) + Number(invoice.creditoIcms),
                  )}
                />
                <Breakdown
                  label="Lucro persistido"
                  value={invoice.lucro}
                  total
                />
              </div>
              {invoice.observacaoCalculo ? (
                <div className={styles.note}>
                  <Info size={14} />
                  <span>
                    <b>Observação do cálculo</b>
                    {invoice.observacaoCalculo}
                  </span>
                </div>
              ) : null}
            </section>
            <section className={styles.panel}>
              <header>
                <div>
                  <span>COBRANÇA</span>
                  <h2>Boletos vinculados</h2>
                </div>
                <b>{data.boletos.length} BOLETOS</b>
              </header>
              <div className={styles.boletoList}>
                {data.boletos.map((boleto) => {
                  const link = safeHttpUrl(boleto.link);
                  return (
                    <article key={boleto.id}>
                      <span>
                        <Banknote size={16} />
                      </span>
                      <div>
                        <strong>{money(boleto.valor)}</strong>
                        <small>
                          Vence {dateLabel(boleto.vencimento)} ·{" "}
                          {boleto.numeroExterno ?? `Boleto #${boleto.id}`}
                        </small>
                      </div>
                      <Status value={boletoStatus(boleto.situacao)} />
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Abrir boleto"
                        >
                          <ExternalLink size={14} />
                        </a>
                      ) : null}
                    </article>
                  );
                })}
                {data.boletos.length === 0 ? (
                  <div className={styles.emptyBlock}>
                    <Banknote size={22} />
                    <span>Nenhum boleto relacionado à NF-e.</span>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <article className={`${styles.metric} ${styles[tone]}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
function InfoItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? styles.wide : ""}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const tone = /erro|cancel|falha/i.test(value)
    ? styles.statusRed
    : /enviad|sucesso|pago/i.test(value)
      ? styles.statusGreen
      : styles.statusAmber;
  return (
    <span className={`${styles.status} ${tone}`}>
      <i />
      {value}
    </span>
  );
}
function Breakdown({
  label,
  value,
  negative,
  total,
}: {
  label: string;
  value: string;
  negative?: boolean;
  total?: boolean;
}) {
  return (
    <div className={total ? styles.breakdownTotal : ""}>
      <span>{label}</span>
      <strong>
        {negative && Number(value) > 0 ? "− " : ""}
        {money(value)}
      </strong>
    </div>
  );
}
function money(value: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}
function number(value: string): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(
    Number(value),
  );
}
function dateLabel(value: string | null): string {
  if (!value) return "não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
function dateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function boletoStatus(value: number | null): string {
  return value === 1
    ? "Em aberto"
    : value === 2
      ? "Pago"
      : value === 3
        ? "Cancelado"
        : "Situação não informada";
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
