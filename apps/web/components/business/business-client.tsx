"use client";

import type { BusinessOverviewResponse, SessionResponse } from "@integrador/contracts";
import {
  Activity, Banknote, Bell, Boxes, Building2, Check, ChevronDown, CircleDollarSign,
  ExternalLink, FileText, Gauge, Goal, HelpCircle, Landmark, LoaderCircle, LogOut,
  Menu, PackageCheck, Pencil, Percent, Plus, Receipt, RefreshCw, Settings,
  ShieldCheck, ShoppingBag, Store, Truck, UserRoundCheck, Users, WalletCards, Workflow, X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/api";
import shell from "../nfe/nfe.module.css";
import styles from "./business.module.css";

type Mode = "documents" | "commercial" | "fiscal";
type FixedCost = BusinessOverviewResponse["fiscal"]["fixedCosts"][number];
interface CostDraft { id: number | null; name: string; description: string; value: string; application: "Item" | "Nota"; valueType: "F" | "P"; categoryId: string; channelIds: number[] }
const blankCost: CostDraft = { id: null, name: "", description: "", value: "", application: "Nota", valueType: "F", categoryId: "", channelIds: [] };

const titles = {
  documents: { eyebrow: "COBRANÇA · LOGÍSTICA", title: "Boletos e rastreamento", text: "Cobranças vinculadas às notas e objetos enviados aos clientes." },
  commercial: { eyebrow: "CADASTROS · BLING", title: "Estrutura comercial", text: "Vendedores, canais de venda e formas de pagamento sincronizados." },
  fiscal: { eyebrow: "REGRAS · RENTABILIDADE", title: "Custos e tributação", text: "Despesas aplicadas aos cálculos e referências fiscais do integrador." },
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

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sessionResponse, overviewResponse] = await Promise.all([
        fetch(`${API_URL}/v1/auth/session`, { credentials: "include" }),
        fetch(`${API_URL}/v1/business/overview`, { credentials: "include" }),
      ]);
      if (sessionResponse.status === 401 || overviewResponse.status === 401) { router.replace("/login"); return; }
      if (!sessionResponse.ok || !overviewResponse.ok) throw new Error("api");
      setSession((await sessionResponse.json()) as SessionResponse);
      setData((await overviewResponse.json()) as BusinessOverviewResponse);
    } catch { setError("Não foi possível carregar os dados desta empresa."); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  function editCost(cost: FixedCost) { setCostDraft({ id: cost.id, name: cost.name, description: cost.description ?? "", value: cost.value, application: cost.application, valueType: cost.valueType, categoryId: cost.categoryId?.toString() ?? "", channelIds: cost.channelIds }); }
  async function saveCost() {
    if (!costDraft) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/v1/business/fixed-costs${costDraft.id ? `/${costDraft.id}` : ""}`, {
        method: costDraft.id ? "PATCH" : "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: costDraft.name, description: costDraft.description || null, value: costDraft.value.replace(",", "."), application: costDraft.application, valueType: costDraft.valueType, categoryId: costDraft.categoryId ? Number(costDraft.categoryId) : null, channelIds: costDraft.channelIds }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setData((await response.json()) as BusinessOverviewResponse); setCostDraft(null); setSuccess("Custo salvo e associado aos canais selecionados.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o custo."); }
    finally { setSaving(false); }
  }
  async function logout() { await fetch(`${API_URL}/v1/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined); router.replace("/login"); }
  if (!session && loading) return <main className={shell.statePage}><LoaderCircle className={shell.spin} size={28} /><h1>Carregando dados operacionais</h1></main>;
  if (!session || !data) return <main className={shell.statePage}><Workflow size={28} /><h1>Área indisponível</h1><p>{error}</p><Link href="/app/dashboard">Voltar ao painel</Link></main>;
  const canEdit = session.role === "owner" || session.role === "admin";
  const copy = titles[mode];

  return <main className={shell.shell}>
    <aside className={`${shell.sidebar} ${menuOpen ? shell.sidebarOpen : ""}`}>
      <Link className={shell.brand} href="/"><span><Workflow size={18} /></span><div><strong>APBling</strong><small>BLING OPERATIONS</small></div></Link>
      <button className={shell.tenant} type="button" disabled><span><Building2 size={16} /></span><div><small>Organização</small><strong>{session.tenant.name}</strong></div><ChevronDown size={14} /></button>
      <nav className={shell.nav}><p>OPERAÇÃO</p><Link href="/app/dashboard"><Gauge size={17} /> Visão geral</Link><Link href="/app/nfe"><FileText size={17} /> Notas fiscais</Link><Link className={mode === "documents" ? shell.active : ""} href="/app/documents"><Truck size={17} /> Boletos e rastreio</Link><Link href="/app/products"><Boxes size={17} /> Produtos</Link><Link href="/app/people"><Users size={17} /> Pessoas</Link><p>COMERCIAL</p><Link className={mode === "commercial" ? shell.active : ""} href="/app/commercial"><Store size={17} /> Cadastros comerciais</Link><Link href="/app/goals"><Goal size={17} /> Metas</Link><p>FINANCEIRO</p><Link href="/app/finance"><CircleDollarSign size={17} /> Lucro e margem</Link><Link className={mode === "fiscal" ? shell.active : ""} href="/app/fiscal"><Percent size={17} /> Custos e tributação</Link><p>PLATAFORMA</p><Link href="/app/operations"><Activity size={17} /> Jobs e integrações</Link>{session.user.superAdmin ? <Link href="/app/organizations"><Building2 size={17} /> Empresas</Link> : null}{session.role === "owner" || session.role === "admin" ? <Link href="/app/users"><ShieldCheck size={17} /> Usuários e acesso</Link> : null}<Link href="/app/settings"><Settings size={17} /> Configurações</Link></nav>
      <div className={shell.sidebarFooter}><span><HelpCircle size={16} /> Central de ajuda</span><button type="button" onClick={() => void logout()}><LogOut size={16} /> Sair</button></div>
    </aside>
    <section className={shell.workspace}>
      <header className={shell.topbar}><button className={shell.mobileMenu} type="button" onClick={() => setMenuOpen((open) => !open)}><Menu size={20} /></button><div className={styles.topTitle}><Workflow size={16} /><span>Dados operacionais</span></div><span className={shell.dbBadge}><Check size={13} /> {session.tenant.name}</span><button className={shell.iconButton} type="button"><Bell size={17} /></button><div className={shell.avatar}>{initials(session.user.name)}</div></header>
      <div className={shell.content}><section className={shell.titleRow}><div><span className={shell.eyebrow}>{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.text}</p></div><div className={styles.titleActions}>{mode === "fiscal" && canEdit ? <button type="button" onClick={() => setCostDraft(blankCost)}><Plus size={14} /> Novo custo</button> : null}<button type="button" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? shell.spin : ""} size={14} /> Atualizar</button></div></section>{error ? <div className={styles.feedbackError}>{error}</div> : null}{success ? <div className={styles.feedbackSuccess}><Check size={14} />{success}</div> : null}{mode === "documents" ? <Documents data={data} /> : mode === "commercial" ? <Commercial data={data} /> : <Fiscal data={data} canEdit={canEdit} onEdit={editCost} />}</div>
    </section>
    {costDraft ? <CostModal draft={costDraft} data={data} saving={saving} onChange={setCostDraft} onClose={() => setCostDraft(null)} onSave={saveCost} /> : null}
  </main>;
}

