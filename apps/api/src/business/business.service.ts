import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { businessOverviewResponseSchema, type BusinessOverviewResponse, type FixedCostInput } from "@integrador/contracts";
import { Prisma, type DatabaseClient } from "@integrador/db";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";

interface IdRow { id: number }
interface CountRow { total: bigint }
interface BoletoRow { id: number; invoiceId: number | null; invoiceNumber: string | null; customer: string; externalNumber: string | null; dueDate: string | null; value: string; status: number | null; link: string | null }
interface TrackingRow { invoiceId: number; invoiceNumber: string; customer: string; issuedAt: string | null; sentAt: Date | null; primaryCode: string | null; secondaryCode: string | null; status: string }
interface VendorRow { id: number; blingId: string | null; name: string; sector: string | null }
interface ChannelRow { id: number; storeId: string | null; description: string; type: string | null }
interface PaymentRow { id: number; blingId: string | null; description: string; type: string | null }
interface ProductGroupRow { id: number; blingId: string | null; name: string }
interface OperationNatureRow { id: number; blingId: string | null; description: string }
interface CostTypeRow { id: number; label: string }
interface FixedCostRow { id: number; name: string; description: string | null; value: string; application: "Item" | "Nota"; valueType: "F" | "P"; categoryId: number | null; category: string | null; channelIds: number[] }
interface TaxRow { id: number; name: string; simulationRate: string }
interface DifalRow { id: number; state: string; internalRate: string }

