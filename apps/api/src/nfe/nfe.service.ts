import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  integrationJobSchema,
  nfeDetailResponseSchema,
  nfeListResponseSchema,
  nfeSyncResponseSchema,
  type NfeDetailResponse,
  type NfeListQuery,
  type NfeListResponse,
  type NfeSyncResponse,
} from "@integrador/contracts";
import { Prisma, type DatabaseClient } from "@integrador/db";
import type { Queue } from "bullmq";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";
import { INTEGRATION_QUEUE_CLIENT } from "../queue/queue.module.js";

interface LegacyNfeRow {
  id: number;
  blingId: string;
  numero: string;
  serie: number | null;
  nome: string;
  envioDesabilitado: boolean;
  valor: string;
  dataEmissao: string | null;
  linkPdf: string | null;
  codigoRastreio: string | null;
  statusEnvio: string;
  statusId: number | null;
  observacaoEnvio: string | null;
  temBoleto: boolean;
  temCodigo: boolean;
}

interface CountRow {
  total: bigint;
}

interface StatusCountRow {
  statusId: number | null;
  label: string | null;
  total: bigint;
}

interface LegacyNfeDetailRow {
  id: number;
  blingId: string;
  numero: string;
  serie: number | null;
  chaveAcesso: string | null;
  naturezaOperacao: string | null;
  dataEmissao: string | null;
  cliente: string;
  vendedor: string | null;
  canalVenda: string | null;
  statusEnvio: string;
  observacaoEnvio: string | null;
  linkXml: string | null;
  linkPdf: string | null;
  codigoRastreio: string | null;
  codigoRastreio2: string | null;
  dataEnvio: Date | null;
  calculo: string | null;
  observacaoCalculo: string | null;
  valor: string;
  vendaLiquida: string;
  custoLiquido: string;
  impostos: string;
  frete: string;
  desconto: string;
  taxa: string;
  outrasDespesas: string;
  creditoIpi: string;
  creditoIcms: string;
  lucro: string;
  margemLucro: string;
}

interface LegacyNfeItemRow {
  id: number;
  item: number | null;
  produtoId: string | null;
  nome: string;
  codigo: string | null;
  cfop: number | null;
  quantidade: string;
  vendaLiquida: string;
  custoLiquido: string;
  impostos: string;
  lucro: string;
  margemLucro: string;
  creditoIpi: string;
  creditoIcms: string;
  inconsistencia: string | null;
}

interface LegacyBoletoRow {
  id: number;
  numeroExterno: string | null;
  vencimento: string | null;
  valor: string;
  situacao: number | null;
  link: string | null;
}

interface BlingIdRow {
  blingId: string;
}

