import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  businessOverviewResponseSchema,
  type BusinessOverviewResponse,
  fixedCostDuplicateResponseSchema,
  type FixedCostDuplicateResponse,
  type FixedCostInput,
  type NcmCreditInput,
  type ModulePermission,
  type SectorInput,
} from "@integrador/contracts";
import { Prisma, type DatabaseClient } from "@integrador/db";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";

interface IdRow {
  id: number;
}

function canAccess(principal: AuthPrincipal, permission: ModulePermission) {
  return (
    principal.superAdmin ||
    principal.permissions.includes(permission)
  );
}
interface CountRow {
  total: bigint;
}
interface BoletoRow {
  id: number;
  invoiceId: number | null;
  invoiceNumber: string | null;
  customer: string;
  externalNumber: string | null;
  dueDate: string | null;
  value: string;
  status: number | null;
  link: string | null;
}
interface TrackingRow {
  invoiceId: number;
  invoiceNumber: string;
  customer: string;
  issuedAt: string | null;
  sentAt: Date | null;
  primaryCode: string | null;
  secondaryCode: string | null;
  status: string;
}
interface VendorRow {
  id: number;
  blingId: string | null;
  name: string;
  sectorId: number | null;
  sector: string | null;
}
interface SectorRow {
  id: number;
  name: string;
  active: boolean;
  sellers: number;
}
interface SalesOrderRow {
  id: number;
  blingId: string;
  number: number | null;
  issuedAt: string | null;
  total: string;
  statusCode: number | null;
  invoiceBlingId: string | null;
}
interface ChannelRow {
  id: number;
  storeId: string | null;
  description: string;
  type: string | null;
}
interface PaymentRow {
  id: number;
  blingId: string | null;
  description: string;
  type: string | null;
}
interface ProductGroupRow {
  id: number;
  blingId: string | null;
  name: string;
}
interface OperationNatureRow {
  id: number;
  blingId: string | null;
  description: string;
}
interface CostTypeRow {
  id: number;
  label: string;
}
interface FixedCostRow {
  id: number;
  name: string;
  description: string | null;
  value: string;
  application: "Item" | "Nota";
  valueType: "F" | "P";
  categoryId: number | null;
  category: string | null;
  channelIds: number[];
}
interface FixedCostCopyRow {
  id: number;
  name: string;
  description: string | null;
  value: string;
  application: "Item" | "Nota";
  valueType: "F" | "P";
  active: boolean;
  category: string | null;
}
interface FixedCostCopyChannelRow {
  storeId: string | null;
  description: string;
}
interface TaxRow {
  id: number;
  name: string;
  simulationRate: string;
}
interface DifalRow {
  id: number;
  state: string;
  internalRate: string;
}
interface NcmCreditRow {
  id: number;
  ncm: string;
  rate: string;
  reduction: string;
}