function Documents({ data }: { data: BusinessOverviewResponse }) {
  const open = data.documents.boletos.filter((item) => item.status === 1).length;
  return <><section className={styles.metrics}><Metric icon={<Banknote />} label="Boletos encontrados" value={data.documents.boletos.length} /><Metric icon={<WalletCards />} label="Em aberto" value={open} /><Metric icon={<Truck />} label="Objetos rastreados" value={data.documents.tracking.length} /></section><div className={styles.split}><Panel title="Boletos vinculados" eyebrow="COBRANÇA" count={data.documents.boletos.length}><div className={styles.list}>{data.documents.boletos.map((item) => { const url = safeHttpUrl(item.link); return <article key={item.id}><span className={styles.listIcon}><Banknote size={16} /></span><div><strong>{money(item.value)} · {item.customer}</strong><small>{item.invoiceNumber ? `NF-e ${item.invoiceNumber}` : "Sem NF-e localizada"} · vence {dateLabel(item.dueDate)}</small></div><Status text={boletoStatus(item.status)} />{url ? <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /></a> : null}</article>; })}<Empty show={!data.documents.boletos.length} text="Nenhum boleto localizado." /></div></Panel><Panel title="Rastreamentos" eyebrow="LOGÍSTICA" count={data.documents.tracking.length}><div className={styles.list}>{data.documents.tracking.map((item) => <article key={item.invoiceId}><span className={styles.listIcon}><PackageCheck size={16} /></span><div><Link href={`/app/nfe/${item.invoiceId}`}>NF-e {item.invoiceNumber} · {item.customer}</Link><small>{item.primaryCode}{item.secondaryCode ? ` · ${item.secondaryCode}` : ""} · emitida {dateLabel(item.issuedAt)}</small></div><Status text={item.status} />{item.primaryCode ? <a href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(item.primaryCode)}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /></a> : null}</article>)}<Empty show={!data.documents.tracking.length} text="Nenhum código de rastreamento localizado." /></div></Panel></div></>;
}

