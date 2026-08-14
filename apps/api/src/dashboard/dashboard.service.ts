import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  dashboardExecutiveSchema,
  dashboardInvoiceReportSchema,
  dashboardSummarySchema,
  type DashboardExecutive,
  type DashboardExecutiveQuery,
  type DashboardInvoiceReport,
  type DashboardInvoiceReportQuery,
  type DashboardSummary,
} from "@integrador/contracts";
import { Prisma, type DatabaseClient } from "@integrador/db";
import {
  aggregateDashboard,
  dashboardMonthKeys,
  type DashboardInvoiceRow,
} from "@integrador/domain";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";

interface LegacyInvoiceRow {
  number: string;
  issuedAt: Date;
  customerName: string;
  channel: string;
  grossRevenue: string;
  netRevenue: string;
  cost: string;
  tax: string;
  profit: string;
  status: string;
  hasBoleto: boolean;
  hasTracking: boolean;
}

interface AnalyticsGroupRow {
  label: string;
  revenue: string;
  profit: string;
  invoices: bigint;
}
interface CustomerAnalyticsRow extends AnalyticsGroupRow {
  averageTicket: string;
  averageProfit: string;
}
interface DailyRevenueRow {
  date: string;
  revenue: string;
  invoices: bigint;
}
interface DailyRevenueMedianRow {
  median: string;
}
interface ProductAnalyticsRow {
  name: string;
  quantity: string;
  revenue: string;
  profit: string;
}
interface CalculationRow {
  calculation: string | null;
  total: bigint;
}
interface DocumentAnalyticsRow {
  boletos: bigint;
  tracking: bigint;
  pendingSurvey: bigint;
}
interface ExecutiveMetricRow {
  revenue: string;
  netRevenue: string;
  cost: string;
  tax: string;
  profit: string;
  margin: string;
  invoices: bigint;
}
interface ExecutiveGroupRow {
  label: string;
  revenue: string;
  profit: string;
  cost: string;
  invoices: bigint;
  averageTicket: string;
}
interface ExecutivePeriodRow {
  key: string;
  label: string;
  revenue: string;
  cost: string;
  profit: string;
  invoices: bigint;
}
interface ExecutiveDailyRow {
  date: string;
  revenue: string;
  average: string;
  cumulativeRevenue: string;
  profit: string;
  cumulativeProfit: string;
}
interface ExecutiveCustomerRow {
  name: string;
  revenue: string;
  profit: string;
  invoices: bigint;
}
interface ExecutiveProductRow {
  code: string;
  name: string;
  origin: string;
  month: string;
  quantity: string;
  revenue: string;
  netRevenue: string;
  tax: string;
  cost: string;
  profit: string;
  margin: string;
  invoices: bigint;
}
interface ExecutiveGoalRow {
  competence: string | null;
  date: string;
  cumulativeProfit: string;
  goalCost: string;
  balance: string;
  reached: string;
}
interface ExecutiveStateRow {
  state: string;
  revenue: string;
  invoices: bigint;
}
interface LabelRow {
  label: string;
}
interface ExecutiveInvoiceRow {
  id: number;
  number: string;
  customer: string;
  issuedAt: string | null;
  origin: string;
  state: string | null;
  revenue: string;
  netRevenue: string;
  cost: string;
  tax: string;
  profit: string;
  margin: string;
  quantity: string;
  cmv: string;
  manufacturingRevenue: string;
  manufacturingCost: string;
  manufacturingProfit: string;
  manufacturingMargin: string;
}
interface CountOnlyRow {
  total: bigint;
}
interface ItemAnalysisRow {
  scope: "cmv" | "manufacturing";
  dimension: "total" | "period" | "origin" | "group" | "product";
  key: string | null;
  label: string | null;
  code: string | null;
  group: string | null;
  quantity: string;
  revenue: string;
  cmv: string;
  cost: string;
  credits: string;
  profit: string;
  margin: string;
  invoices: bigint;
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async executive(
    principal: AuthPrincipal,
    input: DashboardExecutiveQuery,
  ): Promise<DashboardExecutive> {
    const now = new Date();
    const from = input.from ?? "2000-01-01";
    const to = input.to ?? now.toISOString().slice(0, 10);
    if (from > to) throw new BadRequestException("Período inválido");
    const unitId = principal.activeTenantId;
    const filter = executiveFilter(unitId, from, to, input);
    const [
      metricRows,
      origins,
      periods,
      daily,
      customers,
      products,
      goalRows,
      states,
      originOptions,
      productOptions,
      productCodeOptions,
      productGroupOptions,
      monthOptions,
      goalCompetenceOptions,
      itemAnalysis,
    ] = await Promise.all([
      this.database.$queryRaw<ExecutiveMetricRow[]>(Prisma.sql`
        SELECT ROUND(COALESCE(SUM(n.valor),0),2)::text revenue,
          ROUND(COALESCE(SUM(n.venda_liquido),0),2)::text AS "netRevenue",
          ROUND(COALESCE(SUM(n.custo_liquido),0),2)::text cost,
          ROUND(COALESCE(SUM(n.impostos),0),2)::text tax,
          ROUND(COALESCE(SUM(n.lucro),0),2)::text profit,
          ROUND(CASE WHEN COALESCE(SUM(n.valor),0)=0 THEN 0 ELSE SUM(n.lucro)/SUM(n.valor)*100 END,2)::text margin,
          COUNT(*)::bigint invoices
        FROM nfe n LEFT JOIN canal_venda cv ON cv.loja_id=n.loja_id AND cv.unit_id=n.unit_id
        WHERE ${filter}
      `),
      this.database.$queryRaw<ExecutiveGroupRow[]>(Prisma.sql`
        SELECT COALESCE(NULLIF(BTRIM(cv.descricao),''),'Origem indefinida') label,
          ROUND(COALESCE(SUM(n.valor),0),2)::text revenue,
          ROUND(COALESCE(SUM(n.lucro),0),2)::text profit,
          ROUND(COALESCE(SUM(n.custo_liquido),0),2)::text cost,
          COUNT(*)::bigint invoices, ROUND(COALESCE(AVG(n.valor),0),2)::text AS "averageTicket",
          ROUND(COALESCE(AVG(n.lucro),0),2)::text AS "averageProfit"
        FROM nfe n LEFT JOIN canal_venda cv ON cv.loja_id=n.loja_id AND cv.unit_id=n.unit_id
        WHERE ${filter} GROUP BY 1 ORDER BY SUM(n.valor) DESC
      `),
      this.database.$queryRaw<ExecutivePeriodRow[]>(Prisma.sql`
        SELECT TO_CHAR(n.data_emissao,'YYYY-MM') key, TO_CHAR(n.data_emissao,'MM/YYYY') label,
          ROUND(SUM(n.valor),2)::text revenue, ROUND(SUM(n.custo_liquido),2)::text cost,
          ROUND(SUM(n.lucro),2)::text profit, COUNT(*)::bigint invoices
        FROM nfe n LEFT JOIN canal_venda cv ON cv.loja_id=n.loja_id AND cv.unit_id=n.unit_id
        WHERE ${filter} GROUP BY 1,2 ORDER BY 1
      `),
      this.database.$queryRaw<ExecutiveDailyRow[]>(Prisma.sql`
        WITH days AS (
          SELECT n.data_emissao::date AS issued_day, SUM(n.valor)::numeric revenue, SUM(n.lucro)::numeric profit
          FROM nfe n LEFT JOIN canal_venda cv ON cv.loja_id=n.loja_id AND cv.unit_id=n.unit_id
          WHERE ${filter} GROUP BY 1
        ) SELECT issued_day::text date, ROUND(revenue,2)::text revenue,
          ROUND(AVG(revenue) OVER (),2)::text average,
          ROUND(SUM(revenue) OVER (ORDER BY issued_day),2)::text AS "cumulativeRevenue",
          ROUND(profit,2)::text profit,
          ROUND(SUM(profit) OVER (ORDER BY issued_day),2)::text AS "cumulativeProfit"
        FROM days ORDER BY issued_day
      `),
      this.database.$queryRaw<ExecutiveCustomerRow[]>(Prisma.sql`
        SELECT COALESCE(NULLIF(BTRIM(p.nome),''),'Cliente não identificado') name,
          ROUND(SUM(n.valor),2)::text revenue, ROUND(SUM(n.lucro),2)::text profit, COUNT(*)::bigint invoices
        FROM nfe n LEFT JOIN canal_venda cv ON cv.loja_id=n.loja_id AND cv.unit_id=n.unit_id
        LEFT JOIN pessoa p ON p.id_bling=n.contato_id_bling AND p.unit_id=n.unit_id
        WHERE ${filter} GROUP BY 1 ORDER BY SUM(n.valor) DESC LIMIT 20
      `),
      this.database.$queryRaw<ExecutiveProductRow[]>(Prisma.sql`
        SELECT COALESCE(NULLIF(BTRIM(pr.codigo),''),ni.id_produto,'—') code,
          COALESCE(NULLIF(BTRIM(pr.nome),''),NULLIF(BTRIM(ni.descricao),''),'Produto não identificado') name,
          COALESCE(NULLIF(BTRIM(cv.descricao),''),'Origem indefinida') origin,
          TO_CHAR(n.data_emissao,'MM/YYYY') AS "month",
          COALESCE(SUM(ni.qnt),0)::text quantity,
          ROUND(COALESCE(SUM(ni.venda_bruto_total),0),2)::text revenue,
          ROUND(COALESCE(SUM(ni.venda_liquido_total),0),2)::text AS "netRevenue",
          ROUND(COALESCE(SUM(ni.imposto_total),0),2)::text tax,
          ROUND(COALESCE(SUM(ni.custo_liquido_total),0),2)::text cost,
          ROUND(COALESCE(SUM(ni.valor_lucro_total),0),2)::text profit,
          ROUND(CASE WHEN COALESCE(SUM(ni.venda_bruto_total),0)=0 THEN 0 ELSE SUM(ni.valor_lucro_total)/SUM(ni.venda_bruto_total)*100 END,2)::text margin,
          COUNT(DISTINCT n.id)::bigint invoices
        FROM nfe_item ni JOIN nfe n ON n.id=ni.nfe_id AND n.unit_id=ni.unit_id
        LEFT JOIN produtos pr ON pr.id=ni.produtos_id AND pr.unit_id=ni.unit_id
        LEFT JOIN grupo_produto pg ON pg.id=pr.group_id AND pg.unit_id=pr.unit_id
        LEFT JOIN canal_venda cv ON cv.loja_id=n.loja_id AND cv.unit_id=n.unit_id
        WHERE ${filter} ${dashboardItemFilter(input)}
        GROUP BY 1,2,3,4 ORDER BY SUM(ni.valor_lucro_total) DESC LIMIT 500
      `),
      this.database.$queryRaw<ExecutiveGoalRow[]>(
        goalQuery(unitId, input.goalCompetence),
      ),
      this.database.$queryRaw<ExecutiveStateRow[]>(Prisma.sql`
        SELECT UPPER(COALESCE(a.uf,'NI')) state, ROUND(SUM(n.valor),2)::text revenue, COUNT(*)::bigint invoices
        FROM nfe n LEFT JOIN canal_venda cv ON cv.loja_id=n.loja_id AND cv.unit_id=n.unit_id
        LEFT JOIN LATERAL (SELECT pe.uf FROM pessoa_endereco pe JOIN pessoa p ON p.id=pe.pessoa_id
          WHERE p.id_bling=n.contato_id_bling AND pe.unit_id=n.unit_id ORDER BY pe.primary DESC, pe.id LIMIT 1) a ON TRUE
        WHERE ${filter} GROUP BY 1 ORDER BY SUM(n.valor) DESC
      `),
      this.database.$queryRaw<LabelRow[]>(Prisma.sql`
        SELECT DISTINCT COALESCE(NULLIF(BTRIM(cv.descricao),''),'Origem indefinida') label
        FROM nfe n LEFT JOIN canal_venda cv ON cv.loja_id=n.loja_id AND cv.unit_id=n.unit_id
        WHERE n.unit_id=${unitId} ORDER BY 1
      `),
      this.database.$queryRaw<LabelRow[]>(Prisma.sql`
        SELECT DISTINCT COALESCE(NULLIF(BTRIM(p.nome),''),NULLIF(BTRIM(ni.descricao),'')) label
        FROM nfe_item ni LEFT JOIN produtos p ON p.id=ni.produtos_id AND p.unit_id=ni.unit_id
        WHERE ni.unit_id=${unitId} AND COALESCE(NULLIF(BTRIM(p.nome),''),NULLIF(BTRIM(ni.descricao),'')) IS NOT NULL
        ORDER BY 1 LIMIT 300
      `),
      this.database.$queryRaw<LabelRow[]>(Prisma.sql`
        SELECT DISTINCT COALESCE(NULLIF(BTRIM(p.codigo),''),NULLIF(BTRIM(ni.id_produto),'')) label
        FROM nfe_item ni LEFT JOIN produtos p ON p.id=ni.produtos_id AND p.unit_id=ni.unit_id
        WHERE ni.unit_id=${unitId} AND COALESCE(NULLIF(BTRIM(p.codigo),''),NULLIF(BTRIM(ni.id_produto),'')) IS NOT NULL
        ORDER BY 1 LIMIT 500
      `),
      this.database.$queryRaw<LabelRow[]>(Prisma.sql`
        SELECT DISTINCT COALESCE(NULLIF(BTRIM(g.nome),''),'Sem grupo') label
        FROM nfe_item ni
        JOIN nfe n ON n.id=ni.nfe_id AND n.unit_id=ni.unit_id
        LEFT JOIN produtos p ON p.id=ni.produtos_id AND p.unit_id=ni.unit_id
        LEFT JOIN grupo_produto g ON g.id=p.group_id AND g.unit_id=p.unit_id
        WHERE ni.unit_id=${unitId} AND n.cancelled_at IS NULL AND n.situacao<>2
        ORDER BY 1 LIMIT 300
      `),
      this.database.$queryRaw<LabelRow[]>(Prisma.sql`
        SELECT DISTINCT TO_CHAR(data_emissao,'YYYY-MM') label FROM nfe
        WHERE unit_id=${unitId} AND cancelled_at IS NULL AND situacao<>2 AND data_emissao IS NOT NULL
        ORDER BY 1 DESC
      `),
      this.database.$queryRaw<LabelRow[]>(Prisma.sql`
        SELECT DISTINCT mes_ano label FROM meta WHERE unit_id=${unitId} ORDER BY mes_ano DESC
      `),
      this.database.$queryRaw<ItemAnalysisRow[]>(
        itemAnalysisQuery(filter, input),
      ),
    ]);
    const metrics = metricRows[0] ?? {
      revenue: "0.00",
      netRevenue: "0.00",
      cost: "0.00",
      tax: "0.00",
      profit: "0.00",
      margin: "0.00",
      invoices: 0n,
    };
    const normalizeGroup = (row: ExecutiveGroupRow) => ({
      ...row,
      invoices: Number(row.invoices),
    });
    const byScope = (scope: ItemAnalysisRow["scope"]) =>
      itemAnalysis.filter((row) => row.scope === scope);
    const cmvRows = byScope("cmv");
    const manufacturingRows = byScope("manufacturing");
    const cmvTotal = cmvRows.find((row) => row.dimension === "total");
    const manufacturingTotal = manufacturingRows.find(
      (row) => row.dimension === "total",
    );
    return dashboardExecutiveSchema.parse({
      filters: {
        from,
        to,
        origins: originOptions.map((r) => r.label),
        products: productOptions.map((r) => r.label),
        productCodes: productCodeOptions.map((r) => r.label),
        productGroups: productGroupOptions.map((r) => r.label),
        months: monthOptions.map((r) => r.label),
        goalCompetences: goalCompetenceOptions.map((r) => r.label),
        company: principal.tenantName,
      },
      metrics: { ...metrics, invoices: Number(metrics.invoices) },
      origins: origins.map(normalizeGroup),
      companies: [
        {
          label: principal.tenantName,
          revenue: metrics.revenue,
          profit: metrics.profit,
          cost: metrics.cost,
          invoices: Number(metrics.invoices),
          averageTicket: Number(metrics.invoices)
            ? (Number(metrics.revenue) / Number(metrics.invoices)).toFixed(2)
            : "0.00",
          averageProfit: Number(metrics.invoices)
            ? (Number(metrics.profit) / Number(metrics.invoices)).toFixed(2)
            : "0.00",
        },
      ],
      periods: periods.map((row) => ({
        ...row,
        invoices: Number(row.invoices),
      })),
      daily,
      customers: customers.map((row) => ({
        ...row,
        invoices: Number(row.invoices),
      })),
      products: products.map((row) => ({
        ...row,
        invoices: Number(row.invoices),
      })),
      goal: {
        competence: goalRows[0]?.competence ?? null,
        cost: goalRows[0]?.goalCost ?? "0.00",
        points: goalRows.map((row) => ({
          date: row.date,
          cumulativeProfit: row.cumulativeProfit,
          goalCost: row.goalCost,
          balance: row.balance,
          reached: row.reached,
        })),
      },
      states: states.map((row) => ({ ...row, invoices: Number(row.invoices) })),
      cmv: {
        total: cmvTotal?.cmv ?? "0.00",
        quantity: cmvTotal?.quantity ?? "0",
        invoices: Number(cmvTotal?.invoices ?? 0n),
        periods: cmvRows
          .filter((row) => row.dimension === "period")
          .map((row) => ({
            key: row.key ?? "",
            label: row.label ?? "",
            cost: row.cmv,
            invoices: Number(row.invoices),
          })),
        origins: cmvRows
          .filter((row) => row.dimension === "origin")
          .map((row) => ({
            label: row.label ?? "Origem indefinida",
            cost: row.cmv,
            invoices: Number(row.invoices),
          })),
        products: cmvRows
          .filter((row) => row.dimension === "product")
          .map((row) => ({
            code: row.code ?? "—",
            name: row.label ?? "Produto não identificado",
            group: row.group ?? "Sem grupo",
            competence: row.key ?? "2000-01",
            revenue: row.revenue,
            totalCost: row.cost,
            cost: row.cmv,
            quantity: row.quantity,
            invoices: Number(row.invoices),
          })),
      },
      manufacturing: {
        metrics: {
          revenue: manufacturingTotal?.revenue ?? "0.00",
          cost: manufacturingTotal?.cmv ?? "0.00",
          profit: manufacturingTotal?.profit ?? "0.00",
          margin: manufacturingTotal?.margin ?? "0.00",
          quantity: manufacturingTotal?.quantity ?? "0",
          invoices: Number(manufacturingTotal?.invoices ?? 0n),
        },
        periods: manufacturingRows
          .filter((row) => row.dimension === "period")
          .map((row) => ({
            key: row.key ?? "",
            label: row.label ?? "",
            revenue: row.revenue,
            cost: row.cmv,
            profit: row.profit,
            invoices: Number(row.invoices),
          })),
        origins: manufacturingRows
          .filter((row) => row.dimension === "origin")
          .map((row) => ({
            label: row.label ?? "Origem indefinida",
            revenue: row.revenue,
            cost: row.cmv,
            profit: row.profit,
            invoices: Number(row.invoices),
          })),
        groups: manufacturingRows
          .filter((row) => row.dimension === "group")
          .map((row) => ({
            label: row.label ?? "Sem grupo",
            revenue: row.revenue,
            cost: row.cmv,
            profit: row.profit,
            invoices: Number(row.invoices),
          })),
        products: manufacturingRows
          .filter((row) => row.dimension === "product")
          .map((row) => ({
            code: row.code ?? "—",
            name: row.label ?? "Produto não identificado",
            group: row.group ?? "Sem grupo",
            competence: row.key ?? "2000-01",
            revenue: row.revenue,
            grossCost: row.cmv,
            cost: row.cost,
            credits: row.credits,
            profit: row.profit,
            margin: row.margin,
            quantity: row.quantity,
            invoices: Number(row.invoices),
          })),
      },
    });
  }

