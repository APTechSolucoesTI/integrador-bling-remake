import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Queue } from "bullmq";
import {
  goalListResponseSchema,
  globalSearchResultSchema,
  goalDetailResponseSchema,
  goalResourcesResponseSchema,
  integrationJobSchema,
  invoiceFilterOptionsResponseSchema,
  operationsOverviewSchema,
  oauthAuthorizationResponseSchema,
  peopleListResponseSchema,
  productListResponseSchema,
  profitabilityResponseSchema,
  queuedJobResponseSchema,
  type GoalListQuery,
  type GlobalSearchResult,
  type InvoiceFilterOptionsResponse,
  type GoalListResponse,
  type GoalDetailResponse,
  type GoalCreateInput,
  type GoalResourcesResponse,
  type OperationsJobRequest,
  type OperationsOverview,
  type OperationsSettingsUpdate,
  type NfeSyncPolicy,
  type OauthAuthorizationResponse,
  type PeopleListQuery,
  type PeopleListResponse,
  type ProductListQuery,
  type ProductListResponse,
  type ProfitabilityQuery,
  type ProfitabilityResponse,
  type QueuedJobResponse,
} from "@integrador/contracts";
import {
  decryptSecret,
  encryptSecret,
  Prisma,
  type DatabaseClient,
} from "@integrador/db";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";
import { INTEGRATION_QUEUE_CLIENT } from "../queue/queue.constants.js";

interface CountRow {
  total: bigint;
}

interface GlobalInvoiceSearchRow {
  id: number;
  numero: string;
  customer: string;
  issuedAt: string | null;
}
interface GlobalPersonSearchRow {
  id: number;
  name: string;
  document: string | null;
  email: string | null;
}
interface GlobalProductSearchRow {
  id: number;
  name: string;
  code: string | null;
  ncm: string | null;
}

interface InvoiceFilterOptionRow {
  value: string;
}

interface ProductRow {
  id: number;
  blingId: string | null;
  nome: string;
  codigo: string | null;
  descricao: string | null;
  ncm: string | null;
  custo: string | null;
  situacao: string | null;
  fabricacaoPropria: boolean | null;
  atualizadoEm: Date | null;
}

interface PersonRow {
  id: number;
  blingId: string;
  nome: string;
  documento: string | null;
  inscricaoEstadual: string | null;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  envioDesabilitado: boolean;
  addressId: number | null;
  logradouro: string | null;
  addressNumber: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
}

interface GoalRow {
  id: number;
  competencia: string | null;
  dataInicial: string | null;
  dataFinal: string | null;
  statusId: number;
  status: string;
  valorMetaVendedores: string;
  valorMetaSetores: string;
  custoPlanejado: string;
  vendedores: bigint;
  setores: bigint;
  custos: bigint;
}

interface GoalStatusRow {
  statusId: number;
  label: string;
  total: bigint;
}

interface GoalResourceRow {
  id: number;
  name: string;
  sector: string | null;
}
interface SectorResourceRow {
  id: number;
  name: string;
}
interface CompetenceResourceRow {
  value: string;
}

interface LegacyTokenRow {
  configured: boolean;
  status: string | null;
  updatedAt: Date | null;
}

interface IdRow {
  id: number;
}
interface GoalLifecycleRow {
  id: number;
  statusId: number;
  nextStart: string | null;
  nextEnd: string | null;
  nextCompetence: string | null;
}
interface GoalStatusOnlyRow {
  id: number;
  statusId: number;
}
interface GoalDetailRow {
  id: number;
  statusId: number;
  competencia: string | null;
  dataInicial: string | null;
  dataFinal: string | null;
}
interface GoalTargetDetailRow {
  id: number;
  value: string;
  commissionType: "P" | "R" | null;
  commission: string;
}
interface GoalCostDetailRow {
  description: string;
  value: string;
}

interface ProfitabilityRow {
  id: number;
  numero: string;
  tipoVenda: string;
  dataEmissao: string | null;
  nome: string;
  valor: string;
  vendaLiquida: string;
  desconto: string;
  frete: string;
  outrasDespesas: string;
  custoLiquido: string;
  impostos: string;
  taxa: string;
  lucro: string;
  margemLucro: string;
  calculo: string | null;
  observacao: string | null;
}