function Commercial({ data }: { data: BusinessOverviewResponse }) { return <><section className={styles.metrics}><Metric icon={<UserRoundCheck />} label="Vendedores" value={data.commercial.vendors.length} /><Metric icon={<Store />} label="Canais de venda" value={data.commercial.channels.length} /><Metric icon={<Landmark />} label="Formas de pagamento" value={data.commercial.paymentMethods.length} /></section><div className={styles.commercialGrid}><Panel title="Vendedores" eyebrow="EQUIPE" count={data.commercial.vendors.length}><SimpleTable headers={["Nome", "Setor", "ID Bling"]} rows={data.commercial.vendors.map((item) => [item.name, item.sector ?? "Sem setor", item.blingId ?? "—"])} /></Panel><Panel title="Canais de venda" eyebrow="ORIGEM" count={data.commercial.channels.length}><SimpleTable headers={["Descrição", "Tipo", "Loja"]} rows={data.commercial.channels.map((item) => [item.description, item.type ?? "Não informado", item.storeId ?? "—"])} /></Panel><Panel title="Formas de pagamento" eyebrow="RECEBIMENTO" count={data.commercial.paymentMethods.length}><SimpleTable headers={["Descrição", "Tipo", "ID Bling"]} rows={data.commercial.paymentMethods.map((item) => [item.description, item.type ?? "Não informado", item.blingId ?? "—"])} /></Panel><Panel title="Grupos de produtos" eyebrow="CATÁLOGO" count={data.commercial.productGroups.length}><SimpleTable headers={["Grupo", "ID Bling"]} rows={data.commercial.productGroups.map((item) => [item.name, item.blingId ?? "—"])} /></Panel><Panel title="Naturezas de operação" eyebrow="FISCAL COMERCIAL" count={data.commercial.operationNatures.length}><SimpleTable headers={["Descrição", "ID Bling"]} rows={data.commercial.operationNatures.map((item) => [item.description, item.blingId ?? "—"])} /></Panel></div></>;
}

function Fiscal({ data, canEdit, onEdit }: { data: BusinessOverviewResponse; canEdit: boolean; onEdit: (cost: FixedCost) => void }) { return <><section className={styles.metrics}><Metric icon={<Receipt />} label="Custos configurados" value={data.fiscal.fixedCosts.length} /><Metric icon={<Percent />} label="Regras tributárias" value={data.fiscal.taxRules.length} /><Metric icon={<ShoppingBag />} label="UFs com DIFAL" value={data.fiscal.difal.length} /></section><Panel title="Custos fixos e variáveis" eyebrow="COMPOSIÇÃO DO CÁLCULO" count={data.fiscal.fixedCosts.length}><div className={styles.costGrid}>{data.fiscal.fixedCosts.map((cost) => <article className={styles.costCard} key={cost.id}><header><span>{cost.valueType === "P" ? <Percent size={16} /> : <CircleDollarSign size={16} />}</span>{canEdit ? <button type="button" onClick={() => onEdit(cost)}><Pencil size={13} /> Editar</button> : null}</header><small>{cost.category ?? "SEM CATEGORIA"}</small><h3>{cost.name}</h3><p>{cost.description ?? "Sem descrição adicional."}</p><footer><strong>{cost.valueType === "P" ? `${cost.value}%` : money(cost.value)}</strong><span>Por {cost.application.toLowerCase()} · {cost.channelIds.length ? `${cost.channelIds.length} canais` : "todos os canais"}</span></footer></article>)}</div></Panel><div className={styles.split}><Panel title="Regras tributárias" eyebrow="ALÍQUOTA DE SIMULAÇÃO" count={data.fiscal.taxRules.length}><SimpleTable headers={["Regra", "Alíquota"]} rows={data.fiscal.taxRules.map((item) => [item.name, `${item.simulationRate}%`])} /></Panel><Panel title="Tabela DIFAL" eyebrow="ALÍQUOTA INTERNA POR UF" count={data.fiscal.difal.length}><div className={styles.ufGrid}>{data.fiscal.difal.map((item) => <div key={item.id}><b>{item.state}</b><span>{item.internalRate}%</span></div>)}</div></Panel></div><div className={styles.referenceNote}><ShieldCheck size={16} /><div><strong>Referências fiscais globais em modo leitura</strong><p>As tabelas de tributação e DIFAL do legado não possuem `unit_id`. A edição global fica bloqueada até a evolução compatível do schema; custos da empresa podem ser editados normalmente.</p></div></div></>;
}