@Injectable()
export class BusinessService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: DatabaseClient) {}

  async overview(principal: AuthPrincipal): Promise<BusinessOverviewResponse> {
    const unitId = this.unit(principal);
    const [boletos, tracking, vendors, channels, paymentMethods, productGroups, operationNatures, fixedCostTypes, fixedCosts, taxRules, difal] = await Promise.all([
      this.database.$queryRaw<BoletoRow[]>(Prisma.sql`
        SELECT b.id, n.id AS "invoiceId", n.numero::text AS "invoiceNumber",
          COALESCE(NULLIF(BTRIM(p.nome), ''), 'Cliente não identificado') AS customer,
          NULLIF(BTRIM(b.numero_externo), '') AS "externalNumber", TO_CHAR(b.vencimento, 'YYYY-MM-DD') AS "dueDate",
          ROUND(COALESCE(b.valor, b.valor_total, 0)::numeric, 2)::text AS value, b.situacao AS status,
          NULLIF(BTRIM(b.link_boleto), '') AS link
        FROM boleto b
        LEFT JOIN nfe n ON n.id_bling = b.nfe_id_bling AND n.unit_id = b.unit_id
        LEFT JOIN pessoa p ON p.id_bling = n.contato_id_bling AND p.unit_id = n.unit_id
        WHERE b.unit_id = ${unitId}
        ORDER BY b.vencimento DESC NULLS LAST, b.id DESC LIMIT 100
      `),
      this.database.$queryRaw<TrackingRow[]>(Prisma.sql`
        SELECT n.id AS "invoiceId", n.numero::text AS "invoiceNumber",
          COALESCE(NULLIF(BTRIM(p.nome), ''), 'Cliente não identificado') AS customer,
          TO_CHAR(n.data_emissao, 'YYYY-MM-DD') AS "issuedAt", n.data_nota_envio AS "sentAt",
          NULLIF(BTRIM(n.codigo_rastreio), '') AS "primaryCode", NULLIF(BTRIM(n.codigo_rastreio2), '') AS "secondaryCode",
          COALESCE(se.status, 'Indefinido') AS status
        FROM nfe n LEFT JOIN pessoa p ON p.id_bling = n.contato_id_bling AND p.unit_id = n.unit_id
        LEFT JOIN status_envio se ON se.id = n.status_envio_id
        WHERE n.unit_id = ${unitId} AND (NULLIF(BTRIM(n.codigo_rastreio), '') IS NOT NULL OR NULLIF(BTRIM(n.codigo_rastreio2), '') IS NOT NULL)
        ORDER BY n.data_emissao DESC NULLS LAST, n.id DESC LIMIT 100
      `),
      this.database.$queryRaw<VendorRow[]>(Prisma.sql`
        SELECT v.id, NULLIF(BTRIM(v.id_bling), '') AS "blingId", COALESCE(NULLIF(BTRIM(v.nome), ''), 'Sem nome') AS name,
          NULLIF(BTRIM(s.nome), '') AS sector FROM vendedores v LEFT JOIN setor s ON s.id = v.setor_id
        WHERE v.unit_id = ${unitId} ORDER BY v.nome, v.id
      `),
      this.database.$queryRaw<ChannelRow[]>(Prisma.sql`
        SELECT id, NULLIF(BTRIM(loja_id), '') AS "storeId", COALESCE(NULLIF(BTRIM(descricao), ''), 'Sem descrição') AS description,
          NULLIF(BTRIM(tipo), '') AS type FROM canal_venda WHERE unit_id = ${unitId} ORDER BY descricao, id
      `),
      this.database.$queryRaw<PaymentRow[]>(Prisma.sql`
        SELECT id, NULLIF(BTRIM(id_bling), '') AS "blingId", COALESCE(NULLIF(BTRIM(descricao), ''), 'Sem descrição') AS description,
          NULLIF(BTRIM(tipo_pagamento), '') AS type FROM forma_pagamento WHERE unit_id = ${unitId} ORDER BY descricao, id
      `),
      this.database.$queryRaw<ProductGroupRow[]>(Prisma.sql`
        SELECT id, NULLIF(BTRIM(id_bling), '') AS "blingId", COALESCE(NULLIF(BTRIM(nome), ''), 'Sem nome') AS name
        FROM grupo_produto WHERE unit_id=${unitId} ORDER BY nome, id
      `),
      this.database.$queryRaw<OperationNatureRow[]>(Prisma.sql`
        SELECT id, NULLIF(BTRIM(id_bling), '') AS "blingId", COALESCE(NULLIF(BTRIM(descricao), ''), 'Sem descrição') AS description
        FROM natureza_operacao WHERE unit_id=${unitId} ORDER BY descricao, id
      `),
      this.database.$queryRaw<CostTypeRow[]>(Prisma.sql`SELECT id, COALESCE(NULLIF(BTRIM(tipo), ''), 'Sem categoria') AS label FROM tipo_custo_fixo ORDER BY tipo, id`),
      this.database.$queryRaw<FixedCostRow[]>(Prisma.sql`
        SELECT cf.id, COALESCE(NULLIF(BTRIM(cf.nome), ''), 'Sem nome') AS name, NULLIF(BTRIM(cf.descricao), '') AS description,
          ROUND(COALESCE(cf.valor, 0)::numeric, 2)::text AS value, cf.tipo AS application, cf.tipo_valor AS "valueType",
          cf.tipo_custo_fixo_id AS "categoryId", NULLIF(BTRIM(tcf.tipo), '') AS category,
          COALESCE(ARRAY_AGG(cfcv.canal_venda_id) FILTER (WHERE cfcv.canal_venda_id IS NOT NULL), ARRAY[]::integer[]) AS "channelIds"
        FROM custo_fixo cf LEFT JOIN tipo_custo_fixo tcf ON tcf.id = cf.tipo_custo_fixo_id
        LEFT JOIN cfcv ON cfcv.custo_fixo_id = cf.id AND cfcv.unit_id = cf.unit_id
        WHERE cf.unit_id = ${unitId} GROUP BY cf.id, tcf.tipo ORDER BY cf.nome, cf.id
      `),
      this.database.$queryRaw<TaxRow[]>(Prisma.sql`SELECT id, COALESCE(NULLIF(BTRIM(nome), ''), 'Sem nome') AS name, ROUND(COALESCE(aliquota_simulacao, 0)::numeric, 2)::text AS "simulationRate" FROM tributacao ORDER BY nome, id`),
      this.database.$queryRaw<DifalRow[]>(Prisma.sql`SELECT id, UPPER(estado) AS state, ROUND(COALESCE(aliquota_interna, 0)::numeric, 2)::text AS "internalRate" FROM tributacao_difal WHERE estado IS NOT NULL ORDER BY estado, id`),
    ]);
    return businessOverviewResponseSchema.parse({
      documents: { boletos, tracking: tracking.map((item) => ({ ...item, sentAt: item.sentAt?.toISOString() ?? null })) },
      commercial: { vendors, channels, paymentMethods, productGroups, operationNatures },
      fiscal: { fixedCostTypes, fixedCosts, taxRules, difal },
    });
  }

  async saveFixedCost(principal: AuthPrincipal, id: number | null, input: FixedCostInput): Promise<BusinessOverviewResponse> {
    const unitId = this.unit(principal);
    const uniqueChannels = [...new Set(input.channelIds)];
    if (uniqueChannels.length) {
      const rows = await this.database.$queryRaw<CountRow[]>(Prisma.sql`SELECT COUNT(*)::bigint AS total FROM canal_venda WHERE unit_id = ${unitId} AND id IN (${Prisma.join(uniqueChannels)})`);
      if (Number(rows[0]?.total ?? 0n) !== uniqueChannels.length) throw new BadRequestException("Um dos canais não pertence a esta empresa");
    }
    await this.database.$transaction(async (transaction) => {
      let costId = id;
      if (id) {
        const existing = await transaction.$queryRaw<IdRow[]>(Prisma.sql`SELECT id FROM custo_fixo WHERE id = ${id} AND unit_id = ${unitId}`);
        if (!existing[0]) throw new NotFoundException("Custo fixo não encontrado");
        await transaction.$executeRaw(Prisma.sql`
          UPDATE custo_fixo SET nome = ${input.name}, descricao = ${input.description}, valor = ${input.value}::numeric,
            tipo = ${input.application}, tipo_valor = ${input.valueType}, tipo_custo_fixo_id = ${input.categoryId}
          WHERE id = ${id} AND unit_id = ${unitId}
        `);
      } else {
        const inserted = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO custo_fixo (nome, descricao, valor, tipo, tipo_valor, unit_id, tipo_custo_fixo_id)
          VALUES (${input.name}, ${input.description}, ${input.value}::numeric, ${input.application}, ${input.valueType}, ${unitId}, ${input.categoryId})
          RETURNING id
        `);
        costId = inserted[0]!.id;
      }
      await transaction.$executeRaw(Prisma.sql`DELETE FROM cfcv WHERE custo_fixo_id = ${costId} AND unit_id = ${unitId}`);
      for (const channelId of uniqueChannels) await transaction.$executeRaw(Prisma.sql`INSERT INTO cfcv (custo_fixo_id, canal_venda_id, unit_id) VALUES (${costId}, ${channelId}, ${unitId})`);
      await transaction.auditLog.create({ data: { tenantId: principal.activeTenantId, actorUserId: principal.userId, action: id ? "business.fixed_cost.updated" : "business.fixed_cost.created", entityType: "fixed_cost", entityId: String(costId), correlationId: randomUUID(), metadata: { application: input.application, valueType: input.valueType, channels: uniqueChannels.length } } });
    });
    return this.overview(principal);
  }

  private unit(principal: AuthPrincipal): number { if (principal.tenantDemo || principal.legacyUnitId === null) throw new BadRequestException("Empresa sem vínculo com o banco legado"); return principal.legacyUnitId; }
}