interface ProfitabilitySummaryRow {
  vendaBruta: string;
  vendaLiquida: string;
  custoLiquido: string;
  impostos: string;
  lucro: string;
  margemSobreVendaLiquida: string;
  notas: bigint;
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
    @Inject(INTEGRATION_QUEUE_CLIENT) private readonly queue: Queue,
  ) {}

  async products(
    principal: AuthPrincipal,
    query: ProductListQuery,
  ): Promise<ProductListResponse> {
    const unitId = this.unit(principal);
    const filters: Prisma.Sql[] = [Prisma.sql`unit_id = ${unitId}`];
    if (query.search) {
      const search = `%${query.search}%`;
      filters.push(
        Prisma.sql`(nome ILIKE ${search} OR codigo ILIKE ${search} OR id_produto ILIKE ${search})`,
      );
    }
    if (query.idProduto)
      filters.push(Prisma.sql`id_produto ILIKE ${`%${query.idProduto}%`}`);
    if (query.nome) filters.push(Prisma.sql`nome ILIKE ${`%${query.nome}%`}`);
    if (query.codigo)
      filters.push(Prisma.sql`codigo ILIKE ${`%${query.codigo}%`}`);
    if (query.fabricacaoPropria)
      filters.push(
        Prisma.sql`fabricacao_propria = ${query.fabricacaoPropria === "S"}`,
      );
    const where = Prisma.join(filters, " AND ");
    const order = this.productOrder(query);
    const offset = (query.page - 1) * query.pageSize;

    const [items, totals] = await Promise.all([
      this.database.$queryRaw<ProductRow[]>(Prisma.sql`
        SELECT
          id,
          id_produto AS "blingId",
          COALESCE(nome, 'Produto sem nome') AS nome,
          NULLIF(BTRIM(codigo), '') AS codigo,
          NULLIF(BTRIM(descricao), '') AS descricao,
          NULLIF(BTRIM(ncm), '') AS ncm,
          CASE WHEN custo IS NULL THEN NULL
            ELSE ROUND(custo::numeric, 2)::text END AS custo,
          CASE WHEN active THEN 'A' ELSE 'I' END AS situacao,
          fabricacao_propria AS "fabricacaoPropria",
          ultima_atualizacao_bling AS "atualizadoEm"
        FROM produtos
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ${query.pageSize}
        OFFSET ${offset}
      `),
      this.database.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total FROM produtos WHERE ${where}
      `),
    ]);
    const total = Number(totals[0]?.total ?? 0n);
    return productListResponseSchema.parse({
      items: items.map((item) => ({
        ...item,
        atualizadoEm: item.atualizadoEm?.toISOString() ?? null,
      })),
      pagination: this.pagination(query.page, query.pageSize, total),
    });
  }

  async people(
    principal: AuthPrincipal,
    query: PeopleListQuery,
  ): Promise<PeopleListResponse> {
    const unitId = this.unit(principal);
    const filters: Prisma.Sql[] = [Prisma.sql`p.unit_id = ${unitId}`];
    if (query.search) {
      const search = `%${query.search}%`;
      filters.push(
        Prisma.sql`(p.nome ILIKE ${search} OR p.numero_documento ILIKE ${search} OR p.email ILIKE ${search} OR p.id_bling ILIKE ${search})`,
      );
    }
    if (query.envioDesabilitado)
      filters.push(
        Prisma.sql`p.desabilitar_envio = ${query.envioDesabilitado === "S"}`,
      );
    const where = Prisma.join(filters, " AND ");
    const order = this.peopleOrder(query);
    const offset = (query.page - 1) * query.pageSize;

    const [items, totals] = await Promise.all([
      this.database.$queryRaw<PersonRow[]>(Prisma.sql`
        SELECT
          p.id,
          p.id_bling AS "blingId",
          p.nome,
          NULLIF(BTRIM(p.numero_documento), '') AS documento,
          NULLIF(BTRIM(p.ie), '') AS "inscricaoEstadual",
          COALESCE(NULLIF(BTRIM(p.telefone_contato), ''), NULLIF(BTRIM(p.telefone), '')) AS telefone,
          NULLIF(BTRIM(p.celular), '') AS celular,
          NULLIF(BTRIM(p.email), '') AS email,
          p.desabilitar_envio AS "envioDesabilitado",
          address.id AS "addressId",
          address.endereco AS logradouro,
          address.numero AS "addressNumber",
          address.bairro,
          address.cep,
          address.municipio,
          address.uf
        FROM pessoa p
        LEFT JOIN LATERAL (
          SELECT pe.id, pe.endereco, pe.numero, pe.bairro, pe.cep, pe.municipio, pe.uf
          FROM pessoa_endereco pe
          WHERE pe.pessoa_id = p.id AND pe.unit_id = p.unit_id
          ORDER BY pe.id
          LIMIT 1
        ) address ON TRUE
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ${query.pageSize}
        OFFSET ${offset}
      `),
      this.database.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total FROM pessoa p WHERE ${where}
      `),
    ]);
    const total = Number(totals[0]?.total ?? 0n);
    return peopleListResponseSchema.parse({
      items: items.map((person) => ({
        id: person.id,
        blingId: person.blingId,
        nome: person.nome,
        documento: person.documento,
        inscricaoEstadual: person.inscricaoEstadual,
        telefone: person.telefone,
        celular: person.celular,
        email: person.email,
        envioDesabilitado: person.envioDesabilitado,
        endereco:
          person.addressId === null
            ? null
            : {
                logradouro: person.logradouro,
                numero: person.addressNumber,
                bairro: person.bairro,
                cep: person.cep,
                municipio: person.municipio,
                uf: person.uf,
              },
      })),
      pagination: this.pagination(query.page, query.pageSize, total),
    });
  }

  async updatePeopleMessaging(
    principal: AuthPrincipal,
    id: number,
    disabled: boolean,
  ): Promise<void> {
    const unitId = this.unit(principal);
    const updated = await this.database.$executeRaw(Prisma.sql`
      UPDATE pessoa SET desabilitar_envio=${disabled} WHERE id=${id} AND unit_id=${unitId}
    `);
    if (updated === 0)
      throw new BadRequestException("Pessoa não encontrada para esta empresa");
    await this.database.auditLog.create({
      data: {
        tenantId: principal.activeTenantId,
        actorUserId: principal.userId,
        action: "people.messaging.updated",
        entityType: "person",
        entityId: String(id),
        correlationId: randomUUID(),
        metadata: { disabled },
      },
    });
  }

  async goals(
    principal: AuthPrincipal,
    query: GoalListQuery,
  ): Promise<GoalListResponse> {
    const unitId = this.unit(principal);
    const filters: Prisma.Sql[] = [Prisma.sql`m.unit_id = ${unitId}`];
    if (query.competencia)
      filters.push(Prisma.sql`m.mes_ano ILIKE ${`%${query.competencia}%`}`);
    if (query.dataInicial)
      filters.push(
        Prisma.sql`m.data_inicial::date = ${query.dataInicial}::date`,
      );
    if (query.dataFinal)
      filters.push(Prisma.sql`m.data_final::date = ${query.dataFinal}::date`);
    if (query.statusId !== undefined)
      filters.push(
        Prisma.sql`m.status = ${goalStatusName(query.statusId)}::"GoalStatus"`,
      );
    const where = Prisma.join(filters, " AND ");
    const offset = (query.page - 1) * query.pageSize;

    const [items, totals, statusRows] = await Promise.all([
      this.database.$queryRaw<GoalRow[]>(Prisma.sql`
        SELECT
          m.id,
          m.mes_ano AS competencia,
          TO_CHAR(m.data_inicial, 'YYYY-MM-DD') AS "dataInicial",
          TO_CHAR(m.data_final, 'YYYY-MM-DD') AS "dataFinal",
          CASE m.status WHEN 'open' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END AS "statusId",
          CASE m.status WHEN 'open' THEN 'Aberta' WHEN 'completed' THEN 'Concluída' ELSE 'Cancelada' END AS status,
          ROUND(COALESCE(v.valor, 0)::numeric, 2)::text AS "valorMetaVendedores",
          ROUND(COALESCE(s.valor, 0)::numeric, 2)::text AS "valorMetaSetores",
          ROUND(COALESCE(c.valor, 0)::numeric, 2)::text AS "custoPlanejado",
          COALESCE(v.quantidade, 0)::bigint AS vendedores,
          COALESCE(s.quantidade, 0)::bigint AS setores,
          COALESCE(c.quantidade, 0)::bigint AS custos
        FROM meta m
        LEFT JOIN LATERAL (
          SELECT SUM(mv.valor_meta) AS valor, COUNT(*) AS quantidade
          FROM meta_vendedores mv WHERE mv.meta_id = m.id
        ) v ON TRUE
        LEFT JOIN LATERAL (
          SELECT SUM(mset.valor_meta) AS valor, COUNT(*) AS quantidade
          FROM meta_setor mset WHERE mset.meta_id = m.id
        ) s ON TRUE
        LEFT JOIN LATERAL (
          SELECT SUM(mc.valor_custo) AS valor, COUNT(*) AS quantidade
          FROM meta_custo mc WHERE mc.meta_id = m.id
        ) c ON TRUE
        WHERE ${where}
        ORDER BY m.id DESC
        LIMIT ${query.pageSize}
        OFFSET ${offset}
      `),
      this.database.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total FROM meta m WHERE ${where}
      `),
      this.database.$queryRaw<GoalStatusRow[]>(Prisma.sql`
        SELECT CASE m.status WHEN 'open' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END AS "statusId",
          CASE m.status WHEN 'open' THEN 'Aberta' WHEN 'completed' THEN 'Concluída' ELSE 'Cancelada' END AS label,
          COUNT(*)::bigint AS total
        FROM meta m
        WHERE m.unit_id = ${unitId}
        GROUP BY m.status
        ORDER BY "statusId"
      `),
    ]);
    const total = Number(totals[0]?.total ?? 0n);
    return goalListResponseSchema.parse({
      items: items.map((goal) => ({
        ...goal,
        vendedores: Number(goal.vendedores),
        setores: Number(goal.setores),
        custos: Number(goal.custos),
      })),
      statusCounts: statusRows.map((status) => ({
        statusId: status.statusId,
        label: status.label,
        count: Number(status.total),
      })),
      pagination: this.pagination(query.page, query.pageSize, total),
    });
  }

  async goalResources(
    principal: AuthPrincipal,
  ): Promise<GoalResourcesResponse> {
    const unitId = this.unit(principal);
    const [vendors, sectors, competences] = await Promise.all([
      this.database.$queryRaw<GoalResourceRow[]>(Prisma.sql`
        SELECT v.id, COALESCE(NULLIF(BTRIM(v.nome), ''), 'Sem nome') AS name, NULLIF(BTRIM(s.nome), '') AS sector
        FROM vendedores v LEFT JOIN setor s ON s.id=v.sector_id WHERE v.unit_id=${unitId} ORDER BY v.nome, v.id
      `),
      this.database.$queryRaw<SectorResourceRow[]>(Prisma.sql`
        SELECT id, COALESCE(NULLIF(BTRIM(nome), ''), 'Sem nome') AS name FROM setor WHERE unit_id=${unitId} ORDER BY nome, id
      `),
      this.database.$queryRaw<CompetenceResourceRow[]>(Prisma.sql`
        SELECT DISTINCT BTRIM(mes_ano) AS value
        FROM meta
        WHERE unit_id = ${unitId} AND NULLIF(BTRIM(mes_ano), '') IS NOT NULL
        ORDER BY value DESC
        LIMIT 120
      `),
    ]);
    return goalResourcesResponseSchema.parse({
      vendors,
      sectors,
      competences: competences.map((item) => item.value),
    });
  }

  async goalDetail(
    principal: AuthPrincipal,
    goalId: number,
  ): Promise<GoalDetailResponse> {
    const unitId = this.unit(principal);
    const goals = await this.database.$queryRaw<GoalDetailRow[]>(Prisma.sql`
      SELECT id,
             CASE status WHEN 'open' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END AS "statusId",
             COALESCE(mes_ano, '') AS competencia,
             TO_CHAR(data_inicial, 'YYYY-MM-DD') AS "dataInicial",
             TO_CHAR(data_final, 'YYYY-MM-DD') AS "dataFinal"
      FROM meta
      WHERE id = ${goalId} AND unit_id = ${unitId}
      LIMIT 1
    `);
    const goal = goals[0];
    if (!goal) throw new BadRequestException("Meta não encontrada");
    if (!goal.competencia || !goal.dataInicial || !goal.dataFinal)
      throw new BadRequestException(
        "Meta sem competência ou período válido para edição",
      );
    const [vendors, sectors, costs] = await Promise.all([
      this.database.$queryRaw<GoalTargetDetailRow[]>(Prisma.sql`
        SELECT vendedores_id AS id,
               ROUND(COALESCE(valor_meta, 0)::numeric, 2)::text AS value,
               tipo_comissao AS "commissionType",
               ROUND(COALESCE(comissao, 0)::numeric, 2)::text AS commission
        FROM meta_vendedores WHERE meta_id = ${goalId} ORDER BY id
      `),
      this.database.$queryRaw<GoalTargetDetailRow[]>(Prisma.sql`
        SELECT setor_id AS id,
               ROUND(COALESCE(valor_meta, 0)::numeric, 2)::text AS value,
               tipo_comissao AS "commissionType",
               ROUND(COALESCE(comissao, 0)::numeric, 2)::text AS commission
        FROM meta_setor WHERE meta_id = ${goalId} ORDER BY id
      `),
      this.database.$queryRaw<GoalCostDetailRow[]>(Prisma.sql`
        SELECT COALESCE(description, 'Custo') AS description,
               ROUND(COALESCE(valor_custo, 0)::numeric, 2)::text AS value
        FROM meta_custo WHERE meta_id = ${goalId} ORDER BY id
      `),
    ]);
    return goalDetailResponseSchema.parse({
      ...goal,
      vendors,
      sectors,
      costs,
    });
  }

  async createGoal(
    principal: AuthPrincipal,
    input: GoalCreateInput,
  ): Promise<GoalListResponse> {
    const unitId = this.unit(principal);
    const vendorIds = input.vendors.map((item) => item.id);
    if (vendorIds.length) {
      const rows = await this.database.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS total FROM vendedores WHERE unit_id=${unitId} AND id IN (${Prisma.join(vendorIds)})`,
      );
      if (Number(rows[0]?.total ?? 0n) !== vendorIds.length)
        throw new BadRequestException(
          "Um dos vendedores não pertence à empresa",
        );
    }
    const sectorIds = input.sectors.map((item) => item.id);
    if (sectorIds.length) {
      const rows = await this.database.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS total FROM setor WHERE unit_id=${unitId} AND id IN (${Prisma.join(sectorIds)})`,
      );
      if (Number(rows[0]?.total ?? 0n) !== sectorIds.length)
        throw new BadRequestException("Um dos setores não existe");
    }
    await this.database.$transaction(async (transaction) => {
      const duplicates = await transaction.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS total FROM meta WHERE unit_id=${unitId} AND status='open' AND mes_ano=${input.competencia}`,
      );
      if (Number(duplicates[0]?.total ?? 0n) > 0)
        throw new BadRequestException(
          "Já existe uma meta aberta para esta competência",
        );
      const inserted = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
        INSERT INTO meta (unit_id,status,data_inicial,data_final,mes_ano)
        VALUES (${unitId},'open',${input.dataInicial}::date,${input.dataFinal}::date,${input.competencia}) RETURNING id
      `);
      const goalId = inserted[0]!.id;
      for (const vendor of input.vendors)
        await transaction.$executeRaw(Prisma.sql`
        INSERT INTO meta_vendedores (meta_id,vendedores_id,valor_meta,tipo_comissao,comissao)
        VALUES (${goalId},${vendor.id},${vendor.value}::numeric,${vendor.commissionType},${vendor.commission}::numeric)
      `);
      for (const sector of input.sectors)
        await transaction.$executeRaw(Prisma.sql`
        INSERT INTO meta_setor (meta_id,setor_id,valor_meta,tipo_comissao,comissao)
        VALUES (${goalId},${sector.id},${sector.value}::numeric,${sector.commissionType},${sector.commission}::numeric)
      `);
      for (const cost of input.costs)
        await transaction.$executeRaw(Prisma.sql`
        INSERT INTO meta_custo (meta_id,description,valor_custo) VALUES (${goalId},${cost.description},${cost.value}::numeric)
      `);
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "goals.created",
          entityType: "goal",
          entityId: String(goalId),
          correlationId: randomUUID(),
          metadata: {
            competencia: input.competencia,
            vendors: input.vendors.length,
            sectors: input.sectors.length,
            costs: input.costs.length,
          },
        },
      });
    });
    return this.goals(principal, { page: 1, pageSize: 20 });
  }

  async updateGoal(
    principal: AuthPrincipal,
    goalId: number,
    input: GoalCreateInput,
  ): Promise<GoalListResponse> {
    const unitId = this.unit(principal);
    const vendorIds = input.vendors.map((item) => item.id);
    if (vendorIds.length) {
      const rows = await this.database.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS total FROM vendedores WHERE unit_id=${unitId} AND id IN (${Prisma.join(vendorIds)})`,
      );
      if (Number(rows[0]?.total ?? 0n) !== vendorIds.length)
        throw new BadRequestException(
          "Um dos vendedores não pertence à empresa",
        );
    }
    const sectorIds = input.sectors.map((item) => item.id);
    if (sectorIds.length) {
      const rows = await this.database.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS total FROM setor WHERE unit_id=${unitId} AND id IN (${Prisma.join(sectorIds)})`,
      );
      if (Number(rows[0]?.total ?? 0n) !== sectorIds.length)
        throw new BadRequestException("Um dos setores não existe");
    }
    await this.database.$transaction(async (transaction) => {
      const goals = await transaction.$queryRaw<GoalStatusOnlyRow[]>(Prisma.sql`
        SELECT id, CASE status WHEN 'open' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END AS "statusId" FROM meta
        WHERE id = ${goalId} AND unit_id = ${unitId}
        FOR UPDATE
      `);
      if (!goals[0]) throw new BadRequestException("Meta não encontrada");
      if (goals[0].statusId !== 1)
        throw new BadRequestException(
          "Somente metas abertas podem ser editadas",
        );
      const duplicates = await transaction.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total FROM meta
        WHERE unit_id = ${unitId}
          AND status = 'open'
          AND mes_ano = ${input.competencia}
          AND id <> ${goalId}
      `);
      if (Number(duplicates[0]?.total ?? 0n) > 0)
        throw new BadRequestException(
          "Já existe outra meta aberta para esta competência",
        );
      await transaction.$executeRaw(Prisma.sql`
        UPDATE meta
        SET mes_ano = ${input.competencia},
            data_inicial = ${input.dataInicial}::date,
            data_final = ${input.dataFinal}::date
        WHERE id = ${goalId} AND unit_id = ${unitId}
      `);
      await transaction.$executeRaw(
        Prisma.sql`DELETE FROM meta_vendedores WHERE meta_id = ${goalId}`,
      );
      await transaction.$executeRaw(
        Prisma.sql`DELETE FROM meta_setor WHERE meta_id = ${goalId}`,
      );
      await transaction.$executeRaw(
        Prisma.sql`DELETE FROM meta_custo WHERE meta_id = ${goalId}`,
      );
      for (const vendor of input.vendors)
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO meta_vendedores (meta_id,vendedores_id,valor_meta,tipo_comissao,comissao)
          VALUES (${goalId},${vendor.id},${vendor.value}::numeric,${vendor.commissionType},${vendor.commission}::numeric)
        `);
      for (const sector of input.sectors)
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO meta_setor (meta_id,setor_id,valor_meta,tipo_comissao,comissao)
          VALUES (${goalId},${sector.id},${sector.value}::numeric,${sector.commissionType},${sector.commission}::numeric)
        `);
      for (const cost of input.costs)
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO meta_custo (meta_id,description,valor_custo)
          VALUES (${goalId},${cost.description},${cost.value}::numeric)
        `);
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "goals.updated",
          entityType: "goal",
          entityId: String(goalId),
          correlationId: randomUUID(),
          metadata: {
            competencia: input.competencia,
            vendors: input.vendors.length,
            sectors: input.sectors.length,
            costs: input.costs.length,
          },
        },
      });
    });
    return this.goals(principal, { page: 1, pageSize: 20 });
  }

  async finalizeGoal(
    principal: AuthPrincipal,
    goalId: number,
  ): Promise<GoalListResponse> {
    const unitId = this.unit(principal);
    await this.database.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<GoalLifecycleRow[]>(Prisma.sql`
        SELECT
          id,
          CASE status WHEN 'open' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END AS "statusId",
          TO_CHAR(
            (DATE_TRUNC('month', COALESCE(data_inicial, data_final)) + INTERVAL '1 month')::date,
            'YYYY-MM-DD'
          ) AS "nextStart",
          TO_CHAR(
            (DATE_TRUNC('month', COALESCE(data_inicial, data_final)) + INTERVAL '2 months - 1 day')::date,
            'YYYY-MM-DD'
          ) AS "nextEnd",
          TO_CHAR(
            DATE_TRUNC('month', COALESCE(data_inicial, data_final)) + INTERVAL '1 month',
            'MM/YYYY'
          ) AS "nextCompetence"
        FROM meta
        WHERE id = ${goalId} AND unit_id = ${unitId}
        FOR UPDATE
      `);
      const goal = rows[0];
      if (!goal)
        throw new BadRequestException("Meta não encontrada para esta empresa");
      if (goal.statusId === 2) return;
      if (goal.statusId !== 1)
        throw new BadRequestException(
          "Somente uma meta aberta pode ser finalizada",
        );

      const expiration = await transaction.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM meta
        WHERE id = ${goalId}
          AND data_final IS NOT NULL
          AND CURRENT_DATE > data_final::date
      `);
      if (Number(expiration[0]?.total ?? 0n) === 0)
        throw new BadRequestException(
          "A meta só pode ser finalizada depois da data final",
        );
      if (!goal.nextStart || !goal.nextEnd || !goal.nextCompetence)
        throw new BadRequestException(
          "Não foi possível determinar o próximo período da meta",
        );

      const existing = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
        SELECT id
        FROM meta
        WHERE unit_id = ${unitId}
          AND mes_ano = ${goal.nextCompetence}
        ORDER BY id
        LIMIT 1
      `);

      await transaction.$executeRaw(Prisma.sql`
        UPDATE meta SET status = 'completed', completed_at = NOW()
        WHERE id = ${goalId} AND unit_id = ${unitId}
      `);

      let nextGoalId = existing[0]?.id ?? null;
      if (nextGoalId === null) {
        const inserted = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO meta (
            unit_id,
            status,
            data_inicial,
            data_final,
            mes_ano
          ) VALUES (
            ${unitId},
            'open',
            ${goal.nextStart}::date,
            ${goal.nextEnd}::date,
            ${goal.nextCompetence}
          )
          RETURNING id
        `);
        nextGoalId = inserted[0]!.id;
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO meta_custo (meta_id, description, valor_custo)
          SELECT ${nextGoalId}, description, valor_custo
          FROM meta_custo
          WHERE meta_id = ${goalId}
        `);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO meta_vendedores (
            meta_id,
            vendedores_id,
            valor_meta,
            tipo_comissao,
            comissao
          )
          SELECT
            ${nextGoalId},
            vendedores_id,
            valor_meta,
            tipo_comissao,
            comissao
          FROM meta_vendedores
          WHERE meta_id = ${goalId}
        `);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO meta_setor (
            meta_id,
            setor_id,
            valor_meta,
            tipo_comissao,
            comissao
          )
          SELECT
            ${nextGoalId},
            setor_id,
            valor_meta,
            tipo_comissao,
            comissao
          FROM meta_setor
          WHERE meta_id = ${goalId}
        `);
      }

      await transaction.operationalLog.create({
        data: {
          tenantId: unitId,
          jobType: "goals.lifecycle",
          operation: "finalize",
          status: "completed",
          message: `Meta ${goalId} finalizada.`,
          details: {
            nextGoalId,
            nextCompetence: goal.nextCompetence,
            nextGoalAlreadyExisted: existing.length > 0,
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "goals.finalized",
          entityType: "goal",
          entityId: String(goalId),
          correlationId: randomUUID(),
          metadata: {
            nextGoalId,
            nextCompetence: goal.nextCompetence,
            nextGoalAlreadyExisted: existing.length > 0,
          },
        },
      });
    });
    return this.goals(principal, { page: 1, pageSize: 20 });
  }

  async cancelGoal(
    principal: AuthPrincipal,
    goalId: number,
  ): Promise<GoalListResponse> {
    const unitId = this.unit(principal);
    await this.database.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<GoalStatusOnlyRow[]>(Prisma.sql`
        SELECT id, CASE status WHEN 'open' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END AS "statusId"
        FROM meta
        WHERE id = ${goalId} AND unit_id = ${unitId}
        FOR UPDATE
      `);
      const goal = rows[0];
      if (!goal)
        throw new BadRequestException("Meta não encontrada para esta empresa");
      if (goal.statusId === 3)
        throw new BadRequestException("Esta meta já está cancelada");
      if (goal.statusId === 2)
        throw new BadRequestException(
          "Uma meta finalizada não pode ser cancelada",
        );
      await transaction.$executeRaw(Prisma.sql`
        UPDATE meta SET status = 'cancelled', cancelled_at = NOW()
        WHERE id = ${goalId} AND unit_id = ${unitId}
      `);
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "goals.cancelled",
          entityType: "goal",
          entityId: String(goalId),
          correlationId: randomUUID(),
          metadata: {},
        },
      });
    });
    return this.goals(principal, { page: 1, pageSize: 20 });
  }

  async operations(principal: AuthPrincipal): Promise<OperationsOverview> {
    const unitId = this.unit(principal);
    const [
      configs,
      jobs,
      auditLogs,
      blingRows,
      mercadoLivreRows,
      apChatRows,
      legacyLogs,
      scheduleRows,
      surveyRows,
      authorizationRows,
      nfeSyncPolicy,
      operationNatures,
      salesChannels,
      sellers,
      customers,
      products,
      cfopRows,
    ] = await Promise.all([
      this.database.integrationConfig.findMany({
        where: { tenantId: principal.activeTenantId },
        select: { kind: true, enabled: true },
      }),
      this.database.jobExecution.findMany({
        where: { tenantId: principal.activeTenantId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.database.auditLog.findMany({
        where: { tenantId: principal.activeTenantId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
        },
      }),
      this.database.oAuthCredential.findUnique({
        where: { tenantId_kind: { tenantId: unitId, kind: "bling" } },
      }),
      this.database.oAuthCredential.findUnique({
        where: {
          tenantId_kind: { tenantId: unitId, kind: "mercado_livre" },
        },
      }),
      this.database.apChatConfig.findUnique({ where: { tenantId: unitId } }),
      this.database.operationalLog.findMany({
        where: { tenantId: unitId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.database.operationalSchedule.findFirst({
        where: { tenantId: unitId, jobType: "bling.sync-nfe" },
      }),
      this.database.satisfactionConfig.findUnique({
        where: { tenantId: unitId },
      }),
      this.database.oAuthCredential.findMany({ where: { tenantId: unitId } }),
      this.database.nfeSyncPolicy.findUnique({ where: { tenantId: unitId } }),
      this.database.operationNature.findMany({
        where: { tenantId: unitId, active: true },
        select: { externalBlingId: true, description: true },
        orderBy: { description: "asc" },
        take: 500,
      }),
      this.database.salesChannel.findMany({
        where: {
          tenantId: unitId,
          active: true,
          externalBlingId: { not: null },
        },
        select: { externalBlingId: true, description: true, type: true },
        orderBy: { description: "asc" },
        take: 500,
      }),
      this.database.seller.findMany({
        where: {
          tenantId: unitId,
          active: true,
          externalBlingId: { not: null },
        },
        select: { externalBlingId: true, name: true },
        orderBy: { name: "asc" },
        take: 500,
      }),
      this.database.contact.findMany({
        where: { tenantId: unitId },
        select: { externalBlingId: true, name: true, documentNumber: true },
        orderBy: { name: "asc" },
        take: 500,
      }),
      this.database.product.findMany({
        where: { tenantId: unitId, active: true, sku: { not: null } },
        select: { sku: true, name: true, ncm: true },
        orderBy: { name: "asc" },
        take: 1000,
      }),
      this.database.invoiceItem.findMany({
        where: { tenantId: unitId, cfop: { not: null } },
        distinct: ["cfop"],
        select: { cfop: true },
        orderBy: { cfop: "asc" },
        take: 500,
      }),
    ]);

    const configMap = new Map(configs.map((config) => [config.kind, config]));
    const bling = this.oauthStatus(blingRows);
    const mercadoLivre = this.oauthStatus(mercadoLivreRows);
    const apchat = apChatRows
      ? {
          configured: apChatRows.tokenCiphertext !== null,
          messagesEnabled: apChatRows.sendMessages,
          uuid: decryptSecret(apChatRows.workspaceIdCiphertext),
          sendNumber: apChatRows.invoicePhone,
          reportNumber: apChatRows.reportPhone,
          testNumber: apChatRows.testPhone,
        }
      : undefined;
    const schedule = scheduleRows;
    const survey = surveyRows
      ? {
          enabled: surveyRows.enabled,
          daysAfterShipping: surveyRows.delayDays,
          hour: surveyRows.delayHours,
          link: surveyRows.link,
          message: surveyRows.message,
        }
      : undefined;
    const authorization = {
      bling:
        authorizationRows.some((row) => row.kind === "bling") ||
        Boolean(process.env["BLING_CLIENT_ID"]),
      mercadoLivre:
        authorizationRows.some((row) => row.kind === "mercado_livre") ||
        Boolean(process.env["MERCADO_LIVRE_CLIENT_ID"]),
    };
    return operationsOverviewSchema.parse({
      integrations: [
        {
          kind: "bling",
          configured: bling?.configured ?? false,
          enabled:
            configMap.get("bling")?.enabled ?? bling?.configured ?? false,
          status: this.tokenStatus(bling),
          updatedAt: bling?.updatedAt?.toISOString() ?? null,
          detail: bling?.configured ? "OAuth v3 registrado" : null,
        },
        {
          kind: "apchat",
          configured: apchat?.configured ?? false,
          enabled:
            configMap.get("apchat")?.enabled ??
            apchat?.messagesEnabled ??
            false,
          status: !apchat?.configured
            ? "Não configurado"
            : apchat.messagesEnabled
              ? "Mensagens habilitadas"
              : "Mensagens pausadas",
          updatedAt: null,
          detail: apchat?.configured ? "Canal APChat registrado" : null,
        },
        {
          kind: "mercado_livre",
          configured: mercadoLivre?.configured ?? false,
          enabled:
            configMap.get("mercado_livre")?.enabled ??
            mercadoLivre?.configured ??
            false,
          status: this.tokenStatus(mercadoLivre),
          updatedAt: mercadoLivre?.updatedAt?.toISOString() ?? null,
          detail: mercadoLivre?.configured ? "OAuth registrado" : null,
        },
      ],
      jobs: jobs.map((job) => ({
        id: job.id,
        type: job.jobType,
        status: job.status,
        attempt: job.attempt,
        createdAt: job.createdAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() ?? null,
        errorMessage: job.errorMessage,
      })),
      legacyLogs: legacyLogs.map((log) => ({
        id: Number(log.id),
        source: log.jobType,
        method: log.operation,
        status: Number(log.status) || 0,
        message: log.message,
        occurredAt: log.createdAt.toISOString(),
      })),
      auditLogs: auditLogs.map((log) => ({
        ...log,
        id: log.id.toString(),
        createdAt: log.createdAt.toISOString(),
      })),
      configuration: {
        authorization: {
          bling: authorization?.bling ?? false,
          mercadoLivre:
            (authorization?.mercadoLivre ?? false) &&
            this.isHttpUrl(process.env["MERCADO_LIVRE_REDIRECT_URI"]),
        },
        schedule: {
          hours: schedule?.hours ?? [],
          description: schedule?.name ?? null,
        },
        apchat: {
          configured: apchat?.configured ?? false,
          uuid: apchat?.uuid ?? null,
          sendNumber: apchat?.sendNumber ?? null,
          reportNumber: apchat?.reportNumber ?? null,
          testNumber: apchat?.testNumber ?? null,
          messagesOpen: apchat?.messagesEnabled ?? false,
        },
        satisfaction: {
          enabled: survey?.enabled ?? false,
          daysAfterShipping: survey?.daysAfterShipping ?? 0,
          hour: survey?.hour ?? null,
          link: survey?.link ?? null,
          message: survey?.message ?? null,
        },
        nfeSyncPolicy: nfeSyncPolicy
          ? {
              ...nfeSyncPolicy,
              minimumTotal:
                nfeSyncPolicy.minimumTotal === null
                  ? null
                  : Number(nfeSyncPolicy.minimumTotal),
              maximumTotal:
                nfeSyncPolicy.maximumTotal === null
                  ? null
                  : Number(nfeSyncPolicy.maximumTotal),
            }
          : defaultNfeSyncPolicy(),
        nfeSyncOptions: {
          natures: operationNatures.map((nature) => ({
            value: nature.externalBlingId,
            label: nature.description,
          })),
          salesChannels: salesChannels.flatMap((channel) =>
            channel.externalBlingId
              ? [
                  {
                    value: channel.externalBlingId,
                    label: channel.description,
                    detail: channel.type,
                  },
                ]
              : [],
          ),
          sellers: sellers.flatMap((seller) =>
            seller.externalBlingId
              ? [{ value: seller.externalBlingId, label: seller.name }]
              : [],
          ),
          customers: customers.map((customer) => ({
            value: customer.externalBlingId,
            label: customer.name,
            detail: customer.documentNumber,
          })),
          products: uniquePolicyOptions(
            products.flatMap((product) =>
              product.sku
                ? [
                    {
                      value: product.sku,
                      label: product.name,
                      detail: product.ncm,
                    },
                  ]
                : [],
            ),
          ),
          cfops: cfopRows.flatMap((row) =>
            row.cfop === null ? [] : [String(row.cfop)],
          ),
          ncms: [
            ...new Set(
              products.flatMap((product) => (product.ncm ? [product.ncm] : [])),
            ),
          ].sort(),
        },
      },
    });
  }

  async authorization(
    principal: AuthPrincipal,
    kind: "bling" | "mercado_livre",
  ): Promise<OauthAuthorizationResponse> {
    const tenantId = this.unit(principal);
    const existing = await this.database.oAuthCredential.findUnique({
      where: { tenantId_kind: { tenantId, kind } },
    });
    const prefix = kind === "bling" ? "BLING" : "MERCADO_LIVRE";
    const clientId =
      (existing?.clientIdCiphertext
        ? decryptSecret(existing.clientIdCiphertext)
        : undefined) ?? process.env[`${prefix}_CLIENT_ID`];
    const state = randomUUID();
    await this.database.oAuthCredential.upsert({
      where: { tenantId_kind: { tenantId, kind } },
      create: {
        tenantId,
        kind,
        status: "pending",
        authorizationStateHash: createHash("sha256")
          .update(state)
          .digest("hex"),
        authorizationExpiresAt: new Date(Date.now() + 10 * 60_000),
      },
      update: {
        status: "pending",
        authorizationStateHash: createHash("sha256")
          .update(state)
          .digest("hex"),
        authorizationExpiresAt: new Date(Date.now() + 10 * 60_000),
        lastError: null,
      },
    });
    let url: URL;
    if (kind === "bling") {
      if (!clientId)
        throw new BadRequestException(
          "Client ID do Bling não configurado para esta empresa",
        );
      url = new URL("https://www.bling.com.br/Api/v3/oauth/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("state", state);
    } else {
      const redirectUri = process.env["MERCADO_LIVRE_REDIRECT_URI"];
      if (!clientId || !this.isHttpUrl(redirectUri))
        throw new BadRequestException(
          "OAuth do Mercado Livre não configurado para esta empresa",
        );
      url = new URL("https://auth.mercadolivre.com.br/authorization");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
    }
    return oauthAuthorizationResponseSchema.parse({
      kind,
      url: url.toString(),
    });
  }

  async enqueueOperation(
    principal: AuthPrincipal,
    input: OperationsJobRequest,
  ): Promise<QueuedJobResponse> {
    this.unit(principal);
    if (input.jobType.startsWith("bling.sync-")) {
      const existing = await this.database.jobExecution.findFirst({
        where: {
          tenantId: principal.activeTenantId,
          jobType: input.jobType,
          status: { in: ["queued", "active"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        return queuedJobResponseSchema.parse({
          id: existing.id,
          correlationId: existing.correlationId,
          jobType: input.jobType,
          status: "queued",
        });
      }
    }
    const id = randomUUID();
    const correlationId = randomUUID();
    const payload = operationPayload(input, id);
    const job = integrationJobSchema.parse({
      tenantId: principal.activeTenantId,
      jobType: input.jobType,
      correlationId,
      requestedBy: principal.userId,
      payload,
      createdAt: new Date().toISOString(),
    });
    await this.database.jobExecution.create({
      data: {
        id,
        tenantId: principal.activeTenantId,
        jobType: input.jobType,
        status: "queued",
        correlationId,
      },
    });
    try {
      await this.queue.add(input.jobType, job, { jobId: id });
    } catch (error) {
      await this.database.jobExecution.update({
        where: { id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          errorCode: "queue_unavailable",
          errorMessage:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Queue unavailable",
        },
      });
      throw error;
    }
    await this.database.auditLog.create({
      data: {
        tenantId: principal.activeTenantId,
        actorUserId: principal.userId,
        action: "operations.job.queued",
        entityType: "job_execution",
        entityId: id,
        correlationId,
        metadata:
          input.jobType === "bling.sync-nfe" ||
          input.jobType === "bling.sync-sales-orders"
            ? { jobType: input.jobType, from: input.from, to: input.to }
            : input.jobType === "apchat.deliver"
              ? { jobType: input.jobType, test: true }
              : { jobType: input.jobType },
      },
    });
    return queuedJobResponseSchema.parse({
      id,
      correlationId,
      jobType: input.jobType,
      status: "queued",
    });
  }

  async updateOperationsSettings(
    principal: AuthPrincipal,
    input: OperationsSettingsUpdate,
  ): Promise<OperationsOverview> {
    const unitId = this.unit(principal);
    await this.database.$transaction(async (transaction) => {
      if (input.kind === "schedule") {
        const description =
          "Seleciona quais horas do dia as notas serão sincronizadas e enviadas automaticamente.";
        await transaction.operationalSchedule.upsert({
          where: {
            tenantId_jobType: { tenantId: unitId, jobType: "bling.sync-nfe" },
          },
          create: {
            tenantId: unitId,
            jobType: "bling.sync-nfe",
            name: description,
            hours: input.hours,
          },
          update: { name: description, hours: input.hours, enabled: true },
        });
      }
      if (input.kind === "apchat") {
        const current = await transaction.apChatConfig.findUnique({
          where: { tenantId: unitId },
        });
        const token = input.token ?? null;
        if (!current && !token)
          throw new BadRequestException(
            "Informe o token na primeira configuração do APChat",
          );
        await transaction.apChatConfig.upsert({
          where: { tenantId: unitId },
          create: {
            tenantId: unitId,
            workspaceIdCiphertext: encryptSecret(input.uuid),
            tokenCiphertext: encryptSecret(token!),
            invoicePhone: input.sendNumber,
            reportPhone: input.reportNumber,
            testPhone: input.testNumber,
            sendMessages: input.messagesOpen,
            enabled: true,
          },
          update: {
            workspaceIdCiphertext: encryptSecret(input.uuid),
            ...(token ? { tokenCiphertext: encryptSecret(token) } : {}),
            invoicePhone: input.sendNumber,
            reportPhone: input.reportNumber,
            testPhone: input.testNumber,
            sendMessages: input.messagesOpen,
            enabled: true,
          },
        });
      }
      if (input.kind === "satisfaction") {
        await transaction.satisfactionConfig.upsert({
          where: { tenantId: unitId },
          create: {
            tenantId: unitId,
            enabled: input.enabled,
            delayDays: input.daysAfterShipping,
            delayHours: input.hour,
            link: input.link,
            message: input.message,
          },
          update: {
            enabled: input.enabled,
            delayDays: input.daysAfterShipping,
            delayHours: input.hour,
            link: input.link,
            message: input.message,
          },
        });
      }
      if (input.kind === "nfeSyncPolicy") {
        const { kind, ...policy } = input;
        void kind;
        await transaction.nfeSyncPolicy.upsert({
          where: { tenantId: unitId },
          create: { tenantId: unitId, ...policy },
          update: policy,
        });
      }
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: `operations.${input.kind}.updated`,
          entityType: "operations_configuration",
          entityId: String(unitId),
          correlationId: randomUUID(),
          metadata:
            input.kind === "apchat"
              ? { kind: input.kind, tokenChanged: input.token !== undefined }
              : input,
        },
      });
    });
    return this.operations(principal);
  }

  async profitability(
    principal: AuthPrincipal,
    query: ProfitabilityQuery,
  ): Promise<ProfitabilityResponse> {
    const unitId = this.unit(principal);
    const filters: Prisma.Sql[] = [
      Prisma.sql`unit_id = ${unitId}`,
      Prisma.sql`COALESCE(status_envio, '') <> 'Cancelada'`,
      Prisma.sql`data_emissao::date >= ${query.dataInicial}::date`,
      Prisma.sql`data_emissao::date <= ${query.dataFinal}::date`,
    ];
    if (query.numero) filters.push(Prisma.sql`numero = ${query.numero}`);
    if (query.nome) filters.push(Prisma.sql`nome ILIKE ${`%${query.nome}%`}`);
    if (query.tipoVenda)
      filters.push(Prisma.sql`tipo_venda = ${query.tipoVenda}`);
    if (query.calculo) filters.push(Prisma.sql`tem_calculo = ${query.calculo}`);
    if (query.somentePrejuizo) filters.push(Prisma.sql`lucro < 0`);
    const where = Prisma.join(filters, " AND ");
    const offset = (query.page - 1) * query.pageSize;

    const [items, summaryRows] = await Promise.all([
      this.database.$queryRaw<ProfitabilityRow[]>(Prisma.sql`
        SELECT
          id,
          COALESCE(numero::text, '—') AS numero,
          COALESCE(NULLIF(BTRIM(tipo_venda), ''), 'Não informado') AS "tipoVenda",
          TO_CHAR(data_emissao, 'YYYY-MM-DD') AS "dataEmissao",
          COALESCE(NULLIF(BTRIM(nome), ''), 'Cliente não informado') AS nome,
          ROUND(COALESCE(valor, 0)::numeric, 2)::text AS valor,
          ROUND(COALESCE(venda_liquido, 0)::numeric, 2)::text AS "vendaLiquida",
          ROUND(COALESCE(desconto, 0)::numeric, 2)::text AS desconto,
          ROUND(COALESCE(frete, 0)::numeric, 2)::text AS frete,
          ROUND(COALESCE(outras_despesas, 0)::numeric, 2)::text AS "outrasDespesas",
          ROUND(COALESCE(custo_liquido, 0)::numeric, 2)::text AS "custoLiquido",
          ROUND(COALESCE(impostos, 0)::numeric, 2)::text AS impostos,
          ROUND(COALESCE(taxa, 0)::numeric, 2)::text AS taxa,
          ROUND(COALESCE(lucro, 0)::numeric, 2)::text AS lucro,
          ROUND(COALESCE(margem_lucro, 0)::numeric, 2)::text AS "margemLucro",
          tem_calculo AS calculo,
          NULLIF(BTRIM(obs_calculo), '') AS observacao
        FROM invoice_overview
        WHERE ${where}
        ORDER BY data_emissao DESC NULLS LAST, id DESC
        LIMIT ${query.pageSize}
        OFFSET ${offset}
      `),
      this.database.$queryRaw<ProfitabilitySummaryRow[]>(Prisma.sql`
        SELECT
          ROUND(COALESCE(SUM(valor), 0)::numeric, 2)::text AS "vendaBruta",
          ROUND(COALESCE(SUM(venda_liquido), 0)::numeric, 2)::text AS "vendaLiquida",
          ROUND(COALESCE(SUM(custo_liquido), 0)::numeric, 2)::text AS "custoLiquido",
          ROUND(COALESCE(SUM(impostos), 0)::numeric, 2)::text AS impostos,
          ROUND(COALESCE(SUM(lucro), 0)::numeric, 2)::text AS lucro,
          ROUND((CASE
            WHEN COALESCE(SUM(venda_liquido), 0) = 0 THEN 0
            ELSE COALESCE(SUM(lucro), 0) / SUM(venda_liquido) * 100
          END)::numeric, 2)::text AS "margemSobreVendaLiquida",
          COUNT(*)::bigint AS notas
        FROM invoice_overview
        WHERE ${where}
      `),
    ]);
    const summary = summaryRows[0] ?? {
      vendaBruta: "0.00",
      vendaLiquida: "0.00",
      custoLiquido: "0.00",
      impostos: "0.00",
      lucro: "0.00",
      margemSobreVendaLiquida: "0.00",
      notas: 0n,
    };
    const total = Number(summary.notas);
    return profitabilityResponseSchema.parse({
      summary: { ...summary, notas: total },
      items,
      pagination: this.pagination(query.page, query.pageSize, total),
    });
  }

  async financeFilterOptions(
    principal: AuthPrincipal,
  ): Promise<InvoiceFilterOptionsResponse> {
    const unitId = this.unit(principal);
    const [customers, salesChannels] = await Promise.all([
      this.database.$queryRaw<InvoiceFilterOptionRow[]>(Prisma.sql`
        SELECT DISTINCT BTRIM(nome) AS value
        FROM invoice_overview
        WHERE unit_id = ${unitId}
          AND NULLIF(BTRIM(nome), '') IS NOT NULL
        ORDER BY value
        LIMIT 500
      `),
      this.database.$queryRaw<InvoiceFilterOptionRow[]>(Prisma.sql`
        SELECT DISTINCT BTRIM(tipo_venda) AS value
        FROM invoice_overview
        WHERE unit_id = ${unitId}
          AND NULLIF(BTRIM(tipo_venda), '') IS NOT NULL
        ORDER BY value
        LIMIT 200
      `),
    ]);
    return invoiceFilterOptionsResponseSchema.parse({
      customers: customers.map((item) => item.value),
      salesChannels: salesChannels.map((item) => item.value),
    });
  }

  async globalSearch(
    principal: AuthPrincipal,
    query: string,
  ): Promise<GlobalSearchResult> {
    const unitId = this.unit(principal);
    const term = `%${query}%`;
    const canInvoices =
      principal.permissions.includes("nfe:view") ||
      principal.permissions.includes("finance:view");
    const [invoices, people, products] = await Promise.all([
      canInvoices
        ? this.database.$queryRaw<GlobalInvoiceSearchRow[]>(Prisma.sql`
            SELECT n.id, COALESCE(n.numero::text, 'Sem número') AS numero,
              COALESCE(NULLIF(BTRIM(p.nome), ''), 'Cliente não identificado') AS customer,
              TO_CHAR(n.data_emissao, 'DD/MM/YYYY') AS "issuedAt"
            FROM nfe n
            LEFT JOIN pessoa p
              ON p.id_bling=n.contato_id_bling AND p.unit_id=n.unit_id
            WHERE n.unit_id=${unitId}
              AND (COALESCE(n.numero::text, '') ILIKE ${term}
                OR COALESCE(p.nome, '') ILIKE ${term}
                OR COALESCE(p.numero_documento, '') ILIKE ${term})
            ORDER BY n.data_emissao DESC NULLS LAST, n.id DESC
            LIMIT 6
          `)
        : Promise.resolve([]),
      principal.permissions.includes("people:view")
        ? this.database.$queryRaw<GlobalPersonSearchRow[]>(Prisma.sql`
            SELECT p.id, COALESCE(NULLIF(BTRIM(p.nome), ''), 'Pessoa sem nome') AS name,
              NULLIF(BTRIM(p.numero_documento), '') AS document,
              NULLIF(BTRIM(p.email), '') AS email
            FROM pessoa p
            WHERE p.unit_id=${unitId}
              AND (COALESCE(p.nome, '') ILIKE ${term}
                OR COALESCE(p.numero_documento, '') ILIKE ${term}
                OR COALESCE(p.email, '') ILIKE ${term})
            ORDER BY p.nome, p.id
            LIMIT 6
          `)
        : Promise.resolve([]),
      principal.permissions.includes("products:view")
        ? this.database.$queryRaw<GlobalProductSearchRow[]>(Prisma.sql`
            SELECT p.id, COALESCE(NULLIF(BTRIM(p.nome), ''), 'Produto sem nome') AS name,
              NULLIF(BTRIM(p.codigo), '') AS code, NULLIF(BTRIM(p.ncm), '') AS ncm
            FROM produtos p
            WHERE p.unit_id=${unitId}
              AND (COALESCE(p.nome, '') ILIKE ${term}
                OR COALESCE(p.codigo, '') ILIKE ${term}
                OR COALESCE(p.ncm, '') ILIKE ${term})
            ORDER BY p.nome, p.id
            LIMIT 6
          `)
        : Promise.resolve([]),
    ]);
    const items: GlobalSearchResult["items"] = [];
    if (principal.permissions.includes("nfe:view"))
      items.push(
        ...invoices.map((invoice) => ({
          id: `invoice-operational-${invoice.id}`,
          kind: "invoice-operational" as const,
          category: "NF-e · Envios",
          title: `NF-e #${invoice.numero}`,
          subtitle: `${invoice.customer}${invoice.issuedAt ? ` · ${invoice.issuedAt}` : ""}`,
          href: `/app/nfe/${invoice.id}`,
        })),
      );
    if (principal.permissions.includes("finance:view"))
      items.push(
        ...invoices.map((invoice) => ({
          id: `invoice-financial-${invoice.id}`,
          kind: "invoice-financial" as const,
          category: "NF-e · Lucro",
          title: `NF-e #${invoice.numero}`,
          subtitle: `${invoice.customer}${invoice.issuedAt ? ` · ${invoice.issuedAt}` : ""}`,
          href: `/app/finance/nfe/${invoice.id}`,
        })),
      );
    items.push(
      ...people.map((person) => ({
        id: `person-${person.id}`,
        kind: "person" as const,
        category: "Pessoas",
        title: person.name,
        subtitle: person.document ?? person.email ?? "Cadastro sincronizado",
        href: `/app/people?search=${encodeURIComponent(person.document ?? person.name)}`,
      })),
      ...products.map((product) => ({
        id: `product-${product.id}`,
        kind: "product" as const,
        category: "Produtos",
        title: product.name,
        subtitle:
          [product.code, product.ncm ? `NCM ${product.ncm}` : null]
            .filter(Boolean)
            .join(" · ") || "Produto sincronizado",
        href: `/app/products?search=${encodeURIComponent(product.code ?? product.name)}`,
      })),
    );
    return globalSearchResultSchema.parse({ query, items });
  }

  private unit(principal: AuthPrincipal): string {
    if (principal.tenantDemo) {
      throw new BadRequestException(
        "Empresa autenticada não possui configuração operacional",
      );
    }
    return principal.activeTenantId;
  }

  private tokenStatus(row: LegacyTokenRow | undefined): string {
    if (!row?.configured) return "Não configurado";
    if (row.status === "S") return "Conectado";
    if (row.status === "R") return "Renovando token";
    if (row.status === "N") return "Reconexão necessária";
    return "Estado não identificado";
  }

  private oauthStatus(
    row: {
      accessTokenCiphertext: Uint8Array | null;
      status: string;
      updatedAt: Date;
    } | null,
  ): LegacyTokenRow | undefined {
    if (!row) return undefined;
    return {
      configured: row.accessTokenCiphertext !== null,
      status:
        row.status === "connected" ? "S" : row.status === "pending" ? "R" : "N",
      updatedAt: row.updatedAt,
    };
  }

  private isHttpUrl(value: string | null | undefined): value is string {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }

  private pagination(page: number, pageSize: number, total: number) {
    return {
      page,
      pageSize,
      total,
      pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  private productOrder(query: ProductListQuery): Prisma.Sql {
    const column =
      query.order === "nome"
        ? Prisma.sql`nome`
        : query.order === "codigo"
          ? Prisma.sql`codigo`
          : query.order === "custo"
            ? Prisma.sql`custo`
            : Prisma.sql`id_produto`;
    const direction =
      query.direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    return Prisma.sql`${column} ${direction} NULLS LAST, id ASC`;
  }

  private peopleOrder(query: PeopleListQuery): Prisma.Sql {
    const column =
      query.order === "id_bling" ? Prisma.sql`p.id_bling` : Prisma.sql`p.nome`;
    const direction =
      query.direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    return Prisma.sql`${column} ${direction}, p.id ASC`;
  }
}

function operationPayload(
  input: OperationsJobRequest,
  idempotencyKey: string,
): Record<string, unknown> {
  switch (input.jobType) {
    case "bling.sync-nfe":
    case "bling.sync-sales-orders":
      return { from: input.from, to: input.to };
    case "bling.sync-products":
    case "bling.sync-payment-methods":
    case "bling.sync-sales-channels":
    case "bling.sync-sellers":
    case "bling.sync-operation-natures":
      return {};
    case "apchat.deliver":
      return {
        recipient: input.recipient,
        body: input.body,
        idempotencyKey,
      };
  }
}

function defaultNfeSyncPolicy(): NfeSyncPolicy {
  return {
    enabled: true,
    allowedStatuses: [5, 6],
    allowedDirections: [1],
    requireSaleNature: true,
    excludeReturnNature: true,
    includedNatureIds: [],
    excludedNatureIds: [],
    includedCustomerIds: [],
    excludedCustomerIds: [],
    includedCustomerDocuments: [],
    excludedCustomerDocuments: [],
    includedCustomerTerms: [],
    excludedCustomerTerms: ["ebazar"],
    includedSalesChannelIds: [],
    excludedSalesChannelIds: [],
    includedSellerIds: [],
    excludedSellerIds: [],
    includedCfops: [],
    excludedCfops: [],
    includedSkus: [],
    excludedSkus: [],
    includedNcms: [],
    excludedNcms: [],
    minimumTotal: null,
    maximumTotal: null,
  };
}

function uniquePolicyOptions<T extends { value: string }>(options: T[]): T[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const value = option.value.trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function goalStatusName(statusId: number): "open" | "completed" | "cancelled" {
  if (statusId === 1) return "open";
  if (statusId === 2) return "completed";
  return "cancelled";
}
