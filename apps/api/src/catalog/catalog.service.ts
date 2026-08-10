import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Queue } from "bullmq";
import {
  goalListResponseSchema,
  goalResourcesResponseSchema,
  integrationJobSchema,
  operationsOverviewSchema,
  oauthAuthorizationResponseSchema,
  peopleListResponseSchema,
  productListResponseSchema,
  profitabilityResponseSchema,
  queuedJobResponseSchema,
  type GoalListQuery,
  type GoalListResponse,
  type GoalCreateInput,
  type GoalResourcesResponse,
  type OperationsJobRequest,
  type OperationsOverview,
  type OperationsSettingsUpdate,
  type OauthAuthorizationResponse,
  type PeopleListQuery,
  type PeopleListResponse,
  type ProductListQuery,
  type ProductListResponse,
  type ProfitabilityQuery,
  type ProfitabilityResponse,
  type QueuedJobResponse,
} from "@integrador/contracts";
import { Prisma, type DatabaseClient } from "@integrador/db";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";
import { INTEGRATION_QUEUE_CLIENT } from "../queue/queue.module.js";

interface CountRow {
  total: bigint;
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

interface LegacyTokenRow {
  configured: boolean;
  status: string | null;
  updatedAt: Date | null;
}

interface LegacyApChatRow {
  configured: boolean;
  messagesEnabled: boolean;
  uuid: string | null;
  sendNumber: string | null;
  reportNumber: string | null;
  testNumber: string | null;
}

interface LegacyScheduleRow {
  id: number;
  hours: number[];
  description: string | null;
}
interface LegacySurveyRow {
  id: number;
  enabled: boolean;
  daysAfterShipping: number | null;
  hour: number | null;
  link: string | null;
  message: string | null;
}
interface AuthorizationRow {
  bling: boolean;
  mercadoLivre: boolean;
}
interface AuthorizationCredentialRow {
  clientId: string | null;
  mercadoLivreClientId: string | null;
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

interface LegacyLogRow {
  id: number;
  source: string;
  method: string;
  status: number;
  message: string;
  occurredAt: Date;
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
    if (query.idProduto)
      filters.push(Prisma.sql`id_produto ILIKE ${`%${query.idProduto}%`}`);
    if (query.nome) filters.push(Prisma.sql`nome ILIKE ${`%${query.nome}%`}`);
    if (query.codigo)
      filters.push(Prisma.sql`codigo ILIKE ${`%${query.codigo}%`}`);
    if (query.fabricacaoPropria)
      filters.push(Prisma.sql`fp = ${query.fabricacaoPropria}`);
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
          situacao,
          CASE WHEN fp = 'S' THEN TRUE WHEN fp = 'N' THEN FALSE ELSE NULL END
            AS "fabricacaoPropria",
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
        Prisma.sql`p.desabilitar_envio = ${query.envioDesabilitado}`,
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
          p.desabilitar_envio = 'S' AS "envioDesabilitado",
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
      UPDATE pessoa SET desabilitar_envio=${disabled ? "S" : "N"} WHERE id=${id} AND unit_id=${unitId}
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
    const filters: Prisma.Sql[] = [Prisma.sql`m.system_unit_id = ${unitId}`];
    if (query.competencia)
      filters.push(Prisma.sql`m.mes_ano ILIKE ${`%${query.competencia}%`}`);
    if (query.dataInicial)
      filters.push(
        Prisma.sql`m.data_inicial::date = ${query.dataInicial}::date`,
      );
    if (query.dataFinal)
      filters.push(Prisma.sql`m.data_final::date = ${query.dataFinal}::date`);
    if (query.statusId !== undefined)
      filters.push(Prisma.sql`m.status_id = ${query.statusId}`);
    const where = Prisma.join(filters, " AND ");
    const offset = (query.page - 1) * query.pageSize;

