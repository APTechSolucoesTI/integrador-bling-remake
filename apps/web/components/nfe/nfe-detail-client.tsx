"use client";

import type {
  NfeDetailResponse,
  NfeSyncResponse,
  ProductListResponse,
  SessionResponse,
} from "@integrador/contracts";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Boxes,
  Building2,
  Calendar,
  Calculator,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CloudDownload,
  ExternalLink,
  FileCode2,
  FileText,
  Gauge,
  Goal,
  Info,
  LoaderCircle,
  Link2,
  LogOut,
  Menu,
  Orbit,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  Truck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import {
  blingProductUrl,
  FinancialInvoiceItemsDetail,
} from "../shared/invoice-items-detail";
import { ApplicationSidebar } from "../layout/application-sidebar";
import { ApplicationHeaderActions } from "../layout/application-header-actions";
import { ApplicationGlobalSearch } from "../layout/application-global-search";
import styles from "./nfe-detail.module.css";
import shell from "./nfe.module.css";

export function NfeDetailClient({
  financial = false,
}: {
  financial?: boolean;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTarget = safeReturnTarget(searchParams.get("returnTo"));
  const backHref = returnTarget ?? (financial ? "/app/finance" : "/app/nfe");
  const backLabel = returnTarget?.startsWith("/app/reports/")
    ? "Voltar ao relatório"
    : returnTarget?.startsWith("/app/dashboard")
      ? "Voltar ao dashboard"
      : "Voltar à listagem";
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [data, setData] = useState<NfeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [normalizingItem, setNormalizingItem] = useState<
    NfeDetailResponse["items"][number] | null
  >(null);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<ProductListResponse["items"]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  );
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionResponse, invoiceResponse] = await Promise.all([
        fetch(`${API_URL}/v1/auth/session`, { credentials: "include" }),
        fetch(
          `${API_URL}/v1/nfe/${params.id}${financial ? "/financial" : ""}`,
          { credentials: "include" },
        ),
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
  }, [financial, params.id, router]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!normalizingItem) return;
    const controller = new AbortController();
    const searchProducts = async () => {
      setLoadingProducts(true);
      setProductError(null);
      try {
        const query = new URLSearchParams({ page: "1", pageSize: "30" });
        if (productSearch.trim()) query.set("search", productSearch.trim());
        const response = await fetch(`${API_URL}/v1/products?${query}`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await responseMessage(response));
        const result = (await response.json()) as ProductListResponse;
        setProducts(result.items);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        setProductError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível buscar os produtos.",
        );
      } finally {
        if (!controller.signal.aborted) setLoadingProducts(false);
      }
    };
    const timer = window.setTimeout(() => void searchProducts(), 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizingItem, productSearch]);
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
  function openNormalization(item: NfeDetailResponse["items"][number]) {
    setNormalizingItem(item);
    setProductSearch(item.codigo ?? "");
    setSelectedProductId(null);
    setProducts([]);
    setProductError(null);
  }
  async function normalizeItem() {
    if (!normalizingItem || selectedProductId === null) return;
    setNormalizing(true);
    setProductError(null);
    try {
      const response = await fetch(
        `${API_URL}/v1/nfe/${params.id}/items/${normalizingItem.id}/normalize`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productId: selectedProductId }),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const queued = (await response.json()) as NfeSyncResponse;
      setNormalizingItem(null);
      setSuccess(
        `Produto vinculado. Recálculo enviado para a fila (${queued.id.slice(0, 8)}).`,
      );
      await load();
    } catch (cause) {
      setProductError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível vincular o produto.",
      );
    } finally {
      setNormalizing(false);
    }
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
        <Link href={backHref}>{backLabel}</Link>
      </main>
    );
  const invoice = data.invoice;
  const pdf = safeHttpUrl(invoice.linkPdf);
  const xml = safeHttpUrl(invoice.linkXml);

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
          <Link className={styles.back} href={backHref}>
            <ArrowLeft size={14} /> {backLabel}
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
                disabled={
                  syncing || !session.permissions.includes("nfe:manage")
                }
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
          <section
            className={`${styles.metrics} ${!financial ? styles.operationalMetrics : ""}`}
          >
            <Metric
              label="Valor da nota"
              value={money(invoice.valor)}
              icon={<ReceiptText />}
            />
            {financial ? (
              <>
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
              </>
            ) : (
              <>
                <Metric
                  label="Itens"
                  value={String(data.items.length)}
                  icon={<Boxes />}
                />
                <Metric
                  label="Boletos"
                  value={String(data.boletos.length)}
                  icon={<Banknote />}
                />
                <Metric
                  label="Envio"
                  value={invoice.statusEnvio}
                  icon={<Activity />}
                  tone={invoice.statusEnvio === "Falhou" ? "red" : "green"}
                />
              </>
            )}
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
            {financial ? (
              <FinancialInvoiceItemsDetail
                items={data.items}
                showHeading={false}
                showActions
                canNormalize={session.permissions.includes("people:manage")}
                onNormalize={openNormalization}
              />
            ) : (
              <div className={styles.tableWrap}>
                <table
                  className={financial ? styles.financialItemsTable : undefined}
                >
                  <thead>
                    <tr>
                      <th>Item / produto</th>
                      <th>CFOP</th>
                      <th>Quantidade</th>
                      {financial ? (
                        <>
                          <th>Desconto do item</th>
                          <th>Frete do item</th>
                          <th>Outras despesas</th>
                          <th>Venda líquida</th>
                          <th>Custo líquido</th>
                          <th>Impostos</th>
                          <th>Lucro</th>
                          <th>Margem</th>
                        </>
                      ) : null}
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          item.inconsistencia
                            ? styles.inconsistentRow
                            : undefined
                        }
                      >
                        <td>
                          <strong>{item.nome}</strong>
                          <small className={styles.productCode}>
                            {item.codigo ?? item.produtoId ?? "Sem código"}
                          </small>
                          {item.produtoId ? (
                            <a
                              className={styles.blingProductLink}
                              href={blingProductUrl(item.produtoId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Abrir ${item.nome} no Bling`}
                              title="Abrir produto no Bling"
                            >
                              <PackageSearch size={14} /> Abrir no Bling
                            </a>
                          ) : null}
                          {item.inconsistencia ? (
                            <span className={styles.inconsistencyBadge}>
                              <AlertTriangle size={12} />
                              <span>{item.inconsistencia}</span>
                            </span>
                          ) : null}
                        </td>
                        <td>{item.cfop ?? "—"}</td>
                        <td>{number(item.quantidade)}</td>
                        {financial ? (
                          <>
                            <td>{money(item.desconto)}</td>
                            <td>{money(item.frete)}</td>
                            <td
                              className={
                                Number(item.outrasDespesas) > 0
                                  ? styles.expenseValue
                                  : undefined
                              }
                              title="Valor informado no campo vOutro do XML da NF-e"
                            >
                              {money(item.outrasDespesas)}
                              {Number(item.outrasDespesas) > 0 ? (
                                <small>Campo vOutro do XML</small>
                              ) : null}
                            </td>
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
                          </>
                        ) : null}
                        <td>
                          {item.produtoId === null &&
                          session.permissions.includes("people:manage") ? (
                            <button
                              className={styles.normalizeButton}
                              type="button"
                              onClick={() => openNormalization(item)}
                            >
                              <Link2 size={13} /> Vincular produto
                            </button>
                          ) : (
                            <span className={styles.linkedProduct}>
                              {item.produtoId ? "Vinculado" : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {data.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={financial ? 12 : 4}
                          className={styles.tableEmpty}
                        >
                          Nenhum item persistido para esta nota.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {financial && data.financialBreakdown ? (
            <FinancialMemory
              breakdown={data.financialBreakdown}
              calculationNote={invoice.observacaoCalculo}
            />
          ) : null}
          <div
            className={`${styles.detailGrid} ${financial ? styles.billingGrid : ""}`}
          >
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
      {normalizingItem ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={() => !normalizing && setNormalizingItem(null)}
        >
          <section
            className={styles.normalizationModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="normalize-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>NORMALIZAÇÃO DE ITEM</span>
                <h2 id="normalize-title">Vincular produto sincronizado</h2>
                <p>
                  Item {normalizingItem.item ?? normalizingItem.id}:{" "}
                  {normalizingItem.nome}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                disabled={normalizing}
                onClick={() => setNormalizingItem(null)}
              >
                <X size={17} />
              </button>
            </header>
            <label className={styles.productSearch}>
              <span>Buscar por nome, SKU ou ID Bling</span>
              <div>
                <Search size={15} />
                <input
                  autoFocus
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Digite para localizar o produto correto"
                />
                {loadingProducts ? (
                  <LoaderCircle className={shell.spin} size={15} />
                ) : null}
              </div>
            </label>
            {productError ? (
              <p className={styles.productError}>{productError}</p>
            ) : null}
            <div className={styles.productResults}>
              {products.map((product) => (
                <button
                  className={
                    selectedProductId === product.id
                      ? styles.selectedProduct
                      : ""
                  }
                  type="button"
                  key={product.id}
                  onClick={() => setSelectedProductId(product.id)}
                >
                  <span>
                    <strong>{product.nome}</strong>
                    <small>
                      SKU {product.codigo ?? "não informado"} · Bling{" "}
                      {product.blingId ?? "sem ID"}
                    </small>
                  </span>
                  <b>{product.custo ? money(product.custo) : "Sem custo"}</b>
                </button>
              ))}
              {!loadingProducts && products.length === 0 && !productError ? (
                <p>Nenhum produto sincronizado encontrado.</p>
              ) : null}
            </div>
            <footer>
              <button
                type="button"
                disabled={normalizing}
                onClick={() => setNormalizingItem(null)}
              >
                Cancelar
              </button>
              <button
                className={styles.confirmNormalization}
                type="button"
                disabled={normalizing || selectedProductId === null}
                onClick={() => void normalizeItem()}
              >
                {normalizing ? (
                  <LoaderCircle className={shell.spin} size={14} />
                ) : (
                  <Link2 size={14} />
                )}
                Vincular e recalcular
              </button>
            </footer>
          </section>
        </div>
      ) : null}
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
function FinancialMemory({
  breakdown,
  calculationNote,
}: {
  breakdown: NonNullable<NfeDetailResponse["financialBreakdown"]>;
  calculationNote: string | null;
}) {
  const costLines: CalculationLine[] = [
    {
      label: "Custo dos produtos",
      value: breakdown.costs.productCost,
      operation: "base",
      detail: "Custo cadastrado × quantidade dos itens",
    },
    ...breakdown.costs.additions.map((entry) => ({
      label: entry.label,
      value: entry.value,
      operation: "add" as const,
      detail: componentDetail(entry.rate, null, null, entry.items),
    })),
    ...breakdown.costs.credits.map((entry) => ({
      label: entry.label,
      value: entry.value,
      operation: "subtract" as const,
      detail: creditDetail(entry.rate, entry.items),
    })),
    ...adjustmentLine(
      breakdown.costs.adjustment,
      "Ajuste do cálculo persistido",
    ),
  ];
  const taxLines: CalculationLine[] = [
    ...breakdown.taxes.items.map((entry) => ({
      label: entry.label,
      value: entry.value,
      operation: "add" as const,
      detail: componentDetail(
        entry.rate,
        entry.baseValue,
        entry.cst,
        entry.items,
      ),
    })),
    ...adjustmentLine(
      breakdown.taxes.adjustment,
      "Ajuste conforme regime tributário",
    ),
  ];
  const feeLines: CalculationLine[] = [
    ...breakdown.fees.items.map((entry) => ({
      label: entry.label,
      value: entry.value,
      operation: "add" as const,
      detail: componentDetail(entry.rate, null, null, entry.items),
    })),
    ...adjustmentLine(
      breakdown.fees.adjustment,
      "Ajuste do cálculo persistido",
    ),
  ];

  return (
    <section className={`${styles.panel} ${styles.financialMemory}`}>
      <header>
        <div>
          <span>MEMÓRIA DE CÁLCULO</span>
          <h2>Como o resultado desta NF-e foi formado</h2>
        </div>
        <b>VALORES PERSISTIDOS</b>
      </header>
      <div className={styles.memoryIntro}>
        <Calculator size={17} />
        <p>
          Cada parcela abaixo vem do processamento fiscal da nota. Créditos são
          deduções; custos, impostos e taxas reduzem o resultado.
        </p>
      </div>
      <div className={styles.calculationGrid}>
        <CalculationCard
          icon={<Boxes size={16} />}
          title="Custos líquidos"
          subtitle="Produto, adicionais e créditos"
          lines={costLines}
          total={breakdown.costs.total}
        />
        <CalculationCard
          icon={<ReceiptText size={16} />}
          title="Impostos"
          subtitle="Tributos considerados no cálculo"
          lines={taxLines}
          total={breakdown.taxes.total}
        />
        <CalculationCard
          icon={<Tags size={16} />}
          title="Taxas"
          subtitle="Comissões e taxas operacionais"
          lines={feeLines}
          total={breakdown.fees.total}
        />
      </div>
      <div className={styles.profitMemory}>
        <div className={styles.profitHeading}>
          <span>
            <CircleDollarSign size={17} />
          </span>
          <div>
            <small>RESULTADO FINAL</small>
            <h3>Composição do lucro</h3>
          </div>
        </div>
        <div className={styles.profitEquation}>
          <EquationTerm
            label="Venda líquida"
            value={breakdown.profit.revenue}
            operation="base"
          />
          {breakdown.profit.deductions.map((entry) => (
            <EquationTerm
              key={entry.label}
              label={entry.label}
              value={entry.value}
              operation="subtract"
            />
          ))}
          <EquationTerm
            label="Lucro da NF-e"
            value={breakdown.profit.total}
            operation="total"
          />
        </div>
      </div>
      {calculationNote ? (
        <div className={styles.note}>
          <Info size={14} />
          <span>
            <b>Observação do cálculo</b>
            {calculationNote}
          </span>
        </div>
      ) : null}
    </section>
  );
}

type CalculationLine = {
  label: string;
  value: string;
  operation: "base" | "add" | "subtract";
  detail?: string | null;
};

function CalculationCard({
  icon,
  title,
  subtitle,
  lines,
  total,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  lines: CalculationLine[];
  total: string;
}) {
  return (
    <article className={styles.calculationCard}>
      <header>
        <span>{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className={styles.calculationLines}>
        {lines.length > 0 ? (
          lines.map((line, index) => (
            <div
              key={`${line.label}-${index}`}
              className={styles.calculationLine}
            >
              <span className={styles.operation} aria-hidden="true">
                {line.operation === "add"
                  ? "+"
                  : line.operation === "subtract"
                    ? "−"
                    : ""}
              </span>
              <div>
                <strong>{line.label}</strong>
                {line.detail ? <small>{line.detail}</small> : null}
              </div>
              <b>{money(line.value)}</b>
            </div>
          ))
        ) : (
          <p className={styles.noComponents}>Nenhuma parcela aplicada.</p>
        )}
      </div>
      <footer>
        <span>= Total</span>
        <strong>{money(total)}</strong>
      </footer>
    </article>
  );
}

function EquationTerm({
  label,
  value,
  operation,
}: {
  label: string;
  value: string;
  operation: "base" | "subtract" | "total";
}) {
  return (
    <div className={operation === "total" ? styles.equationTotal : ""}>
      <span>
        {operation === "subtract" ? "−" : operation === "total" ? "=" : ""}
      </span>
      <small>{label}</small>
      <strong>{money(value)}</strong>
    </div>
  );
}

function adjustmentLine(value: string, label: string): CalculationLine[] {
  const amount = Number(value);
  if (Math.abs(amount) < 0.01) return [];
  return [
    {
      label,
      value: String(Math.abs(amount)),
      operation: amount < 0 ? "subtract" : "add",
      detail: "Conciliação com o total gravado no processamento",
    },
  ];
}

function componentDetail(
  rate: string | null,
  baseValue: string | null,
  cst: string | null,
  items: number,
): string | null {
  const parts: string[] = [];
  if (rate && Number(rate) !== 0) parts.push(`${number(rate)}%`);
  if (baseValue && Number(baseValue) !== 0)
    parts.push(`base ${money(baseValue)}`);
  if (cst) parts.push(`CST ${cst}`);
  if (items > 0) parts.push(`${items} ${items === 1 ? "item" : "itens"}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
function creditDetail(rate: string | null, items: number): string | null {
  const parts: string[] = [];
  if (rate && Number(rate) !== 0)
    parts.push(`${number(rate)}% sobre o custo dos produtos`);
  if (items > 0) parts.push(`${items} ${items === 1 ? "item" : "itens"}`);
  return parts.length > 0 ? parts.join(" · ") : null;
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
function safeReturnTarget(value: string | null): string | null {
  if (!value || !value.startsWith("/app/") || value.startsWith("//"))
    return null;
  if (value.includes("\\") || /[\r\n]/.test(value)) return null;
  return value;
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
async function responseMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return body?.message ?? "Não foi possível concluir a operação.";
}