@Injectable()
export class BusinessService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async overview(principal: AuthPrincipal): Promise<BusinessOverviewResponse> {
    const unitId = this.unit(principal);
    const [
      boletos,
      tracking,
      sectors,
      vendors,
      channels,
      paymentMethods,
      productGroups,
      operationNatures,
      salesOrders,
      fixedCostTypes,
      fixedCosts,
      taxRules,
      difal,
      ncmCredits,
    ] = await Promise.all([
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
          CASE n.invoice_message_status
            WHEN 'sent' THEN 'Enviada'
            WHEN 'failed' THEN 'Falhou'
            WHEN 'skipped' THEN 'Ignorada'
            ELSE 'Pendente'
          END AS status
        FROM nfe n LEFT JOIN pessoa p ON p.id_bling = n.contato_id_bling AND p.unit_id = n.unit_id
        WHERE n.unit_id = ${unitId} AND (NULLIF(BTRIM(n.codigo_rastreio), '') IS NOT NULL OR NULLIF(BTRIM(n.codigo_rastreio2), '') IS NOT NULL)
        ORDER BY n.data_emissao DESC NULLS LAST, n.id DESC LIMIT 100
      `),
      this.database.$queryRaw<SectorRow[]>(Prisma.sql`
        SELECT s.id, COALESCE(NULLIF(BTRIM(s.nome), ''), 'Sem nome') AS name,
          s.active, COUNT(v.id)::int AS sellers
        FROM setor s
        LEFT JOIN vendedores v ON v.sector_id = s.id AND v.unit_id = s.unit_id
        WHERE s.unit_id = ${unitId}
        GROUP BY s.id
        ORDER BY s.active DESC, s.nome, s.id
      `),
      this.database.$queryRaw<VendorRow[]>(Prisma.sql`
        SELECT v.id, NULLIF(BTRIM(v.id_bling), '') AS "blingId", COALESCE(NULLIF(BTRIM(v.nome), ''), 'Sem nome') AS name,
          v.sector_id AS "sectorId", NULLIF(BTRIM(s.nome), '') AS sector
        FROM vendedores v LEFT JOIN setor s ON s.id = v.sector_id AND s.unit_id = v.unit_id
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
      this.database.$queryRaw<SalesOrderRow[]>(Prisma.sql`
        SELECT id, id_bling::text AS "blingId", numero AS number,
          TO_CHAR(data, 'YYYY-MM-DD') AS "issuedAt",
          ROUND(COALESCE(total, 0)::numeric, 2)::text AS total,
          situacao AS "statusCode", nfe_id_bling::text AS "invoiceBlingId"
        FROM pedido_venda
        WHERE unit_id = ${unitId}
        ORDER BY data DESC NULLS LAST, id DESC
        LIMIT 100
      `),
      this.database.$queryRaw<CostTypeRow[]>(
        Prisma.sql`SELECT id, COALESCE(NULLIF(BTRIM(tipo), ''), 'Sem categoria') AS label FROM tipo_custo_fixo WHERE unit_id=${unitId} ORDER BY tipo, id`,
      ),
      this.database.$queryRaw<FixedCostRow[]>(Prisma.sql`
        SELECT cf.id, COALESCE(NULLIF(BTRIM(cf.nome), ''), 'Sem nome') AS name, NULLIF(BTRIM(cf.descricao), '') AS description,
          ROUND(COALESCE(cf.valor, 0)::numeric, 2)::text AS value, cf.tipo AS application, cf.tipo_valor AS "valueType",
          cf.tipo_custo_fixo_id AS "categoryId", NULLIF(BTRIM(tcf.tipo), '') AS category,
          COALESCE(ARRAY_AGG(cfcv.canal_venda_id) FILTER (WHERE cfcv.canal_venda_id IS NOT NULL), ARRAY[]::integer[]) AS "channelIds"
        FROM custo_fixo cf LEFT JOIN tipo_custo_fixo tcf ON tcf.id = cf.tipo_custo_fixo_id
        LEFT JOIN cfcv ON cfcv.fixed_cost_id = cf.id AND cfcv.unit_id = cf.unit_id
        WHERE cf.unit_id = ${unitId} GROUP BY cf.id, tcf.tipo ORDER BY cf.nome, cf.id
      `),
      this.database.$queryRaw<TaxRow[]>(
        Prisma.sql`SELECT id, COALESCE(NULLIF(BTRIM(nome), ''), 'Sem nome') AS name, ROUND(COALESCE(aliquota_simulacao, 0)::numeric, 2)::text AS "simulationRate" FROM tributacao WHERE unit_id=${unitId} ORDER BY nome, id`,
      ),
      this.database.$queryRaw<DifalRow[]>(
        Prisma.sql`SELECT id, UPPER(estado) AS state, ROUND(COALESCE(aliquota_interna, 0)::numeric, 2)::text AS "internalRate" FROM tributacao_difal WHERE unit_id=${unitId} AND estado IS NOT NULL ORDER BY estado, id`,
      ),
      this.database.$queryRaw<NcmCreditRow[]>(Prisma.sql`
        SELECT id, LPAD(ncm::text, 8, '0') AS ncm,
          ROUND(COALESCE(aliquota, 0)::numeric, 2)::text AS rate,
          ROUND(COALESCE(reducao, 0)::numeric, 2)::text AS reduction
        FROM credito_ncm WHERE unit_id = ${unitId} ORDER BY ncm, id
      `),
    ]);
    return businessOverviewResponseSchema.parse({
      documents: {
        boletos: canAccess(principal, "documents:view") ? boletos : [],
        tracking: canAccess(principal, "documents:view")
          ? tracking.map((item) => ({
              ...item,
              sentAt: item.sentAt?.toISOString() ?? null,
            }))
          : [],
      },
      commercial: {
        sectors: canAccess(principal, "commercial:view") ? sectors : [],
        vendors: canAccess(principal, "commercial:view") ? vendors : [],
        channels: canAccess(principal, "commercial:view") ? channels : [],
        paymentMethods: canAccess(principal, "commercial:view")
          ? paymentMethods
          : [],
        productGroups: canAccess(principal, "commercial:view")
          ? productGroups
          : [],
        operationNatures: canAccess(principal, "commercial:view")
          ? operationNatures
          : [],
        salesOrders: canAccess(principal, "commercial:view") ? salesOrders : [],
      },
      fiscal: {
        fixedCostTypes: canAccess(principal, "costs:view")
          ? fixedCostTypes
          : [],
        fixedCosts: canAccess(principal, "costs:view") ? fixedCosts : [],
        taxRules: canAccess(principal, "tax:view") ? taxRules : [],
        difal: canAccess(principal, "tax:view") ? difal : [],
        ncmCredits: canAccess(principal, "tax:view") ? ncmCredits : [],
      },
    });
  }

  async saveSector(
    principal: AuthPrincipal,
    id: number | null,
    input: SectorInput,
  ): Promise<BusinessOverviewResponse> {
    const unitId = this.unit(principal);
    const sellerIds = [...new Set(input.sellerIds)];
    if (sellerIds.length) {
      const sellers = await this.database.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total FROM vendedores
        WHERE unit_id = ${unitId} AND id IN (${Prisma.join(sellerIds)})
      `);
      if (Number(sellers[0]?.total ?? 0n) !== sellerIds.length)
        throw new BadRequestException(
          "Um dos vendedores não pertence a esta empresa",
        );
    }
    const duplicate = await this.database.$queryRaw<IdRow[]>(Prisma.sql`
      SELECT id FROM setor
      WHERE unit_id = ${unitId}
        AND LOWER(BTRIM(nome)) = LOWER(${input.name})
        AND (${id}::integer IS NULL OR id <> ${id})
      LIMIT 1
    `);
    if (duplicate[0]) throw new BadRequestException("Setor já cadastrado");
    await this.database.$transaction(async (transaction) => {
      let sectorId = id;
      if (id) {
        const updated = await transaction.$executeRaw(Prisma.sql`
          UPDATE setor SET nome = ${input.name}, active = ${input.active}
          WHERE id = ${id} AND unit_id = ${unitId}
        `);
        if (updated === 0) throw new NotFoundException("Setor não encontrado");
      } else {
        const inserted = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO setor (unit_id, nome, active)
          VALUES (${unitId}, ${input.name}, ${input.active})
          RETURNING id
        `);
        sectorId = inserted[0]!.id;
      }
      await transaction.$executeRaw(Prisma.sql`
        UPDATE vendedores SET sector_id = NULL
        WHERE unit_id = ${unitId} AND sector_id = ${sectorId}
        ${sellerIds.length ? Prisma.sql`AND id NOT IN (${Prisma.join(sellerIds)})` : Prisma.empty}
      `);
      if (sellerIds.length)
        await transaction.$executeRaw(Prisma.sql`
          UPDATE vendedores SET sector_id = ${sectorId}
          WHERE unit_id = ${unitId} AND id IN (${Prisma.join(sellerIds)})
        `);
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: id ? "business.sector.updated" : "business.sector.created",
          entityType: "sector",
          entityId: String(sectorId),
          correlationId: randomUUID(),
          metadata: {
            name: input.name,
            active: input.active,
            sellers: sellerIds.length,
          },
        },
      });
    });
    return this.overview(principal);
  }

  async deleteSector(
    principal: AuthPrincipal,
    id: number,
  ): Promise<BusinessOverviewResponse> {
    const unitId = this.unit(principal);
    const references = await this.database.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT (
        (SELECT COUNT(*) FROM vendedores WHERE unit_id=${unitId} AND sector_id=${id}) +
        (SELECT COUNT(*) FROM meta_setor ms JOIN meta m ON m.id=ms.meta_id WHERE m.unit_id=${unitId} AND ms.setor_id=${id})
      )::bigint AS total
    `);
    if (Number(references[0]?.total ?? 0n) > 0)
      throw new BadRequestException(
        "Setor possui vendedores ou metas vinculadas; desative em vez de excluir",
      );
    const deleted = await this.database.$executeRaw(Prisma.sql`
      DELETE FROM setor WHERE id=${id} AND unit_id=${unitId}
    `);
    if (deleted === 0) throw new NotFoundException("Setor não encontrado");
    await this.database.auditLog.create({
      data: {
        tenantId: principal.activeTenantId,
        actorUserId: principal.userId,
        action: "business.sector.deleted",
        entityType: "sector",
        entityId: String(id),
        correlationId: randomUUID(),
        metadata: {},
      },
    });
    return this.overview(principal);
  }

  async saveFixedCost(
    principal: AuthPrincipal,
    id: number | null,
    input: FixedCostInput,
  ): Promise<BusinessOverviewResponse> {
    const unitId = this.unit(principal);
    const uniqueChannels = [...new Set(input.channelIds)];
    if (uniqueChannels.length) {
      const rows = await this.database.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS total FROM canal_venda WHERE unit_id = ${unitId} AND id IN (${Prisma.join(uniqueChannels)})`,
      );
      if (Number(rows[0]?.total ?? 0n) !== uniqueChannels.length)
        throw new BadRequestException(
          "Um dos canais não pertence a esta empresa",
        );
    }
    await this.database.$transaction(async (transaction) => {
      let costId = id;
      if (id) {
        const existing = await transaction.$queryRaw<IdRow[]>(
          Prisma.sql`SELECT id FROM custo_fixo WHERE id = ${id} AND unit_id = ${unitId}`,
        );
        if (!existing[0])
          throw new NotFoundException("Custo fixo não encontrado");
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
      await transaction.$executeRaw(
        Prisma.sql`DELETE FROM cfcv WHERE fixed_cost_id = ${costId} AND unit_id = ${unitId}`,
      );
      for (const channelId of uniqueChannels)
        await transaction.$executeRaw(
          Prisma.sql`INSERT INTO cfcv (fixed_cost_id, canal_venda_id, unit_id) VALUES (${costId}, ${channelId}, ${unitId})`,
        );
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: id
            ? "business.fixed_cost.updated"
            : "business.fixed_cost.created",
          entityType: "fixed_cost",
          entityId: String(costId),
          correlationId: randomUUID(),
          metadata: {
            application: input.application,
            valueType: input.valueType,
            channels: uniqueChannels.length,
          },
        },
      });
    });
    return this.overview(principal);
  }

  async duplicateFixedCost(
    principal: AuthPrincipal,
    id: number,
    rawTargetTenantIds: string[],
  ): Promise<FixedCostDuplicateResponse> {
    const sourceTenantId = this.unit(principal);
    const targetTenantIds = [
      ...new Set(
        rawTargetTenantIds.filter((tenantId) => tenantId !== sourceTenantId),
      ),
    ];
    if (targetTenantIds.length === 0)
      throw new BadRequestException("Selecione ao menos uma unidade de destino");

    const [sourceRows, sourceChannels, memberships] = await Promise.all([
      this.database.$queryRaw<FixedCostCopyRow[]>(Prisma.sql`
        SELECT cf.id, cf.nome AS name, cf.descricao AS description,
          cf.valor::text AS value, cf.tipo AS application,
          cf.tipo_valor AS "valueType", cf.active,
          NULLIF(BTRIM(tcf.tipo), '') AS category
        FROM custo_fixo cf
        LEFT JOIN tipo_custo_fixo tcf
          ON tcf.id = cf.tipo_custo_fixo_id AND tcf.unit_id = cf.unit_id
        WHERE cf.id = ${id} AND cf.unit_id = ${sourceTenantId}
        LIMIT 1
      `),
      this.database.$queryRaw<FixedCostCopyChannelRow[]>(Prisma.sql`
        SELECT NULLIF(BTRIM(cv.loja_id), '') AS "storeId",
          COALESCE(NULLIF(BTRIM(cv.descricao), ''), 'Canal sem descrição') AS description
        FROM cfcv link
        JOIN canal_venda cv
          ON cv.id = link.canal_venda_id AND cv.unit_id = link.unit_id
        WHERE link.fixed_cost_id = ${id} AND link.unit_id = ${sourceTenantId}
        ORDER BY cv.descricao, cv.id
      `),
      this.database.tenantMembership.findMany({
        where: {
          userId: principal.userId,
          active: true,
          tenantId: { in: targetTenantIds },
          tenant: { active: true, demo: false },
        },
        select: {
          tenantId: true,
          accessProfile: { select: { permissions: true } },
          tenant: { select: { id: true, name: true } },
        },
      }),
    ]);
    const source = sourceRows[0];
    if (!source) throw new NotFoundException("Custo fixo não encontrado");
    const allowedMemberships = memberships.filter(
      (membership) =>
        principal.superAdmin ||
        membership.accessProfile.permissions.includes("costs:manage"),
    );
    if (allowedMemberships.length !== targetTenantIds.length)
      throw new BadRequestException(
        "Uma das unidades selecionadas não está acessível ou não permite gerenciar custos",
      );

    const tenantNames = new Map(
      allowedMemberships.map((membership) => [
        membership.tenantId,
        membership.tenant.name,
      ]),
    );
    const results = await this.database.$transaction(async (transaction) => {
      const copied: FixedCostDuplicateResponse["results"] = [];
      for (const targetTenantId of targetTenantIds) {
        let categoryId: number | null = null;
        if (source.category) {
          categoryId = (
            await transaction.$queryRaw<IdRow[]>(Prisma.sql`
              SELECT id FROM tipo_custo_fixo
              WHERE unit_id = ${targetTenantId}
                AND LOWER(BTRIM(tipo)) = LOWER(BTRIM(${source.category}))
              ORDER BY id LIMIT 1
            `)
          )[0]?.id ?? null;
          if (!categoryId) {
            categoryId = (
              await transaction.$queryRaw<IdRow[]>(Prisma.sql`
                INSERT INTO tipo_custo_fixo (unit_id, tipo)
                VALUES (${targetTenantId}, ${source.category})
                RETURNING id
              `)
            )[0]?.id ?? null;
          }
        }

        const existingId = (
          await transaction.$queryRaw<IdRow[]>(Prisma.sql`
            SELECT id FROM custo_fixo
            WHERE unit_id = ${targetTenantId}
              AND LOWER(BTRIM(nome)) = LOWER(BTRIM(${source.name}))
            ORDER BY id LIMIT 1
          `)
        )[0]?.id;
        let targetCostId: number;
        const status = existingId ? "updated" : "created";
        if (existingId) {
          targetCostId = existingId;
          await transaction.$executeRaw(Prisma.sql`
            UPDATE custo_fixo SET nome = ${source.name},
              descricao = ${source.description}, valor = ${source.value}::numeric,
              tipo = ${source.application}::"CostApplication",
              tipo_valor = ${source.valueType}::"CostValueType",
              tipo_custo_fixo_id = ${categoryId}, active = ${source.active}
            WHERE id = ${targetCostId} AND unit_id = ${targetTenantId}
          `);
          await transaction.$executeRaw(Prisma.sql`
            DELETE FROM cfcv
            WHERE fixed_cost_id = ${targetCostId} AND unit_id = ${targetTenantId}
          `);
        } else {
          targetCostId = (
            await transaction.$queryRaw<IdRow[]>(Prisma.sql`
              INSERT INTO custo_fixo (
                unit_id, nome, descricao, valor, tipo, tipo_valor,
                tipo_custo_fixo_id, active
              ) VALUES (
                ${targetTenantId}, ${source.name}, ${source.description},
                ${source.value}::numeric,
                ${source.application}::"CostApplication",
                ${source.valueType}::"CostValueType",
                ${categoryId}, ${source.active}
              ) RETURNING id
            `)
          )[0]!.id;
        }

        const missingChannels: string[] = [];
        let matchedChannels = 0;
        for (const sourceChannel of sourceChannels) {
          const channelId = (
            await transaction.$queryRaw<IdRow[]>(Prisma.sql`
              SELECT id FROM canal_venda
              WHERE unit_id = ${targetTenantId}
                AND (
                  (${sourceChannel.storeId}::text IS NOT NULL AND loja_id::text = ${sourceChannel.storeId})
                  OR LOWER(BTRIM(descricao)) = LOWER(BTRIM(${sourceChannel.description}))
                )
              ORDER BY
                CASE WHEN ${sourceChannel.storeId}::text IS NOT NULL
                  AND loja_id::text = ${sourceChannel.storeId} THEN 0 ELSE 1 END,
                id
              LIMIT 1
            `)
          )[0]?.id;
          if (!channelId) {
            missingChannels.push(sourceChannel.description);
            continue;
          }
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO cfcv (fixed_cost_id, canal_venda_id, unit_id)
            VALUES (${targetCostId}, ${channelId}, ${targetTenantId})
            ON CONFLICT DO NOTHING
          `);
          matchedChannels += 1;
        }
        await transaction.auditLog.create({
          data: {
            tenantId: targetTenantId,
            actorUserId: principal.userId,
            action: "business.fixed_cost.duplicated",
            entityType: "fixed_cost",
            entityId: String(targetCostId),
            correlationId: randomUUID(),
            metadata: {
              sourceTenantId,
              sourceCostId: id,
              status,
              matchedChannels,
              missingChannels,
            },
          },
        });
        copied.push({
          tenantId: targetTenantId,
          tenantName: tenantNames.get(targetTenantId) ?? "Unidade",
          status,
          matchedChannels,
          missingChannels,
        });
      }
      return copied;
    });
    return fixedCostDuplicateResponseSchema.parse({
      sourceCostId: id,
      results,
    });
  }

  async saveNcmCredit(
    principal: AuthPrincipal,
    id: number | null,
    input: NcmCreditInput,
  ): Promise<BusinessOverviewResponse> {
    const unitId = this.unit(principal);
    const duplicate = await this.database.$queryRaw<IdRow[]>(Prisma.sql`
      SELECT id FROM credito_ncm
      WHERE unit_id = ${unitId} AND ncm = ${input.ncm}
        AND (${id}::integer IS NULL OR id <> ${id})
      LIMIT 1
    `);
    if (duplicate[0])
      throw new BadRequestException(
        "Já existe crédito configurado para este NCM",
      );
    let creditId = id;
    if (id) {
      const updated = await this.database.$executeRaw(Prisma.sql`
        UPDATE credito_ncm SET ncm = ${input.ncm},
          aliquota = ${input.rate}::numeric, reducao = ${input.reduction}::numeric
        WHERE id = ${id} AND unit_id = ${unitId}
      `);
      if (updated === 0)
        throw new NotFoundException("Crédito de NCM não encontrado");
    } else {
      creditId =
        (
          await this.database.$queryRaw<IdRow[]>(Prisma.sql`
        INSERT INTO credito_ncm (ncm, aliquota, reducao, unit_id)
        VALUES (${input.ncm}, ${input.rate}::numeric, ${input.reduction}::numeric, ${unitId})
        RETURNING id
      `)
        )[0]?.id ?? null;
    }
    await this.database.auditLog.create({
      data: {
        tenantId: principal.activeTenantId,
        actorUserId: principal.userId,
        action: id
          ? "business.ncm_credit.updated"
          : "business.ncm_credit.created",
        entityType: "ncm_credit",
        entityId: String(creditId),
        correlationId: randomUUID(),
        metadata: {
          ncm: input.ncm,
          rate: input.rate,
          reduction: input.reduction,
        },
      },
    });
    return this.overview(principal);
  }

  async deleteFixedCost(
    principal: AuthPrincipal,
    id: number,
  ): Promise<BusinessOverviewResponse> {
    const unitId = this.unit(principal);
    await this.database.$transaction(async (transaction) => {
      const existing = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
        SELECT id FROM custo_fixo
        WHERE id = ${id} AND unit_id = ${unitId}
        FOR UPDATE
      `);
      if (!existing[0])
        throw new NotFoundException("Custo fixo não encontrado");
      const usage = await transaction.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT (
          (SELECT COUNT(*) FROM custo_item WHERE custo_fixo_id = ${id} AND unit_id = ${unitId}) +
          (SELECT COUNT(*) FROM taxa_item WHERE custo_fixo_id = ${id} AND unit_id = ${unitId}) +
          (SELECT COUNT(*) FROM credito_item WHERE custo_fixo_id = ${id} AND unit_id = ${unitId})
        )::bigint AS total
      `);
      if (Number(usage[0]?.total ?? 0n) > 0)
        throw new BadRequestException(
          "Este custo já compõe cálculos históricos e não pode ser excluído",
        );
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM cfcv WHERE fixed_cost_id = ${id} AND unit_id = ${unitId}
      `);
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM custo_fixo WHERE id = ${id} AND unit_id = ${unitId}
      `);
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "business.fixed_cost.deleted",
          entityType: "fixed_cost",
          entityId: String(id),
          correlationId: randomUUID(),
          metadata: {},
        },
      });
    });
    return this.overview(principal);
  }

  async deleteNcmCredit(
    principal: AuthPrincipal,
    id: number,
  ): Promise<BusinessOverviewResponse> {
    const unitId = this.unit(principal);
    await this.database.$transaction(async (transaction) => {
      const deleted = await transaction.$executeRaw(Prisma.sql`
        DELETE FROM credito_ncm WHERE id = ${id} AND unit_id = ${unitId}
      `);
      if (deleted === 0)
        throw new NotFoundException("Crédito de NCM não encontrado");
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "business.ncm_credit.deleted",
          entityType: "ncm_credit",
          entityId: String(id),
          correlationId: randomUUID(),
          metadata: {},
        },
      });
    });
    return this.overview(principal);
  }

  private unit(principal: AuthPrincipal): string {
    if (principal.tenantDemo)
      throw new BadRequestException(
        "Recurso indisponível na demonstração pública",
      );
    return principal.activeTenantId;
  }
}