    const [items, totals, statusRows] = await Promise.all([
      this.database.$queryRaw<GoalRow[]>(Prisma.sql`
        SELECT
          m.id,
          m.mes_ano AS competencia,
          TO_CHAR(m.data_inicial, 'YYYY-MM-DD') AS "dataInicial",
          TO_CHAR(m.data_final, 'YYYY-MM-DD') AS "dataFinal",
          m.status_id AS "statusId",
          COALESCE(ms.nome, 'Indefinido') AS status,
          ROUND(COALESCE(v.valor, 0)::numeric, 2)::text AS "valorMetaVendedores",
          ROUND(COALESCE(s.valor, 0)::numeric, 2)::text AS "valorMetaSetores",
          ROUND(COALESCE(c.valor, 0)::numeric, 2)::text AS "custoPlanejado",
          COALESCE(v.quantidade, 0)::bigint AS vendedores,
          COALESCE(s.quantidade, 0)::bigint AS setores,
          COALESCE(c.quantidade, 0)::bigint AS custos
        FROM meta m
        LEFT JOIN meta_status ms ON ms.id = m.status_id
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
        SELECT m.status_id AS "statusId", COALESCE(ms.nome, 'Indefinido') AS label,
          COUNT(*)::bigint AS total
        FROM meta m
        LEFT JOIN meta_status ms ON ms.id = m.status_id
        WHERE m.system_unit_id = ${unitId}
        GROUP BY m.status_id, ms.nome
        ORDER BY m.status_id
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
    const [vendors, sectors] = await Promise.all([
      this.database.$queryRaw<GoalResourceRow[]>(Prisma.sql`
        SELECT v.id, COALESCE(NULLIF(BTRIM(v.nome), ''), 'Sem nome') AS name, NULLIF(BTRIM(s.nome), '') AS sector
        FROM vendedores v LEFT JOIN setor s ON s.id=v.setor_id WHERE v.unit_id=${unitId} ORDER BY v.nome, v.id
      `),
      this.database.$queryRaw<SectorResourceRow[]>(Prisma.sql`
        SELECT id, COALESCE(NULLIF(BTRIM(nome), ''), 'Sem nome') AS name FROM setor ORDER BY nome, id
      `),
    ]);
    return goalResourcesResponseSchema.parse({ vendors, sectors });
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
    await this.database.$transaction(async (transaction) => {
      const duplicates = await transaction.$queryRaw<CountRow[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS total FROM meta WHERE system_unit_id=${unitId} AND status_id=1 AND mes_ano=${input.competencia}`,
      );
      if (Number(duplicates[0]?.total ?? 0n) > 0)
        throw new BadRequestException(
          "Já existe uma meta aberta para esta competência",
        );
      const inserted = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
        INSERT INTO meta (system_unit_id,status_id,data_inicial,data_final,mes_ano)
        VALUES (${unitId},1,${input.dataInicial}::date,${input.dataFinal}::date,${input.competencia}) RETURNING id
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
        INSERT INTO meta_custo (meta_id,descricao,valor_custo) VALUES (${goalId},${cost.description},${cost.value}::numeric)
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

  async finalizeGoal(
    principal: AuthPrincipal,
    goalId: number,
  ): Promise<GoalListResponse> {
    const unitId = this.unit(principal);
    await this.database.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<GoalLifecycleRow[]>(Prisma.sql`
        SELECT
          id,
          status_id AS "statusId",
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
        WHERE id = ${goalId} AND system_unit_id = ${unitId}
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
        WHERE system_unit_id = ${unitId}
          AND mes_ano = ${goal.nextCompetence}
        ORDER BY id
        LIMIT 1
      `);

      await transaction.$executeRaw(Prisma.sql`
        UPDATE meta SET status_id = 2
        WHERE id = ${goalId} AND system_unit_id = ${unitId}
      `);

      let nextGoalId = existing[0]?.id ?? null;
      if (nextGoalId === null) {
        const inserted = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO meta (
            system_unit_id,
            status_id,
            data_inicial,
            data_final,
            mes_ano
          ) VALUES (
            ${unitId},
            1,
            ${goal.nextStart}::date,
            ${goal.nextEnd}::date,
            ${goal.nextCompetence}
          )
          RETURNING id
        `);
        nextGoalId = inserted[0]!.id;
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO meta_custo (meta_id, descricao, valor_custo)
          SELECT ${nextGoalId}, descricao, valor_custo
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

      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO log_crontab (
          empresa_id,
          classe,
          metodo,
          data_hora,
          status,
          mensagem,
          observacao
        ) VALUES (
          ${unitId},
          'MetaService',
          'finalizarMeta',
          NOW(),
          0,
          ${`Meta ${goalId} finalizada.`},
          ${
            existing.length
              ? `A meta ${nextGoalId} de ${goal.nextCompetence} já existia e não foi duplicada.`
              : `Meta ${nextGoalId} de ${goal.nextCompetence} criada com sucesso.`
          }
        )
      `);
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
        SELECT id, status_id AS "statusId"
        FROM meta
        WHERE id = ${goalId} AND system_unit_id = ${unitId}
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
        UPDATE meta SET status_id = 3
        WHERE id = ${goalId} AND system_unit_id = ${unitId}
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
      this.database.$queryRaw<LegacyTokenRow[]>(Prisma.sql`
          SELECT
            access_token IS NOT NULL AND BTRIM(access_token) <> '' AS configured,
            status,
            updated_at AS "updatedAt"
          FROM bling_tokens
          WHERE unit_id = ${unitId}
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1
        `),
      this.database.$queryRaw<LegacyTokenRow[]>(Prisma.sql`
          SELECT
            access_token IS NOT NULL AND BTRIM(access_token) <> '' AS configured,
            status,
            updated_at AS "updatedAt"
          FROM mercadolivre_tokens
          WHERE unit_id = ${unitId}
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1
        `),
      this.database.$queryRaw<LegacyApChatRow[]>(Prisma.sql`
          SELECT
            token IS NOT NULL AND BTRIM(token) <> '' AS configured,
            COALESCE(msg, 'N') = 'S' AS "messagesEnabled",
            NULLIF(BTRIM(uuid), '') AS uuid,
            NULLIF(BTRIM(num_envio), '') AS "sendNumber",
            NULLIF(BTRIM(num_relatorio), '') AS "reportNumber",
            NULLIF(BTRIM(num_teste), '') AS "testNumber"
          FROM ap_chat
          WHERE unit_id = ${unitId}
          ORDER BY id DESC
          LIMIT 1
        `),
      this.database.$queryRaw<LegacyLogRow[]>(Prisma.sql`
          SELECT
            id,
            classe AS source,
            metodo AS method,
            status,
            mensagem AS message,
            data_hora AS "occurredAt"
          FROM log_crontab
          WHERE empresa_id = ${unitId}
          ORDER BY data_hora DESC
          LIMIT 20
        `),
      this.database.$queryRaw<LegacyScheduleRow[]>(Prisma.sql`
          SELECT id, descricao AS description,
            ARRAY(SELECT value FROM UNNEST(ARRAY[
              CASE WHEN h0 = 'S' THEN 0 END, CASE WHEN h1 = 'S' THEN 1 END, CASE WHEN h2 = 'S' THEN 2 END,
              CASE WHEN h3 = 'S' THEN 3 END, CASE WHEN h4 = 'S' THEN 4 END, CASE WHEN h5 = 'S' THEN 5 END,
              CASE WHEN h6 = 'S' THEN 6 END, CASE WHEN h7 = 'S' THEN 7 END, CASE WHEN h8 = 'S' THEN 8 END,
              CASE WHEN h9 = 'S' THEN 9 END, CASE WHEN h10 = 'S' THEN 10 END, CASE WHEN h11 = 'S' THEN 11 END,
              CASE WHEN h12 = 'S' THEN 12 END, CASE WHEN h13 = 'S' THEN 13 END, CASE WHEN h14 = 'S' THEN 14 END,
              CASE WHEN h15 = 'S' THEN 15 END, CASE WHEN h16 = 'S' THEN 16 END, CASE WHEN h17 = 'S' THEN 17 END,
              CASE WHEN h18 = 'S' THEN 18 END, CASE WHEN h19 = 'S' THEN 19 END, CASE WHEN h20 = 'S' THEN 20 END,
              CASE WHEN h21 = 'S' THEN 21 END, CASE WHEN h22 = 'S' THEN 22 END, CASE WHEN h23 = 'S' THEN 23 END
            ]) AS value WHERE value IS NOT NULL) AS hours
          FROM crontab_config WHERE unit_id = ${unitId} ORDER BY id LIMIT 1
        `),
      this.database.$queryRaw<LegacySurveyRow[]>(Prisma.sql`
          SELECT id, COALESCE(habilitar, 'N') = 'S' AS enabled, tempo_dia_env AS "daysAfterShipping",
            tempo_hora_env AS hour, NULLIF(BTRIM(link), '') AS link, NULLIF(BTRIM(msg), '') AS message
          FROM pesquisa_satisfacao WHERE unit_id = ${unitId} ORDER BY id LIMIT 1
        `),
      this.database.$queryRaw<AuthorizationRow[]>(Prisma.sql`
          SELECT
            NULLIF(BTRIM(client_id), '') IS NOT NULL AS bling,
            NULLIF(BTRIM(ml_client_id), '') IS NOT NULL AS "mercadoLivre"
          FROM system_unit WHERE id=${unitId} LIMIT 1
        `),
    ]);

    const configMap = new Map(configs.map((config) => [config.kind, config]));
    const bling = blingRows[0];
    const mercadoLivre = mercadoLivreRows[0];
    const apchat = apChatRows[0];
    const schedule = scheduleRows[0];
    const survey = surveyRows[0];
    const authorization = authorizationRows[0];
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
        ...log,
        occurredAt: log.occurredAt.toISOString(),
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
          description: schedule?.description ?? null,
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
      },
    });
  }

  async authorization(
    principal: AuthPrincipal,
    kind: "bling" | "mercado_livre",
  ): Promise<OauthAuthorizationResponse> {
    const unitId = this.unit(principal);
    const rows = await this.database.$queryRaw<
      AuthorizationCredentialRow[]
    >(Prisma.sql`
      SELECT
        NULLIF(BTRIM(client_id), '') AS "clientId",
        NULLIF(BTRIM(ml_client_id), '') AS "mercadoLivreClientId"
      FROM system_unit WHERE id=${unitId} LIMIT 1
    `);
    const credentials = rows[0];
    const state = randomUUID();
    let url: URL;
    if (kind === "bling") {
      if (!credentials?.clientId)
        throw new BadRequestException(
          "Client ID do Bling não configurado para esta empresa",
        );
      await this.database.$executeRaw(Prisma.sql`
        UPDATE system_unit SET state=${state}, used_at=NULL WHERE id=${unitId}
      `);
      url = new URL("https://www.bling.com.br/Api/v3/oauth/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", credentials.clientId);
      url.searchParams.set("state", state);
    } else {
      const redirectUri = process.env["MERCADO_LIVRE_REDIRECT_URI"];
      if (!credentials?.mercadoLivreClientId || !this.isHttpUrl(redirectUri))
        throw new BadRequestException(
          "OAuth do Mercado Livre não configurado para esta empresa",
        );
      await this.database.$executeRaw(Prisma.sql`
        UPDATE system_unit SET ml_state=${state}, ml_used_at=NULL WHERE id=${unitId}
      `);
      url = new URL("https://auth.mercadolivre.com.br/authorization");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", credentials.mercadoLivreClientId);
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
        const rows = await transaction.$queryRaw<IdRow[]>(
          Prisma.sql`SELECT id FROM crontab_config WHERE unit_id = ${unitId} ORDER BY id LIMIT 1`,
        );
        const flags = Array.from({ length: 24 }, (_, hour) =>
          input.hours.includes(hour) ? "S" : "N",
        );
        const description =
          "Seleciona quais horas do dia as notas serão sincronizadas e enviadas automaticamente.";
        if (rows[0])
          await transaction.$executeRaw(Prisma.sql`
          UPDATE crontab_config SET descricao=${description}, metodo_chamado='onSincronizar',
            h0=${flags[0]},h1=${flags[1]},h2=${flags[2]},h3=${flags[3]},h4=${flags[4]},h5=${flags[5]},
            h6=${flags[6]},h7=${flags[7]},h8=${flags[8]},h9=${flags[9]},h10=${flags[10]},h11=${flags[11]},
            h12=${flags[12]},h13=${flags[13]},h14=${flags[14]},h15=${flags[15]},h16=${flags[16]},h17=${flags[17]},
            h18=${flags[18]},h19=${flags[19]},h20=${flags[20]},h21=${flags[21]},h22=${flags[22]},h23=${flags[23]}
          WHERE id=${rows[0].id} AND unit_id=${unitId}
        `);
        else
          await transaction.$executeRaw(Prisma.sql`
          INSERT INTO crontab_config (unit_id,descricao,metodo_chamado,h0,h1,h2,h3,h4,h5,h6,h7,h8,h9,h10,h11,h12,h13,h14,h15,h16,h17,h18,h19,h20,h21,h22,h23)
          VALUES (${unitId},${description},'onSincronizar',${flags[0]},${flags[1]},${flags[2]},${flags[3]},${flags[4]},${flags[5]},${flags[6]},${flags[7]},${flags[8]},${flags[9]},${flags[10]},${flags[11]},${flags[12]},${flags[13]},${flags[14]},${flags[15]},${flags[16]},${flags[17]},${flags[18]},${flags[19]},${flags[20]},${flags[21]},${flags[22]},${flags[23]})
        `);
      }
      if (input.kind === "apchat") {
        const rows = await transaction.$queryRaw<IdRow[]>(
          Prisma.sql`SELECT id FROM ap_chat WHERE unit_id=${unitId} ORDER BY id DESC LIMIT 1`,
        );
        const token = input.token ?? null;
        if (!rows[0] && !token)
          throw new BadRequestException(
            "Informe o token na primeira configuração do APChat",
          );
        if (rows[0])
          await transaction.$executeRaw(Prisma.sql`
          UPDATE ap_chat SET uuid=${input.uuid}, token=COALESCE(${token}, token), num_envio=${input.sendNumber},
            num_relatorio=${input.reportNumber}, num_teste=${input.testNumber}, msg=${input.messagesOpen ? "S" : "N"}
          WHERE id=${rows[0].id} AND unit_id=${unitId}
        `);
        else
          await transaction.$executeRaw(Prisma.sql`
          INSERT INTO ap_chat (unit_id,uuid,token,num_envio,num_relatorio,num_teste,msg)
          VALUES (${unitId},${input.uuid},${token},${input.sendNumber},${input.reportNumber},${input.testNumber},${input.messagesOpen ? "S" : "N"})
        `);
      }
      if (input.kind === "satisfaction") {
        const rows = await transaction.$queryRaw<IdRow[]>(
          Prisma.sql`SELECT id FROM pesquisa_satisfacao WHERE unit_id=${unitId} ORDER BY id LIMIT 1`,
        );
        if (rows[0])
          await transaction.$executeRaw(Prisma.sql`
          UPDATE pesquisa_satisfacao SET habilitar=${input.enabled ? "S" : "N"}, tempo_dia_env=${input.daysAfterShipping},
            tempo_hora_env=${input.hour}, link=${input.link}, msg=${input.message} WHERE id=${rows[0].id} AND unit_id=${unitId}
        `);
        else
          await transaction.$executeRaw(Prisma.sql`
          INSERT INTO pesquisa_satisfacao (habilitar,tempo_dia_env,tempo_hora_env,msg,link,unit_id)
          VALUES (${input.enabled ? "S" : "N"},${input.daysAfterShipping},${input.hour},${input.message},${input.link},${unitId})
        `);
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
        FROM view_nfe
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
        FROM view_nfe
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

  private unit(principal: AuthPrincipal): number {
    if (principal.tenantDemo || principal.legacyUnitId === null) {
      throw new BadRequestException(
        "Empresa autenticada ainda não possui vínculo com o banco legado",
      );
    }
    return principal.legacyUnitId;
  }

  private tokenStatus(row: LegacyTokenRow | undefined): string {
    if (!row?.configured) return "Não configurado";
    if (row.status === "S") return "Conectado";
    if (row.status === "R") return "Renovando token";
    if (row.status === "N") return "Reconexão necessária";
    return "Estado não identificado";
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
      return {};
    case "apchat.deliver":
      return {
        recipient: input.recipient,
        body: input.body,
        idempotencyKey,
      };
  }
}