function Panel({ title, eyebrow, count, children }: { title: string; eyebrow: string; count: number; children: ReactNode }) { return <section className={styles.panel}><header><div><span>{eyebrow}</span><h2>{title}</h2></div><b>{count} REGISTROS</b></header>{children}</section>; }
function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <article><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>; }
function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) { return <div className={styles.tableWrap}><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>{!rows.length ? <Empty show text="Nenhum registro localizado." /> : null}</div>; }
function Status({ text }: { text: string }) { const tone = /pago|enviad|sucesso/i.test(text) ? styles.statusGreen : /cancel|erro|falha/i.test(text) ? styles.statusRed : styles.statusAmber; return <span className={`${styles.status} ${tone}`}><i />{text}</span>; }
function Empty({ show, text }: { show: boolean; text: string }) { return show ? <div className={styles.empty}>{text}</div> : null; }

function CostModal({ draft, data, saving, onChange, onClose, onSave }: { draft: CostDraft; data: BusinessOverviewResponse; saving: boolean; onChange: (value: CostDraft) => void; onClose: () => void; onSave: () => Promise<void> }) { return <div className={styles.modalBackdrop} onMouseDown={onClose}><section className={styles.modal} onMouseDown={(event) => event.stopPropagation()}><header><div><span>CUSTO DA EMPRESA</span><h2>{draft.id ? "Editar custo" : "Novo custo"}</h2></div><button type="button" onClick={onClose}><X size={17} /></button></header><div className={styles.formGrid}><label><span>Nome</span><input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></label><label><span>Categoria</span><select value={draft.categoryId} onChange={(event) => onChange({ ...draft, categoryId: event.target.value })}><option value="">Sem categoria</option>{data.fiscal.fixedCostTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label><label className={styles.full}><span>Descrição</span><input value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} /></label><label><span>Valor</span><input inputMode="decimal" value={draft.value} onChange={(event) => onChange({ ...draft, value: event.target.value })} placeholder="0.00" /></label><label><span>Tipo do valor</span><select value={draft.valueType} onChange={(event) => onChange({ ...draft, valueType: event.target.value as "F" | "P" })}><option value="F">Valor fixo</option><option value="P">Porcentagem</option></select></label><label className={styles.full}><span>Aplicar por</span><select value={draft.application} onChange={(event) => onChange({ ...draft, application: event.target.value as "Item" | "Nota" })}><option value="Item">Item da NF-e</option><option value="Nota">Nota fiscal</option></select></label><fieldset className={styles.full}><legend>Canais de venda <small>(nenhum = todos)</small></legend><div>{data.commercial.channels.map((channel) => <label key={channel.id}><input type="checkbox" checked={draft.channelIds.includes(channel.id)} onChange={(event) => onChange({ ...draft, channelIds: event.target.checked ? [...draft.channelIds, channel.id] : draft.channelIds.filter((id) => id !== channel.id) })} />{channel.description}</label>)}</div></fieldset></div><footer><button type="button" onClick={onClose}>Cancelar</button><button type="button" onClick={() => void onSave()} disabled={saving || draft.name.length < 2 || !draft.value}>{saving ? <LoaderCircle className={shell.spin} size={14} /> : <Check size={14} />} Salvar custo</button></footer></section></div>; }

function money(value: string): string { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value)); }
function dateLabel(value: string | null): string { if (!value) return "não informado"; const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; }
function boletoStatus(value: number | null): string { return value === 1 ? "Em aberto" : value === 2 ? "Pago" : value === 3 ? "Cancelado" : "Não informado"; }
function safeHttpUrl(value: string | null): string | null { if (!value) return null; try { const parsed = new URL(value); return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null; } catch { return null; } }
function initials(name: string): string { return name.split(" ").slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase(); }
async function responseMessage(response: Response): Promise<string> { const body = (await response.json().catch(() => null)) as { message?: string } | null; return body?.message ?? "Não foi possível concluir a operação."; }