@Injectable()
export class NfeService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
    @Inject(INTEGRATION_QUEUE_CLIENT) private readonly queue: Queue,
  ) {}

  async list(
    principal: AuthPrincipal,
    query: NfeListQuery,
  ): Promise<NfeListResponse> {
    if (principal.tenantDemo) {
      throw new BadRequestException(
        "A demonstração pública não consulta dados de NF-e na API",
      );
    }
    if (principal.legacyUnitId === null) {
      throw new BadRequestException(
        "Tenant real ainda não possui vínculo legacyUnitId",
      );
    }

    const where = this.where(principal.legacyUnitId, query);
    const order = this.order(query);
    const offset = (query.page - 1) * query.pageSize;

    const [items, totals, statusRows] = await Promise.all([
      this.database.$queryRaw<LegacyNfeRow[]>(Prisma.sql`
        SELECT
          id,
          id_bling::text AS "blingId",
          numero::text AS numero,
          serie,
          COALESCE(nome, 'Cliente não identificado') AS nome,
          envio = 'S' AS "envioDesabilitado",
          ROUND(COALESCE(valor, 0)::numeric, 2)::text AS valor,
          TO_CHAR(data_emissao, 'YYYY-MM-DD') AS "dataEmissao",
          NULLIF(BTRIM(link_pdf), '') AS "linkPdf",
          NULLIF(BTRIM(codigo_rastreio), '') AS "codigoRastreio",
          COALESCE(status_envio, 'Indefinido') AS "statusEnvio",
          status_envio_id AS "statusId",
          obs_envio AS "observacaoEnvio",
          tem_boleto = 'S' AS "temBoleto",
          tem_cod = 'S' AS "temCodigo"
        FROM view_nfe
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ${query.pageSize}
        OFFSET ${offset}
      `),
      this.database.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM view_nfe
        WHERE ${where}
      `),
      this.database.$queryRaw<StatusCountRow[]>(Prisma.sql`
        SELECT
          n.status_envio_id AS "statusId",
          s.status AS label,
          COUNT(*)::bigint AS total
        FROM nfe n
        LEFT JOIN status_envio s ON s.id = n.status_envio_id
        WHERE n.unit_id = ${principal.legacyUnitId}
        GROUP BY n.status_envio_id, s.status
        ORDER BY n.status_envio_id
      `),
    ]);

    const total = Number(totals[0]?.total ?? 0n);
    return nfeListResponseSchema.parse({
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
      statusCounts: statusRows.map((row) => ({
        statusId: row.statusId,
        label: row.label ?? "Indefinido",
        count: Number(row.total),
      })),
    });
  }

  async detail(
    principal: AuthPrincipal,
    id: number,
  ): Promise<NfeDetailResponse> {
    if (principal.tenantDemo || principal.legacyUnitId === null)
      throw new BadRequestException("Empresa sem vínculo com o banco legado");
    const rows = await this.database.$queryRaw<LegacyNfeDetailRow[]>(Prisma.sql`
      SELECT
        n.id,
        n.id_bling::text AS "blingId",
        n.numero::text AS numero,
        n.serie,
        NULLIF(BTRIM(n.chave_acesso), '') AS "chaveAcesso",
        NULLIF(BTRIM(n.natureza_operacao_id), '') AS "naturezaOperacao",
        TO_CHAR(n.data_emissao, 'YYYY-MM-DD') AS "dataEmissao",
        COALESCE(NULLIF(BTRIM(p.nome), ''), 'Cliente não identificado') AS cliente,
        NULLIF(BTRIM(v.nome), '') AS vendedor,
        NULLIF(BTRIM(cv.descricao), '') AS "canalVenda",
        COALESCE(se.status, 'Indefinido') AS "statusEnvio",
        NULLIF(BTRIM(oe.obs), '') AS "observacaoEnvio",
        NULLIF(BTRIM(n.link_xml), '') AS "linkXml",
        NULLIF(BTRIM(n.link_pdf), '') AS "linkPdf",
        NULLIF(BTRIM(n.codigo_rastreio), '') AS "codigoRastreio",
        NULLIF(BTRIM(n.codigo_rastreio2), '') AS "codigoRastreio2",
        n.data_nota_envio AS "dataEnvio",
        n.tem_calculo AS calculo,
        NULLIF(BTRIM(n.obs_calculo), '') AS "observacaoCalculo",
        ROUND(COALESCE(n.valor, 0)::numeric, 2)::text AS valor,
        ROUND(COALESCE(n.venda_liquido, 0)::numeric, 2)::text AS "vendaLiquida",
        ROUND(COALESCE(n.custo_liquido, 0)::numeric, 2)::text AS "custoLiquido",
        ROUND(COALESCE(n.impostos, 0)::numeric, 2)::text AS impostos,
        ROUND(COALESCE(n.frete, 0)::numeric, 2)::text AS frete,
        ROUND(COALESCE(n.desconto, 0)::numeric, 2)::text AS desconto,
        ROUND(COALESCE(n.taxa, 0)::numeric, 2)::text AS taxa,
        ROUND(COALESCE(n.outras_despesas, 0)::numeric, 2)::text AS "outrasDespesas",
        ROUND(COALESCE(n.credito_ipi, 0)::numeric, 2)::text AS "creditoIpi",
        ROUND(COALESCE(n.credito_icms, 0)::numeric, 2)::text AS "creditoIcms",
        ROUND(COALESCE(n.lucro, 0)::numeric, 2)::text AS lucro,
        ROUND(COALESCE(n.margem_lucro, 0)::numeric, 2)::text AS "margemLucro"
      FROM nfe n
      LEFT JOIN pessoa p ON p.id_bling = n.contato_id_bling AND p.unit_id = n.unit_id
      LEFT JOIN vendedores v ON v.id_bling = n.vendedor_id AND v.unit_id = n.unit_id
      LEFT JOIN canal_venda cv ON cv.loja_id = n.loja_id AND cv.unit_id = n.unit_id
      LEFT JOIN status_envio se ON se.id = n.status_envio_id
      LEFT JOIN obs_envio oe ON oe.id = n.obs_envio_id
      WHERE n.id = ${id} AND n.unit_id = ${principal.legacyUnitId}
      LIMIT 1
    `);
    const invoice = rows[0];
    if (!invoice)
      throw new NotFoundException("NF-e não encontrada para esta empresa");
    const [items, boletos] = await Promise.all([
      this.database.$queryRaw<LegacyNfeItemRow[]>(Prisma.sql`
        SELECT
          ni.id,
          ni.n_item AS item,
          ni.id_produto::text AS "produtoId",
          COALESCE(NULLIF(BTRIM(p.nome), ''), CONCAT('Produto ', COALESCE(ni.id_produto::text, 'não identificado'))) AS nome,
          NULLIF(BTRIM(p.codigo), '') AS codigo,
          ni.cfop,
          COALESCE(ni.qnt, 0)::numeric::text AS quantidade,
          ROUND(COALESCE(ni.venda_liquido_total, 0)::numeric, 2)::text AS "vendaLiquida",
          ROUND(COALESCE(ni.custo_liquido_total, 0)::numeric, 2)::text AS "custoLiquido",
          ROUND(COALESCE(ni.imposto_total, 0)::numeric, 2)::text AS impostos,
          ROUND(COALESCE(ni.valor_lucro_total, 0)::numeric, 2)::text AS lucro,
          ROUND(COALESCE(ni.margem_lucro_total, 0)::numeric, 2)::text AS "margemLucro",
          ROUND(COALESCE(ni.credito_ipi, 0)::numeric, 2)::text AS "creditoIpi",
          ROUND(COALESCE(ni.credito_icms, 0)::numeric, 2)::text AS "creditoIcms",
          NULLIF(BTRIM(ni.inconsistencia), '') AS inconsistencia
        FROM nfe_item ni
        LEFT JOIN produtos p ON p.id = ni.produtos_id AND p.unit_id = ni.unit_id
        WHERE ni.nfe_id = ${id} AND ni.unit_id = ${principal.legacyUnitId}
        ORDER BY ni.n_item NULLS LAST, ni.id
      `),
      this.database.$queryRaw<LegacyBoletoRow[]>(Prisma.sql`
        SELECT
          id,
          NULLIF(BTRIM(numero_externo), '') AS "numeroExterno",
          TO_CHAR(vencimento, 'YYYY-MM-DD') AS vencimento,
          ROUND(COALESCE(valor, valor_total, 0)::numeric, 2)::text AS valor,
          situacao,
          NULLIF(BTRIM(link_boleto), '') AS link
        FROM boleto
        WHERE nfe_id_bling = ${invoice.blingId} AND unit_id = ${principal.legacyUnitId}
        ORDER BY vencimento NULLS LAST, id
      `),
    ]);
    return nfeDetailResponseSchema.parse({
      invoice: {
        ...invoice,
        dataEnvio: invoice.dataEnvio?.toISOString() ?? null,
      },
      items,
      boletos,
    });
  }

  async enqueueDetails(
    principal: AuthPrincipal,
    nfeId: number,
  ): Promise<NfeSyncResponse> {
    if (principal.tenantDemo || principal.legacyUnitId === null)
      throw new BadRequestException("Empresa sem vínculo com o banco legado");
    const invoices = await this.database.$queryRaw<BlingIdRow[]>(Prisma.sql`
      SELECT id_bling::text AS "blingId"
      FROM nfe
      WHERE id = ${nfeId} AND unit_id = ${principal.legacyUnitId}
      LIMIT 1
    `);
    if (!invoices[0])
      throw new NotFoundException("NF-e não encontrada para esta empresa");

    const id = randomUUID();
    const correlationId = randomUUID();
    const jobType = "nfe.sync-details" as const;
    const job = integrationJobSchema.parse({
      tenantId: principal.activeTenantId,
      jobType,
      correlationId,
      requestedBy: principal.userId,
      payload: { nfeId },
      createdAt: new Date().toISOString(),
    });
    await this.database.jobExecution.create({
      data: {
        id,
        tenantId: principal.activeTenantId,
        jobType,
        status: "queued",
        correlationId,
      },
    });
    try {
      await this.queue.add(jobType, job, { jobId: id });
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
        action: "nfe.details.queued",
        entityType: "nfe",
        entityId: String(nfeId),
        correlationId,
        metadata: { blingId: invoices[0].blingId },
      },
    });
    return nfeSyncResponseSchema.parse({
      id,
      correlationId,
      jobType,
      status: "queued",
    });
  }

  private where(unitId: number, query: NfeListQuery): Prisma.Sql {
    const filters: Prisma.Sql[] = [Prisma.sql`unit_id = ${unitId}`];
    if (query.numero) filters.push(Prisma.sql`numero = ${query.numero}`);
    if (query.serie !== undefined)
      filters.push(Prisma.sql`serie = ${query.serie}`);
    if (query.nome) filters.push(Prisma.sql`nome ILIKE ${`%${query.nome}%`}`);
    if (query.envio) filters.push(Prisma.sql`envio = ${query.envio}`);
    if (query.valor)
      filters.push(
        Prisma.sql`ROUND(COALESCE(valor, 0)::numeric, 2) = ${query.valor}::numeric`,
      );
    if (query.dataInicial)
      filters.push(
        Prisma.sql`data_emissao::date >= ${query.dataInicial}::date`,
      );
    if (query.dataFinal)
      filters.push(Prisma.sql`data_emissao::date <= ${query.dataFinal}::date`);
    if (query.temCodigo === "S")
      filters.push(Prisma.sql`NULLIF(BTRIM(codigo_rastreio), '') IS NOT NULL`);
    if (query.temCodigo === "N")
      filters.push(Prisma.sql`NULLIF(BTRIM(codigo_rastreio), '') IS NULL`);
    if (query.statusEnvio)
      filters.push(Prisma.sql`status_envio = ${query.statusEnvio}`);
    if (query.statusId !== undefined)
      filters.push(Prisma.sql`status_envio_id = ${query.statusId}`);
    return Prisma.join(filters, " AND ");
  }

  private order(query: NfeListQuery): Prisma.Sql {
    const column =
      query.order === "numero"
        ? Prisma.sql`numero`
        : query.order === "nome"
          ? Prisma.sql`nome`
          : query.order === "valor"
            ? Prisma.sql`valor`
            : Prisma.sql`data_emissao`;
    const direction =
      query.direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    return Prisma.sql`${column} ${direction}, id DESC`;
  }
}
