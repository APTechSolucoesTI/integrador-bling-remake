import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  marketplaceFeesResponseSchema,
  type MarketplaceFeesQuery,
  type MarketplaceFeesResponse,
} from "@integrador/contracts";
import { Prisma, type DatabaseClient } from "@integrador/db";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";

interface MarketplaceFeeRow {
  id: number;
  invoiceNumber: string;
  company: string;
  origin: string;
  customer: string;
  issuedAt: Date | null;
  value: string;
  commissionValue: string;
  commissionPercent: string;
  freightValue: string;
  freightPercent: string;
  discountValue: string;
}

interface CountRow {
  total: bigint;
}

interface OptionRow {
  value: string;
}

@Injectable()
export class MarketplaceFeesService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async list(
    principal: AuthPrincipal,
    query: MarketplaceFeesQuery,
  ): Promise<MarketplaceFeesResponse> {
    if (principal.tenantDemo) {
      throw new BadRequestException(
        "Taxas do Mercado Livre não consultam dados reais na demonstração pública",
      );
    }

    const unitId = principal.activeTenantId;
    const filters: Prisma.Sql[] = [
      Prisma.sql`n.unit_id = ${unitId}`,
      Prisma.sql`n.cancelled_at IS NULL`,
      Prisma.sql`n.situacao <> 2`,
      Prisma.sql`(cv.tipo = 'MercadoLivre' OR COALESCE(ml.commission, 0) > 0)`,
    ];
    if (query.invoiceNumber) {
      filters.push(Prisma.sql`n.numero = ${query.invoiceNumber}`);
    }
    if (query.origin) {
      filters.push(
        Prisma.sql`COALESCE(NULLIF(BTRIM(cv.descricao), ''), 'Origem indefinida') = ${query.origin}`,
      );
    }
    if (query.from) {
      filters.push(Prisma.sql`n.data_emissao::date >= ${query.from}::date`);
    }
    if (query.to) {
      filters.push(Prisma.sql`n.data_emissao::date <= ${query.to}::date`);
    }
    const where = Prisma.join(filters, " AND ");
    const offset = (query.page - 1) * query.pageSize;
    const commissionCte = Prisma.sql`
      SELECT ni.nfe_id, SUM(fi.valor)::numeric AS commission
      FROM taxa_item fi
      JOIN nfe_item ni ON ni.id = fi.nfe_item_id AND ni.unit_id = fi.unit_id
      WHERE fi.unit_id = ${unitId}
        AND fi.nome ILIKE '%Mercado Livre%'
      GROUP BY ni.nfe_id
    `;

    const [items, countRows, invoiceNumbers, origins] = await Promise.all([
      this.database.$queryRaw<MarketplaceFeeRow[]>(Prisma.sql`
        WITH ml AS (${commissionCte})
        SELECT
          n.id,
          n.numero::text AS "invoiceNumber",
          ${principal.tenantName}::text AS company,
          COALESCE(NULLIF(BTRIM(cv.descricao), ''), 'Origem indefinida') AS origin,
          COALESCE(NULLIF(BTRIM(p.nome), ''), 'Cliente não identificado') AS customer,
          n.data_emissao AS "issuedAt",
          ROUND(COALESCE(n.valor, 0)::numeric, 2)::text AS value,
          ROUND(COALESCE(ml.commission, 0)::numeric, 2)::text AS "commissionValue",
          ROUND(CASE WHEN COALESCE(n.valor, 0) = 0 THEN 0
            ELSE COALESCE(ml.commission, 0) / n.valor * 100 END, 2)::text AS "commissionPercent",
          ROUND(COALESCE(n.frete, 0)::numeric, 2)::text AS "freightValue",
          ROUND(CASE WHEN COALESCE(n.valor, 0) = 0 THEN 0
            ELSE COALESCE(n.frete, 0) / n.valor * 100 END, 2)::text AS "freightPercent",
          ROUND(COALESCE(n.desconto, 0)::numeric, 2)::text AS "discountValue"
        FROM nfe n
        LEFT JOIN pessoa p ON p.id_bling = n.contato_id_bling AND p.unit_id = n.unit_id
        LEFT JOIN canal_venda cv ON cv.loja_id = n.loja_id AND cv.unit_id = n.unit_id
        LEFT JOIN ml ON ml.nfe_id = n.id
        WHERE ${where}
        ORDER BY n.frete DESC, n.data_emissao DESC NULLS LAST, n.id DESC
        LIMIT ${query.pageSize}
        OFFSET ${offset}
      `),
      this.database.$queryRaw<CountRow[]>(Prisma.sql`
        WITH ml AS (${commissionCte})
        SELECT COUNT(*)::bigint AS total
        FROM nfe n
        LEFT JOIN canal_venda cv ON cv.loja_id = n.loja_id AND cv.unit_id = n.unit_id
        LEFT JOIN ml ON ml.nfe_id = n.id
        WHERE ${where}
      `),
      this.database.$queryRaw<OptionRow[]>(Prisma.sql`
        WITH ml AS (${commissionCte})
        SELECT DISTINCT n.numero::text AS value
        FROM nfe n
        LEFT JOIN canal_venda cv ON cv.loja_id = n.loja_id AND cv.unit_id = n.unit_id
        LEFT JOIN ml ON ml.nfe_id = n.id
        WHERE n.unit_id = ${unitId}
          AND n.cancelled_at IS NULL
          AND n.situacao <> 2
          AND (cv.tipo = 'MercadoLivre' OR COALESCE(ml.commission, 0) > 0)
        ORDER BY value DESC
        LIMIT 1000
      `),
      this.database.$queryRaw<OptionRow[]>(Prisma.sql`
        WITH ml AS (${commissionCte})
        SELECT DISTINCT COALESCE(NULLIF(BTRIM(cv.descricao), ''), 'Origem indefinida') AS value
        FROM nfe n
        LEFT JOIN canal_venda cv ON cv.loja_id = n.loja_id AND cv.unit_id = n.unit_id
        LEFT JOIN ml ON ml.nfe_id = n.id
        WHERE n.unit_id = ${unitId}
          AND n.cancelled_at IS NULL
          AND n.situacao <> 2
          AND (cv.tipo = 'MercadoLivre' OR COALESCE(ml.commission, 0) > 0)
        ORDER BY value
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0n);
    return marketplaceFeesResponseSchema.parse({
      tenant: { id: unitId, name: principal.tenantName },
      filters: {
        invoiceNumbers: invoiceNumbers.map((item) => item.value),
        origins: origins.map((item) => item.value),
      },
      items: items.map((item) => ({
        ...item,
        issuedAt: item.issuedAt?.toISOString() ?? null,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    });
  }
}
