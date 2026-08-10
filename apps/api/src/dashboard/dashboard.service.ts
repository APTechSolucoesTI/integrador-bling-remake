import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  dashboardSummarySchema,
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

interface AnalyticsGroupRow { label: string; revenue: string; profit: string; invoices: bigint }
interface ProductAnalyticsRow { name: string; quantity: string; revenue: string; profit: string }
interface CalculationRow { calculation: string | null; total: bigint }
interface DocumentAnalyticsRow { boletos: bigint; tracking: bigint; pendingSurvey: bigint }

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

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
      source: "legacy-postgresql",
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
    const unitId = principal.legacyUnitId;
    if (unitId === null) throw new BadRequestException("Tenant sem vínculo legado");
    const [calculationRows, channels, vendors, products, documentsRows] = await Promise.all([
      this.database.$queryRaw<CalculationRow[]>(Prisma.sql`
        SELECT tem_calculo AS calculation, COUNT(*)::bigint AS total FROM nfe
        WHERE unit_id=${unitId} AND data_emissao >= ${from} AND data_emissao < ${to}
        GROUP BY tem_calculo
      `),
      this.database.$queryRaw<AnalyticsGroupRow[]>(Prisma.sql`
        SELECT COALESCE(NULLIF(BTRIM(tipo_venda), ''), 'Não informado') AS label,
          ROUND(COALESCE(SUM(valor),0)::numeric,2)::text AS revenue, ROUND(COALESCE(SUM(lucro),0)::numeric,2)::text AS profit,
          COUNT(*)::bigint AS invoices FROM view_nfe WHERE unit_id=${unitId} AND data_emissao >= ${from} AND data_emissao < ${to}
        GROUP BY tipo_venda ORDER BY SUM(valor) DESC NULLS LAST LIMIT 8
      `),
      this.database.$queryRaw<AnalyticsGroupRow[]>(Prisma.sql`
        SELECT COALESCE(NULLIF(BTRIM(v.nome), ''), 'Sem vendedor') AS label,
          ROUND(COALESCE(SUM(n.valor),0)::numeric,2)::text AS revenue, ROUND(COALESCE(SUM(n.lucro),0)::numeric,2)::text AS profit,
          COUNT(*)::bigint AS invoices FROM nfe n LEFT JOIN vendedores v ON v.id_bling=n.vendedor_id AND v.unit_id=n.unit_id
        WHERE n.unit_id=${unitId} AND n.data_emissao >= ${from} AND n.data_emissao < ${to}
        GROUP BY v.nome ORDER BY SUM(n.valor) DESC NULLS LAST LIMIT 8
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
          (SELECT COUNT(*) FROM nfe n WHERE n.unit_id=${unitId} AND n.data_emissao >= ${from} AND n.data_emissao < ${to} AND n.status_envio_id=1 AND COALESCE(n.pesquisa,'N')='N')::bigint AS "pendingSurvey"
      `),
    ]);
    const calculationMap = new Map(calculationRows.map((row) => [row.calculation, Number(row.total)]));
    const documents = documentsRows[0];
    return {
      calculation: { success: calculationMap.get("S") ?? 0, inconsistent: calculationMap.get("I") ?? 0, failed: calculationMap.get("N") ?? 0, unprocessed: calculationMap.get(null) ?? 0 },
      channels: channels.map((row) => ({ ...row, invoices: Number(row.invoices) })),
      vendors: vendors.map((row) => ({ ...row, invoices: Number(row.invoices) })),
      products,
      documents: { boletos: Number(documents?.boletos ?? 0n), tracking: Number(documents?.tracking ?? 0n), pendingSurvey: Number(documents?.pendingSurvey ?? 0n) },
    };
  }

  private async legacyRows(
    principal: AuthPrincipal,
    from: Date,
    to: Date,
  ): Promise<DashboardInvoiceRow[]> {
    if (principal.legacyUnitId === null) {
      throw new BadRequestException(
        "Tenant real ainda não possui vínculo legacyUnitId",
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
      FROM view_nfe
      WHERE unit_id = ${principal.legacyUnitId}
        AND data_emissao >= ${from}
        AND data_emissao < ${to}
      ORDER BY data_emissao DESC
    `);
    return rows;
  }
}