  async invoices(
    principal: AuthPrincipal,
    input: DashboardInvoiceReportQuery,
  ): Promise<DashboardInvoiceReport> {
    const now = new Date();
    const from = input.from ?? "2000-01-01";
    const to = input.to ?? now.toISOString().slice(0, 10);
    if (from > to) throw new BadRequestException("Período inválido");
    const unitId = principal.activeTenantId;
    const filter = executiveFilter(unitId, from, to, input);
    const details = reportDetailFilter(input);
    const itemAggregation = reportItemAggregation(input);
    const offset = (input.page - 1) * input.pageSize;
    const [items, counts] = await Promise.all([
      this.database.$queryRaw<ExecutiveInvoiceRow[]>(Prisma.sql`
        SELECT n.id, n.numero::text number,
          COALESCE(NULLIF(BTRIM(p.nome),''),'Cliente não identificado') customer,
          TO_CHAR(n.data_emissao,'YYYY-MM-DD') AS "issuedAt",
          COALESCE(NULLIF(BTRIM(cv.descricao),''),'Origem indefinida') origin,
          UPPER(NULLIF(BTRIM(a.uf),'')) state,
          ROUND(COALESCE(n.valor,0),2)::text revenue,
          ROUND(COALESCE(n.venda_liquido,0),2)::text AS "netRevenue",
          ROUND(COALESCE(n.custo_liquido,0),2)::text cost,
          ROUND(COALESCE(n.impostos,0),2)::text tax,
          ROUND(COALESCE(n.lucro,0),2)::text profit,
          ROUND(CASE WHEN COALESCE(n.valor,0)=0 THEN 0 ELSE n.lucro/n.valor*100 END,2)::text margin,
          ROUND(COALESCE(ia.quantity,0),6)::text quantity,
          ROUND(COALESCE(ia.cmv,0),2)::text cmv,
          ROUND(COALESCE(ia.revenue,0),2)::text AS "manufacturingRevenue",
          ROUND(COALESCE(ia.cost,0),2)::text AS "manufacturingCost",
          ROUND(COALESCE(ia.profit,0),2)::text AS "manufacturingProfit",
          ROUND(CASE WHEN COALESCE(ia.revenue,0)=0 THEN 0 ELSE ia.profit/ia.revenue*100 END,2)::text AS "manufacturingMargin"
        FROM nfe n
        LEFT JOIN canal_venda cv ON cv.loja_id=n.loja_id AND cv.unit_id=n.unit_id
        LEFT JOIN pessoa p ON p.id_bling=n.contato_id_bling AND p.unit_id=n.unit_id
        LEFT JOIN LATERAL (SELECT pe.uf FROM pessoa_endereco pe JOIN pessoa px ON px.id=pe.pessoa_id
          WHERE px.id_bling=n.contato_id_bling AND pe.unit_id=n.unit_id ORDER BY pe.primary DESC,pe.id LIMIT 1) a ON TRUE
        ${itemAggregation}
        WHERE ${filter} ${details}
        ORDER BY n.data_emissao DESC NULLS LAST,n.id DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `),
      this.database.$queryRaw<CountOnlyRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint total FROM nfe n
        LEFT JOIN canal_venda cv ON cv.loja_id=n.loja_id AND cv.unit_id=n.unit_id
        LEFT JOIN pessoa p ON p.id_bling=n.contato_id_bling AND p.unit_id=n.unit_id
        LEFT JOIN LATERAL (SELECT pe.uf FROM pessoa_endereco pe JOIN pessoa px ON px.id=pe.pessoa_id
          WHERE px.id_bling=n.contato_id_bling AND pe.unit_id=n.unit_id ORDER BY pe.primary DESC,pe.id LIMIT 1) a ON TRUE
        ${itemAggregation}
        WHERE ${filter} ${details}
      `),
    ]);
    const total = Number(counts[0]?.total ?? 0n);
    return dashboardInvoiceReportSchema.parse({
      items: items.map((item) => ({ ...item, company: principal.tenantName })),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        pages: Math.ceil(total / input.pageSize),
      },
    });
  }

  async summary(
    principal: AuthPrincipal,
    months = 6,
  ): Promise<DashboardSummary> {
    if (!Number.isInteger(months) || months < 1 || months > 24) {
      throw new BadRequestException("Período deve ter entre 1 e 24 meses");
    }
    if (principal.tenantDemo) {
      throw new BadRequestException(
        "A demonstração pública não utiliza autenticação nem esta API",
      );
    }
    const reference = new Date();
    const monthKeys = dashboardMonthKeys(reference, months);
    const firstMonth = monthKeys[0];
    if (!firstMonth) throw new BadRequestException("Período inválido");
    const from = new Date(`${firstMonth}-01T00:00:00.000Z`);
    const to = new Date(
      Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1),
    );

    const [rows, analytics] = await Promise.all([
      this.legacyRows(principal, from, to),
      this.analytics(principal, from, to),
    ]);
    const aggregate = aggregateDashboard(rows, monthKeys);

    return dashboardSummarySchema.parse({
      source: "product-postgresql",
      tenant: {
        id: principal.activeTenantId,
        name: principal.tenantName,
        demo: principal.tenantDemo,
      },
      period: { from: from.toISOString(), to: to.toISOString(), months },
      ...aggregate,
      analytics,
    });
  }

  private async analytics(principal: AuthPrincipal, from: Date, to: Date) {
    const unitId = principal.activeTenantId;
    if (!unitId) throw new BadRequestException("Tenant sem vínculo legado");
    const [
      calculationRows,
      channels,
      vendors,
      customers,
      dailyRevenue,
      dailyRevenueMedianRows,
      products,
      documentsRows,
    ] = await Promise.all([
      this.database.$queryRaw<CalculationRow[]>(Prisma.sql`
        SELECT calculation_status::text AS calculation, COUNT(*)::bigint AS total FROM nfe
        WHERE unit_id=${unitId} AND data_emissao >= ${from} AND data_emissao < ${to}
        GROUP BY calculation_status
      `),
      this.database.$queryRaw<AnalyticsGroupRow[]>(Prisma.sql`
        SELECT COALESCE(NULLIF(BTRIM(tipo_venda), ''), 'Não informado') AS label,
          ROUND(COALESCE(SUM(valor),0)::numeric,2)::text AS revenue, ROUND(COALESCE(SUM(lucro),0)::numeric,2)::text AS profit,
          COUNT(*)::bigint AS invoices FROM invoice_overview WHERE unit_id=${unitId} AND data_emissao >= ${from} AND data_emissao < ${to}
        GROUP BY tipo_venda ORDER BY SUM(valor) DESC NULLS LAST LIMIT 8
      `),
      this.database.$queryRaw<AnalyticsGroupRow[]>(Prisma.sql`
        SELECT COALESCE(NULLIF(BTRIM(v.nome), ''), 'Sem vendedor') AS label,
          ROUND(COALESCE(SUM(n.valor),0)::numeric,2)::text AS revenue, ROUND(COALESCE(SUM(n.lucro),0)::numeric,2)::text AS profit,
          COUNT(*)::bigint AS invoices FROM nfe n LEFT JOIN vendedores v ON v.id_bling=n.vendedor_id AND v.unit_id=n.unit_id
        WHERE n.unit_id=${unitId} AND n.data_emissao >= ${from} AND n.data_emissao < ${to}
        GROUP BY v.nome ORDER BY SUM(n.valor) DESC NULLS LAST LIMIT 8
      `),
      this.database.$queryRaw<CustomerAnalyticsRow[]>(Prisma.sql`
        SELECT COALESCE(NULLIF(BTRIM(nome), ''), 'Cliente não identificado') AS label,
          ROUND(COALESCE(SUM(valor),0)::numeric,2)::text AS revenue,
          ROUND(COALESCE(SUM(lucro),0)::numeric,2)::text AS profit,
          ROUND(COALESCE(AVG(valor),0)::numeric,2)::text AS "averageTicket",
          COUNT(*)::bigint AS invoices
        FROM invoice_overview
        WHERE unit_id=${unitId} AND data_emissao >= ${from} AND data_emissao < ${to}
        GROUP BY nome ORDER BY SUM(valor) DESC NULLS LAST LIMIT 8
      `),
      this.database.$queryRaw<DailyRevenueRow[]>(Prisma.sql`
        SELECT data_emissao::date::text AS date,
          ROUND(COALESCE(SUM(valor),0)::numeric,2)::text AS revenue,
          COUNT(*)::bigint AS invoices
        FROM invoice_overview
        WHERE unit_id=${unitId} AND data_emissao >= ${from} AND data_emissao < ${to}
        GROUP BY data_emissao::date ORDER BY data_emissao::date
      `),
      this.database.$queryRaw<DailyRevenueMedianRow[]>(Prisma.sql`
        WITH daily AS (
          SELECT SUM(valor)::numeric AS revenue
          FROM invoice_overview
          WHERE unit_id=${unitId} AND data_emissao >= ${from} AND data_emissao < ${to}
          GROUP BY data_emissao::date
        )
        SELECT ROUND(COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY revenue),0)::numeric,2)::text AS median
        FROM daily
      `),
      this.database.$queryRaw<ProductAnalyticsRow[]>(Prisma.sql`
        SELECT COALESCE(NULLIF(BTRIM(p.nome), ''), CONCAT('Produto ', COALESCE(ni.id_produto::text, 'não identificado'))) AS name,
          COALESCE(SUM(ni.qnt),0)::numeric::text AS quantity,
          ROUND(COALESCE(SUM(ni.venda_liquido_total),0)::numeric,2)::text AS revenue,
          ROUND(COALESCE(SUM(ni.valor_lucro_total),0)::numeric,2)::text AS profit
        FROM nfe_item ni JOIN nfe n ON n.id=ni.nfe_id AND n.unit_id=ni.unit_id
        LEFT JOIN produtos p ON p.id=ni.produtos_id AND p.unit_id=ni.unit_id
        WHERE ni.unit_id=${unitId} AND n.data_emissao >= ${from} AND n.data_emissao < ${to}
        GROUP BY p.nome, ni.id_produto ORDER BY SUM(ni.venda_liquido_total) DESC NULLS LAST LIMIT 8
      `),
      this.database.$queryRaw<DocumentAnalyticsRow[]>(Prisma.sql`
        SELECT
          (SELECT COUNT(*) FROM boleto b JOIN nfe n ON n.id_bling=b.nfe_id_bling AND n.unit_id=b.unit_id WHERE b.unit_id=${unitId} AND n.data_emissao >= ${from} AND n.data_emissao < ${to})::bigint AS boletos,
          (SELECT COUNT(*) FROM nfe n WHERE n.unit_id=${unitId} AND n.data_emissao >= ${from} AND n.data_emissao < ${to} AND NULLIF(BTRIM(n.codigo_rastreio),'') IS NOT NULL)::bigint AS tracking,
          (SELECT COUNT(*) FROM nfe n WHERE n.unit_id=${unitId} AND n.data_emissao >= ${from} AND n.data_emissao < ${to} AND n.invoice_message_status='sent' AND n.satisfaction_message_status='pending')::bigint AS "pendingSurvey"
      `),
    ]);
    const calculationMap = new Map(
      calculationRows.map((row) => [row.calculation, Number(row.total)]),
    );
    const documents = documentsRows[0];
    return {
      calculation: {
        success: calculationMap.get("calculated") ?? 0,
        inconsistent: calculationMap.get("inconsistent") ?? 0,
        failed: calculationMap.get("failed") ?? 0,
        unprocessed: calculationMap.get("pending") ?? 0,
      },
      channels: channels.map((row) => ({
        ...row,
        invoices: Number(row.invoices),
      })),
      vendors: vendors.map((row) => ({
        ...row,
        invoices: Number(row.invoices),
      })),
      customers: customers.map((row) => ({
        ...row,
        invoices: Number(row.invoices),
      })),
      dailyRevenue: {
        median: dailyRevenueMedianRows[0]?.median ?? "0.00",
        points: dailyRevenue.map((row) => ({
          ...row,
          invoices: Number(row.invoices),
        })),
      },
      products,
      documents: {
        boletos: Number(documents?.boletos ?? 0n),
        tracking: Number(documents?.tracking ?? 0n),
        pendingSurvey: Number(documents?.pendingSurvey ?? 0n),
      },
    };
  }

  private async legacyRows(
    principal: AuthPrincipal,
    from: Date,
    to: Date,
  ): Promise<DashboardInvoiceRow[]> {
    if (!principal.activeTenantId) {
      throw new BadRequestException(
        "Empresa autenticada não possui configuração operacional",
      );
    }
    const rows = await this.database.$queryRaw<LegacyInvoiceRow[]>(Prisma.sql`
      SELECT
        COALESCE(numero::text, '—') AS "number",
        data_emissao AS "issuedAt",
        COALESCE(nome, 'Cliente não identificado') AS "customerName",
        COALESCE(tipo_venda, 'Bling') AS "channel",
        COALESCE(valor, 0)::numeric::text AS "grossRevenue",
        COALESCE(venda_liquido, valor, 0)::numeric::text AS "netRevenue",
        COALESCE(custo_liquido, custo_total, 0)::numeric::text AS "cost",
        COALESCE(impostos, 0)::numeric::text AS "tax",
        COALESCE(lucro, 0)::numeric::text AS "profit",
        COALESCE(status_envio, 'Sincronizada') AS "status",
        tem_boleto = 'S' AS "hasBoleto",
        tem_cod = 'S' AS "hasTracking"
      FROM invoice_overview
      WHERE unit_id = ${principal.activeTenantId}
        AND data_emissao >= ${from}
        AND data_emissao < ${to}
      ORDER BY data_emissao DESC
    `);
    return rows;
  }
}

function executiveFilter(
  unitId: string,
  from: string,
  to: string,
  input: DashboardExecutiveQuery,
): Prisma.Sql {
  return Prisma.sql`
    n.unit_id=${unitId} AND n.cancelled_at IS NULL AND n.situacao <> 2
    AND n.data_emissao >= ${from}::date AND n.data_emissao < (${to}::date + INTERVAL '1 day')
    ${input.origin ? Prisma.sql`AND COALESCE(NULLIF(BTRIM(cv.descricao),''),'Origem indefinida') = ${input.origin}` : Prisma.empty}
    ${input.product ? Prisma.sql`AND EXISTS (SELECT 1 FROM nfe_item fi LEFT JOIN produtos fp ON fp.id=fi.produtos_id AND fp.unit_id=fi.unit_id WHERE fi.nfe_id=n.id AND fi.unit_id=n.unit_id AND COALESCE(fp.nome,fi.descricao,'') ILIKE ${`%${input.product}%`})` : Prisma.empty}
    ${input.productCode ? Prisma.sql`AND EXISTS (SELECT 1 FROM nfe_item fci LEFT JOIN produtos fcp ON fcp.id=fci.produtos_id AND fcp.unit_id=fci.unit_id WHERE fci.nfe_id=n.id AND fci.unit_id=n.unit_id AND COALESCE(NULLIF(BTRIM(fcp.codigo),''),NULLIF(BTRIM(fci.id_produto),''),'')=${input.productCode})` : Prisma.empty}
    ${input.productGroup ? Prisma.sql`AND EXISTS (SELECT 1 FROM nfe_item fgi LEFT JOIN produtos fgp ON fgp.id=fgi.produtos_id AND fgp.unit_id=fgi.unit_id LEFT JOIN grupo_produto fgg ON fgg.id=fgp.group_id AND fgg.unit_id=fgp.unit_id WHERE fgi.nfe_id=n.id AND fgi.unit_id=n.unit_id AND COALESCE(NULLIF(BTRIM(fgg.nome),''),'Sem grupo')=${input.productGroup})` : Prisma.empty}
    ${input.monthCompetence ? Prisma.sql`AND TO_CHAR(n.data_emissao,'YYYY-MM')=${input.monthCompetence}` : Prisma.empty}
  `;
}

function dashboardItemFilter(input: DashboardExecutiveQuery): Prisma.Sql {
  return Prisma.sql`
    ${input.product ? Prisma.sql`AND COALESCE(NULLIF(BTRIM(pr.nome),''),NULLIF(BTRIM(ni.descricao),''),'') ILIKE ${`%${input.product}%`}` : Prisma.empty}
    ${input.productCode ? Prisma.sql`AND COALESCE(NULLIF(BTRIM(pr.codigo),''),NULLIF(BTRIM(ni.id_produto),''),'')=${input.productCode}` : Prisma.empty}
    ${input.productGroup ? Prisma.sql`AND COALESCE(NULLIF(BTRIM(pg.nome),''),'Sem grupo')=${input.productGroup}` : Prisma.empty}
  `;
}

function analysisItemFilter(input: DashboardExecutiveQuery): Prisma.Sql {
  return Prisma.sql`
    ${input.product ? Prisma.sql`AND COALESCE(NULLIF(BTRIM(p.nome),''),NULLIF(BTRIM(i.descricao),''),'') ILIKE ${`%${input.product}%`}` : Prisma.empty}
    ${input.productCode ? Prisma.sql`AND COALESCE(NULLIF(BTRIM(p.codigo),''),NULLIF(BTRIM(i.id_produto),''),'')=${input.productCode}` : Prisma.empty}
    ${input.productGroup ? Prisma.sql`AND COALESCE(NULLIF(BTRIM(g.nome),''),'Sem grupo')=${input.productGroup}` : Prisma.empty}
  `;
}

function itemAnalysisQuery(
  invoiceFilter: Prisma.Sql,
  input: DashboardExecutiveQuery,
): Prisma.Sql {
  return Prisma.sql`
    WITH facts AS (
      SELECT n.id invoice_id,
        TO_CHAR(n.data_emissao,'YYYY-MM') period_key,
        TO_CHAR(n.data_emissao,'MM/YYYY') period_label,
        COALESCE(NULLIF(BTRIM(cv.descricao),''),'Origem indefinida') origin,
        COALESCE(NULLIF(BTRIM(p.codigo),''),i.id_produto,'—') product_code,
        COALESCE(NULLIF(BTRIM(p.nome),''),NULLIF(BTRIM(i.descricao),''),'Produto não identificado') product_name,
        COALESCE(NULLIF(BTRIM(g.nome),''),'Sem grupo') product_group,
        (COALESCE(p.fabricacao_propria,FALSE) OR COALESCE(g.own_manufacture,FALSE)) is_manufacturing,
        COALESCE(i.qnt,0)::numeric quantity,
        COALESCE(i.venda_bruto_total,0)::numeric revenue,
        COALESCE(i.custo_total,0)::numeric cmv,
        COALESCE(i.custo_liquido_total,0)::numeric cost,
        COALESCE(cr.credits,0)::numeric credits,
        COALESCE(i.valor_lucro_total,0)::numeric profit
      FROM nfe_item i
      JOIN nfe n ON n.id=i.nfe_id AND n.unit_id=i.unit_id
      LEFT JOIN produtos p ON p.id=i.produtos_id AND p.unit_id=i.unit_id
      LEFT JOIN grupo_produto g ON g.id=p.group_id AND g.unit_id=p.unit_id
      LEFT JOIN canal_venda cv ON cv.loja_id=n.loja_id AND cv.unit_id=n.unit_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(ci.valor),0)::numeric credits
        FROM credito_item ci
        WHERE ci.nfe_item_id=i.id AND ci.unit_id=i.unit_id
      ) cr ON TRUE
      WHERE ${invoiceFilter} ${analysisItemFilter(input)}
    ), cmv_rows AS (
      SELECT 'cmv'::text scope,
        CASE WHEN GROUPING(product_name)=0 THEN 'product'
          WHEN GROUPING(origin)=0 THEN 'origin'
          WHEN GROUPING(period_key)=0 THEN 'period' ELSE 'total' END::text dimension,
        period_key key,
        CASE WHEN GROUPING(product_name)=0 THEN product_name
          WHEN GROUPING(origin)=0 THEN origin
          WHEN GROUPING(period_key)=0 THEN period_label ELSE 'CMV total' END label,
        product_code code, product_group "group",
        ROUND(COALESCE(SUM(quantity),0),6)::text quantity,
        ROUND(COALESCE(SUM(revenue),0),2)::text revenue,
        ROUND(COALESCE(SUM(cmv),0),2)::text cmv,
        ROUND(COALESCE(SUM(cost),0),2)::text cost,
        ROUND(COALESCE(SUM(credits),0),2)::text credits,
        ROUND(COALESCE(SUM(profit),0),2)::text profit,
        ROUND(CASE WHEN COALESCE(SUM(revenue),0)=0 THEN 0 ELSE SUM(profit)/SUM(revenue)*100 END,2)::text margin,
        COUNT(DISTINCT invoice_id)::bigint invoices
      FROM facts
      GROUP BY GROUPING SETS ((),(period_key,period_label),(origin),(period_key,period_label,product_code,product_name,product_group))
    ), manufacturing_rows AS (
      SELECT 'manufacturing'::text scope,
        CASE WHEN GROUPING(product_name)=0 THEN 'product'
          WHEN GROUPING(product_group)=0 THEN 'group'
          WHEN GROUPING(origin)=0 THEN 'origin'
          WHEN GROUPING(period_key)=0 THEN 'period' ELSE 'total' END::text dimension,
        period_key key,
        CASE WHEN GROUPING(product_name)=0 THEN product_name
          WHEN GROUPING(product_group)=0 THEN product_group
          WHEN GROUPING(origin)=0 THEN origin
          WHEN GROUPING(period_key)=0 THEN period_label ELSE 'Fabricação própria' END label,
        product_code code, product_group "group",
        ROUND(COALESCE(SUM(quantity),0),6)::text quantity,
        ROUND(COALESCE(SUM(revenue),0),2)::text revenue,
        ROUND(COALESCE(SUM(cmv),0),2)::text cmv,
        ROUND(COALESCE(SUM(cost),0),2)::text cost,
        ROUND(COALESCE(SUM(credits),0),2)::text credits,
        ROUND(COALESCE(SUM(profit),0),2)::text profit,
        ROUND(CASE WHEN COALESCE(SUM(revenue),0)=0 THEN 0 ELSE SUM(profit)/SUM(revenue)*100 END,2)::text margin,
        COUNT(DISTINCT invoice_id)::bigint invoices
      FROM facts WHERE is_manufacturing
      GROUP BY GROUPING SETS ((),(period_key,period_label),(origin),(product_group),(period_key,period_label,product_code,product_name,product_group))
    ), combined AS (
      SELECT * FROM cmv_rows UNION ALL SELECT * FROM manufacturing_rows
    )
    SELECT * FROM combined
    ORDER BY scope, dimension,
      CASE WHEN dimension='period' THEN key END,
      CASE WHEN dimension='product' THEN key END DESC,
      CASE WHEN dimension='product' AND scope='cmv' THEN cmv::numeric END DESC,
      CASE WHEN dimension='product' AND scope='manufacturing' THEN profit::numeric END DESC,
      CASE WHEN dimension IN ('origin','group') THEN revenue::numeric END DESC
  `;
}

function reportDetailFilter(input: DashboardInvoiceReportQuery): Prisma.Sql {
  return Prisma.sql`
    ${input.state ? Prisma.sql`AND UPPER(COALESCE(a.uf,''))=${input.state.toUpperCase()}` : Prisma.empty}
    ${input.customer ? Prisma.sql`AND COALESCE(p.nome,'') ILIKE ${`%${input.customer}%`}` : Prisma.empty}
    ${input.view === "cmv" || input.view === "manufacturing" ? Prisma.sql`AND COALESCE(ia.item_count,0)>0` : Prisma.empty}
  `;
}

function reportItemAggregation(input: DashboardInvoiceReportQuery): Prisma.Sql {
  return Prisma.sql`
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::bigint item_count,
        COALESCE(SUM(ri.qnt),0)::numeric quantity,
        COALESCE(SUM(ri.custo_total),0)::numeric cmv,
        COALESCE(SUM(ri.venda_bruto_total),0)::numeric revenue,
        COALESCE(SUM(ri.custo_liquido_total),0)::numeric cost,
        COALESCE(SUM(ri.valor_lucro_total),0)::numeric profit
      FROM nfe_item ri
      LEFT JOIN produtos rp ON rp.id=ri.produtos_id AND rp.unit_id=ri.unit_id
      LEFT JOIN grupo_produto rg ON rg.id=rp.group_id AND rg.unit_id=rp.unit_id
      WHERE ri.nfe_id=n.id AND ri.unit_id=n.unit_id
        ${input.product ? Prisma.sql`AND COALESCE(NULLIF(BTRIM(rp.nome),''),NULLIF(BTRIM(ri.descricao),''),'') ILIKE ${`%${input.product}%`}` : Prisma.empty}
        ${input.productGroup ? Prisma.sql`AND COALESCE(NULLIF(BTRIM(rg.nome),''),'Sem grupo')=${input.productGroup}` : Prisma.empty}
        ${input.view === "manufacturing" ? Prisma.sql`AND (COALESCE(rp.fabricacao_propria,FALSE) OR COALESCE(rg.own_manufacture,FALSE))` : Prisma.empty}
    ) ia ON TRUE
  `;
}

function goalQuery(unitId: string, competence?: string): Prisma.Sql {
  return Prisma.sql`
    WITH selected_goal AS (
      SELECT id, mes_ano, data_inicial::date starts_at, data_final::date ends_at
      FROM meta WHERE unit_id=${unitId}
      ${competence ? Prisma.sql`AND mes_ano=${competence}` : Prisma.empty}
      ORDER BY data_inicial DESC LIMIT 1
    ), days AS (
      SELECT g.id, g.mes_ano, d::date AS goal_day FROM selected_goal g,
      LATERAL generate_series(g.starts_at,g.ends_at,INTERVAL '1 day') d
    ), profit AS (
      SELECT n.data_emissao::date AS profit_day, SUM(n.lucro)::numeric value FROM nfe n, selected_goal g
      WHERE n.unit_id=${unitId} AND n.cancelled_at IS NULL AND n.situacao<>2
        AND n.data_emissao::date BETWEEN g.starts_at AND g.ends_at GROUP BY 1
    ), goal_cost AS (
      SELECT COALESCE(SUM(mc.valor_custo),0)::numeric value FROM meta_custo mc JOIN selected_goal g ON g.id=mc.meta_id
    ), series AS (
      SELECT d.mes_ano competence,d.goal_day,SUM(COALESCE(p.value,0)) OVER(ORDER BY d.goal_day)::numeric cumulative,
        (SELECT value FROM goal_cost) cost FROM days d LEFT JOIN profit p ON p.profit_day=d.goal_day
    ) SELECT competence,goal_day::text date,ROUND(cumulative,2)::text AS "cumulativeProfit",
      ROUND(cost,2)::text AS "goalCost",ROUND(cumulative-cost,2)::text balance,
      ROUND(CASE WHEN cost=0 THEN 0 ELSE cumulative/cost*100 END,2)::text reached
    FROM series ORDER BY goal_day
  `;
}
