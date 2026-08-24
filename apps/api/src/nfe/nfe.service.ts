import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  integrationJobSchema,
  nfeBulkActionResponseSchema,
  nfeDetailResponseSchema,
  invoiceFilterOptionsResponseSchema,
  nfeListResponseSchema,
  nfeSyncResponseSchema,
  type NfeBulkActionResponse,
  type NfeContactUpdateInput,
  type NfeDetailResponse,
  type InvoiceFilterOptionsResponse,
  type NfeListQuery,
  type NfeListResponse,
  type NfeSyncResponse,
} from "@integrador/contracts";
import { Prisma, type DatabaseClient } from "@integrador/db";
import type { Queue } from "bullmq";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";
import { INTEGRATION_QUEUE_CLIENT } from "../queue/queue.constants.js";

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

interface InvoiceFilterOptionRow {
  value: string;
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
  custoTotal: string;
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
  cfop: string | null;
  quantidade: string;
  desconto: string;
  frete: string;
  outrasDespesas: string;
  vendaLiquida: string;
  custoLiquido: string;
  impostos: string;
  lucro: string;
  margemLucro: string;
  creditoIpi: string;
  creditoIcms: string;
  inconsistencia: string | null;
}

interface LegacyContactRow {
  id: number;
  blingId: string;
  name: string;
  documentNumber: string | null;
  stateRegistration: string | null;
  identityDocument: string | null;
  phone: string | null;
  contactPhone: string | null;
  mobilePhone: string | null;
  email: string | null;
  messagingDisabled: boolean;
  street: string | null;
  addressNumber: string | null;
  complement: string | null;
  district: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
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

interface ProductLinkRow {
  id: number;
  blingProductId: string | null;
  cost: string;
}

interface NfeActionRow {
  id: number;
  blingId: string;
  numero: string;
  fiscalStatus: number;
  statusId: number | null;
  envioDesabilitado: boolean;
  celular: string | null;
}

interface FinancialComponentRow {
  label: string;
  value: string;
  rate: string | null;
  items: number;
}

interface FinancialTaxComponentRow extends FinancialComponentRow {
  baseValue: string | null;
  cst: string | null;
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
    const where = this.where(principal.activeTenantId, query);
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
        FROM invoice_overview
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ${query.pageSize}
        OFFSET ${offset}
      `),
      this.database.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM invoice_overview
        WHERE ${where}
      `),
      this.database.$queryRaw<StatusCountRow[]>(Prisma.sql`
        SELECT
          CASE n.invoice_message_status WHEN 'sent' THEN 1 WHEN 'pending' THEN 2 WHEN 'failed' THEN 3 ELSE 4 END AS "statusId",
          CASE n.invoice_message_status WHEN 'sent' THEN 'Enviada' WHEN 'pending' THEN 'Pendente' WHEN 'failed' THEN 'Falhou' ELSE 'Ignorada' END AS label,
          COUNT(*)::bigint AS total
        FROM nfe n
        WHERE n.unit_id = ${principal.activeTenantId}
        GROUP BY n.invoice_message_status
        ORDER BY "statusId"
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

  async filterOptions(
    principal: AuthPrincipal,
  ): Promise<InvoiceFilterOptionsResponse> {
    if (principal.tenantDemo) {
      throw new BadRequestException(
        "A demonstração pública não consulta dados de NF-e na API",
      );
    }
    const unitId = principal.activeTenantId;
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

  async detail(
    principal: AuthPrincipal,
    id: number,
    includeFinancial = false,
  ): Promise<NfeDetailResponse> {
    if (principal.tenantDemo)
      throw new BadRequestException(
        "Recurso indisponível na demonstração pública",
      );
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
        CASE n.invoice_message_status WHEN 'sent' THEN 'Enviada' WHEN 'pending' THEN 'Pendente' WHEN 'failed' THEN 'Falhou' ELSE 'Ignorada' END AS "statusEnvio",
        NULLIF(BTRIM(n.obs_envio), '') AS "observacaoEnvio",
        NULLIF(BTRIM(n.link_xml), '') AS "linkXml",
        NULLIF(BTRIM(n.link_pdf), '') AS "linkPdf",
        NULLIF(BTRIM(n.codigo_rastreio), '') AS "codigoRastreio",
        NULLIF(BTRIM(n.codigo_rastreio2), '') AS "codigoRastreio2",
        n.data_nota_envio AS "dataEnvio",
        CASE n.calculation_status WHEN 'calculated' THEN 'S' WHEN 'inconsistent' THEN 'I' ELSE 'N' END AS calculo,
        NULLIF(BTRIM(n.obs_calculo), '') AS "observacaoCalculo",
        ROUND(COALESCE(n.valor, 0)::numeric, 2)::text AS valor,
        ROUND(COALESCE(n.custo_total, 0)::numeric, 2)::text AS "custoTotal",
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
      WHERE n.id = ${id} AND n.unit_id = ${principal.activeTenantId}
      LIMIT 1
    `);
    const invoice = rows[0];
    if (!invoice)
      throw new NotFoundException("NF-e não encontrada para esta empresa");
    const [items, boletos, contacts] = await Promise.all([
      this.database.$queryRaw<LegacyNfeItemRow[]>(Prisma.sql`
        SELECT
          ni.id,
          ni.n_item AS item,
          ni.id_produto::text AS "produtoId",
          COALESCE(NULLIF(BTRIM(p.nome), ''), CONCAT('Produto ', COALESCE(ni.id_produto::text, 'não identificado'))) AS nome,
          NULLIF(BTRIM(p.codigo), '') AS codigo,
          ni.cfop::text AS cfop,
          COALESCE(ni.qnt, 0)::numeric::text AS quantidade,
          ROUND(COALESCE(ni.desconto, 0)::numeric, 2)::text AS desconto,
          ROUND(COALESCE(ni.frete, 0)::numeric, 2)::text AS frete,
          ROUND(COALESCE(ni.outras_despesas, 0)::numeric, 2)::text AS "outrasDespesas",
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
        WHERE ni.nfe_id = ${id} AND ni.unit_id = ${principal.activeTenantId}
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
        WHERE nfe_id_bling = ${invoice.blingId} AND unit_id = ${principal.activeTenantId}
        ORDER BY vencimento NULLS LAST, id
      `),
      this.database.$queryRaw<LegacyContactRow[]>(Prisma.sql`
        SELECT
          p.id,
          p.id_bling::text AS "blingId",
          p.nome AS name,
          NULLIF(BTRIM(p.numero_documento), '') AS "documentNumber",
          NULLIF(BTRIM(p.ie), '') AS "stateRegistration",
          NULLIF(BTRIM(p.rg), '') AS "identityDocument",
          NULLIF(BTRIM(p.telefone), '') AS phone,
          NULLIF(BTRIM(p.telefone_contato), '') AS "contactPhone",
          NULLIF(BTRIM(p.celular), '') AS "mobilePhone",
          NULLIF(BTRIM(p.email), '') AS email,
          p.desabilitar_envio AS "messagingDisabled",
          NULLIF(BTRIM(a.endereco), '') AS street,
          NULLIF(BTRIM(a.numero), '') AS "addressNumber",
          NULLIF(BTRIM(a.complemento), '') AS complement,
          NULLIF(BTRIM(a.bairro), '') AS district,
          NULLIF(BTRIM(a.cep), '') AS "postalCode",
          NULLIF(BTRIM(a.municipio), '') AS city,
          NULLIF(BTRIM(a.uf), '') AS state
        FROM nfe n
        JOIN pessoa p ON p.id_bling = n.contato_id_bling AND p.unit_id = n.unit_id
        LEFT JOIN LATERAL (
          SELECT pe.* FROM pessoa_endereco pe
          WHERE pe.pessoa_id = p.id AND pe.unit_id = p.unit_id
          ORDER BY pe.primary DESC, pe.id LIMIT 1
        ) a ON TRUE
        WHERE n.id = ${id} AND n.unit_id = ${principal.activeTenantId}
        LIMIT 1
      `),
    ]);
    const [costComponents, taxComponents, feeComponents, creditComponents] =
      includeFinancial
        ? await Promise.all([
            this.database.$queryRaw<FinancialComponentRow[]>(Prisma.sql`
              SELECT
                COALESCE(NULLIF(BTRIM(ci.nome), ''), NULLIF(BTRIM(cf.nome), ''), 'Custo configurado') AS label,
                ROUND(SUM(ci.valor)::numeric, 2)::text AS value,
                CASE WHEN COUNT(DISTINCT ci.aliquota) = 1
                  THEN ROUND(MAX(ci.aliquota)::numeric, 4)::text ELSE NULL END AS rate,
                COUNT(DISTINCT ci.nfe_item_id)::int AS items
              FROM custo_item ci
              JOIN nfe_item ni ON ni.id = ci.nfe_item_id AND ni.unit_id = ci.unit_id
              LEFT JOIN custo_fixo cf ON cf.id = ci.custo_fixo_id AND cf.unit_id = ci.unit_id
              WHERE ni.nfe_id = ${id} AND ni.unit_id = ${principal.activeTenantId}
              GROUP BY COALESCE(NULLIF(BTRIM(ci.nome), ''), NULLIF(BTRIM(cf.nome), ''), 'Custo configurado')
              ORDER BY label
            `),
            this.database.$queryRaw<FinancialTaxComponentRow[]>(Prisma.sql`
              SELECT
                COALESCE(NULLIF(BTRIM(ti.nome), ''), NULLIF(BTRIM(t.nome), ''), 'Imposto configurado') AS label,
                ROUND(SUM(ti.valor)::numeric, 2)::text AS value,
                CASE WHEN COUNT(DISTINCT ti.aliquota) = 1
                  THEN ROUND(MAX(ti.aliquota)::numeric, 4)::text ELSE NULL END AS rate,
                CASE WHEN SUM(ti.valor_base) <> 0
                  THEN ROUND(SUM(ti.valor_base)::numeric, 2)::text ELSE NULL END AS "baseValue",
                CASE WHEN COUNT(DISTINCT ti.cst) = 1 THEN MAX(ti.cst) ELSE NULL END AS cst,
                COUNT(DISTINCT ti.nfe_item_id)::int AS items
              FROM tributacao_item ti
              JOIN nfe_item ni ON ni.id = ti.nfe_item_id AND ni.unit_id = ti.unit_id
              LEFT JOIN tributacao t ON t.id = ti.tributacao_id AND t.unit_id = ti.unit_id
              WHERE ni.nfe_id = ${id} AND ni.unit_id = ${principal.activeTenantId}
                AND UPPER(COALESCE(NULLIF(BTRIM(ti.nome), ''), NULLIF(BTRIM(t.nome), ''))) NOT IN
                  ('CBS', 'IBS', 'IBSUF', 'IBSMUN')
              GROUP BY COALESCE(NULLIF(BTRIM(ti.nome), ''), NULLIF(BTRIM(t.nome), ''), 'Imposto configurado')
              ORDER BY label
            `),
            this.database.$queryRaw<FinancialComponentRow[]>(Prisma.sql`
              SELECT
                COALESCE(NULLIF(BTRIM(fi.nome), ''), NULLIF(BTRIM(cf.nome), ''), 'Taxa configurada') AS label,
                ROUND(SUM(fi.valor)::numeric, 2)::text AS value,
                CASE WHEN COUNT(DISTINCT fi.aliquota) = 1
                  THEN ROUND(MAX(fi.aliquota)::numeric, 4)::text ELSE NULL END AS rate,
                COUNT(DISTINCT fi.nfe_item_id)::int AS items
              FROM taxa_item fi
              JOIN nfe_item ni ON ni.id = fi.nfe_item_id AND ni.unit_id = fi.unit_id
              LEFT JOIN custo_fixo cf ON cf.id = fi.custo_fixo_id AND cf.unit_id = fi.unit_id
              WHERE ni.nfe_id = ${id} AND ni.unit_id = ${principal.activeTenantId}
              GROUP BY COALESCE(NULLIF(BTRIM(fi.nome), ''), NULLIF(BTRIM(cf.nome), ''), 'Taxa configurada')
              ORDER BY label
            `),
            this.database.$queryRaw<FinancialComponentRow[]>(Prisma.sql`
              SELECT
                COALESCE(NULLIF(BTRIM(cr.nome), ''), NULLIF(BTRIM(cf.nome), ''), 'Crédito configurado') AS label,
                ROUND(SUM(cr.valor)::numeric, 2)::text AS value,
                CASE WHEN COUNT(DISTINCT cr.aliquota) = 1
                  THEN ROUND(MAX(cr.aliquota)::numeric, 4)::text ELSE NULL END AS rate,
                COUNT(DISTINCT cr.nfe_item_id)::int AS items
              FROM credito_item cr
              JOIN nfe_item ni ON ni.id = cr.nfe_item_id AND ni.unit_id = cr.unit_id
              LEFT JOIN custo_fixo cf ON cf.id = cr.custo_fixo_id AND cf.unit_id = cr.unit_id
              WHERE ni.nfe_id = ${id} AND ni.unit_id = ${principal.activeTenantId}
              GROUP BY COALESCE(NULLIF(BTRIM(cr.nome), ''), NULLIF(BTRIM(cf.nome), ''), 'Crédito configurado')
              ORDER BY label
            `),
          ])
        : [[], [], [], []];
    const contact = contacts[0];
    const financialBreakdown = includeFinancial
      ? buildFinancialBreakdown(
          invoice,
          costComponents,
          taxComponents,
          feeComponents,
          creditComponents,
        )
      : null;
    return nfeDetailResponseSchema.parse({
      invoice: {
        ...invoice,
        ...(includeFinancial
          ? {}
          : {
              vendaLiquida: "0.00",
              custoLiquido: "0.00",
              impostos: "0.00",
              taxa: "0.00",
              outrasDespesas: "0.00",
              creditoIpi: "0.00",
              creditoIcms: "0.00",
              lucro: "0.00",
              margemLucro: "0.00",
              calculo: null,
              observacaoCalculo: null,
            }),
        dataEnvio: invoice.dataEnvio?.toISOString() ?? null,
      },
      items: items.map((item) =>
        includeFinancial
          ? item
          : {
              ...item,
              vendaLiquida: "0.00",
              desconto: "0.00",
              frete: "0.00",
              outrasDespesas: "0.00",
              custoLiquido: "0.00",
              impostos: "0.00",
              lucro: "0.00",
              margemLucro: "0.00",
              creditoIpi: "0.00",
              creditoIcms: "0.00",
            },
      ),
      boletos,
      contact: contact
        ? {
            id: contact.id,
            blingId: contact.blingId,
            name: contact.name,
            documentNumber: contact.documentNumber,
            stateRegistration: contact.stateRegistration,
            identityDocument: contact.identityDocument,
            phone: contact.phone,
            contactPhone: contact.contactPhone,
            mobilePhone: contact.mobilePhone,
            email: contact.email,
            messagingDisabled: contact.messagingDisabled,
            address:
              contact.street || contact.city || contact.state
                ? {
                    street: contact.street,
                    number: contact.addressNumber,
                    complement: contact.complement,
                    district: contact.district,
                    postalCode: contact.postalCode,
                    city: contact.city,
                    state: contact.state,
                  }
                : null,
          }
        : null,
      financialBreakdown,
    });
  }

  async enqueueContactUpdate(
    principal: AuthPrincipal,
    nfeId: number,
    input: NfeContactUpdateInput,
  ): Promise<NfeSyncResponse> {
    const rows = await this.database.$queryRaw<
      Array<{ blingId: string; contactId: number; contactBlingId: string }>
    >(Prisma.sql`
      SELECT n.id_bling::text AS "blingId", p.id AS "contactId",
             p.id_bling::text AS "contactBlingId"
      FROM nfe n
      JOIN pessoa p ON p.id_bling = n.contato_id_bling AND p.unit_id = n.unit_id
      WHERE n.id = ${nfeId} AND n.unit_id = ${principal.activeTenantId}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row)
      throw new NotFoundException(
        "Contato da NF-e não encontrado nesta empresa",
      );
    return this.enqueueActionJob(
      principal,
      nfeId,
      row.blingId,
      "contact.update",
      "contact.update.queued",
      {
        nfeId,
        contactId: row.contactId,
        contactBlingId: row.contactBlingId,
        mobilePhone: input.mobilePhone,
        messagingDisabled: input.messagingDisabled,
      },
    );
  }

  async enqueueDetails(
    principal: AuthPrincipal,
    nfeId: number,
  ): Promise<NfeSyncResponse> {
    if (principal.tenantDemo)
      throw new BadRequestException(
        "Recurso indisponível na demonstração pública",
      );
    const invoices = await this.database.$queryRaw<BlingIdRow[]>(Prisma.sql`
      SELECT id_bling::text AS "blingId"
      FROM nfe
      WHERE id = ${nfeId} AND unit_id = ${principal.activeTenantId}
      LIMIT 1
    `);
    if (!invoices[0])
      throw new NotFoundException("NF-e não encontrada para esta empresa");

    return this.enqueueActionJob(
      principal,
      nfeId,
      invoices[0].blingId,
      "nfe.sync-details",
      "nfe.details.queued",
    );
  }

  async normalizeItem(
    principal: AuthPrincipal,
    nfeId: number,
    itemId: number,
    productId: number,
  ): Promise<NfeSyncResponse> {
    if (principal.tenantDemo)
      throw new BadRequestException(
        "Recurso indisponível na demonstração pública",
      );

    const [invoices, products] = await Promise.all([
      this.database.$queryRaw<BlingIdRow[]>(Prisma.sql`
        SELECT n.id_bling::text AS "blingId"
        FROM nfe n
        JOIN nfe_item ni
          ON ni.nfe_id = n.id
         AND ni.unit_id = n.unit_id
        WHERE n.id = ${nfeId}
          AND ni.id = ${itemId}
          AND n.unit_id = ${principal.activeTenantId}
        LIMIT 1
      `),
      this.database.$queryRaw<ProductLinkRow[]>(Prisma.sql`
        SELECT id,
               id_produto::text AS "blingProductId",
               COALESCE(custo, 0)::numeric::text AS cost
        FROM produtos
        WHERE id = ${productId}
          AND unit_id = ${principal.activeTenantId}
        LIMIT 1
      `),
    ]);
    const invoice = invoices[0];
    const product = products[0];
    if (!invoice) throw new NotFoundException("Item da NF-e não encontrado");
    if (!product)
      throw new NotFoundException("Produto não encontrado para esta empresa");

    await this.database.$transaction([
      this.database.$executeRaw(Prisma.sql`
        UPDATE nfe_item
        SET produtos_id = ${product.id},
            id_produto = ${product.blingProductId},
            custo_unitario = ${product.cost}::numeric,
            custo_total = COALESCE(qnt, 0) * ${product.cost}::numeric,
            inconsistencia = NULL
        WHERE id = ${itemId}
          AND nfe_id = ${nfeId}
          AND unit_id = ${principal.activeTenantId}
      `),
      this.database.$executeRaw(Prisma.sql`
        UPDATE nfe
        SET calculation_status = 'pending',
            obs_calculo = 'Recálculo enfileirado após vínculo manual de produto'
        WHERE id = ${nfeId} AND unit_id = ${principal.activeTenantId}
      `),
    ]);
    await this.database.auditLog.create({
      data: {
        tenantId: principal.activeTenantId,
        actorUserId: principal.userId,
        action: "nfe.item.normalized",
        entityType: "nfe_item",
        entityId: String(itemId),
        correlationId: randomUUID(),
        metadata: { nfeId, productId },
      },
    });
    return this.enqueueActionJob(
      principal,
      nfeId,
      invoice.blingId,
      "nfe.process-xml",
      "nfe.recalculation.queued",
    );
  }

  async enqueueBulkDetails(
    principal: AuthPrincipal,
    rawIds: number[],
  ): Promise<NfeBulkActionResponse> {
    const rows = await this.actionRows(principal, rawIds);
    const cancelled = rows.filter((row) => row.fiscalStatus === 2);
    if (cancelled.length > 0) {
      throw new BadRequestException(
        `NF-e cancelada não pode ser ressincronizada: ${cancelled.map((row) => row.numero).join(", ")}`,
      );
    }
    const queued: NfeSyncResponse[] = [];
    for (const row of rows) {
      queued.push(
        await this.enqueueActionJob(
          principal,
          row.id,
          row.blingId,
          "nfe.sync-details",
          "nfe.details.queued",
        ),
      );
    }
    return nfeBulkActionResponseSchema.parse({ queued, skipped: [] });
  }

  async enqueueBulkDelivery(
    principal: AuthPrincipal,
    rawIds: number[],
  ): Promise<NfeBulkActionResponse> {
    const rows = await this.actionRows(principal, rawIds);
    const invalidStatus = rows.filter((row) => row.statusId !== 2);
    if (invalidStatus.length > 0) {
      throw new BadRequestException(
        `Selecione apenas NF-e prontas para envio: ${invalidStatus.map((row) => row.numero).join(", ")}`,
      );
    }

    const eligible = rows.filter(
      (row) => !row.envioDesabilitado && Boolean(row.celular?.trim()),
    );
    const skipped = rows
      .filter((row) => !eligible.includes(row))
      .map((row) => ({
        id: row.id,
        reason: row.envioDesabilitado
          ? "Mensagens desabilitadas para o contato"
          : "Contato sem celular",
      }));
    if (eligible.length === 0) {
      throw new BadRequestException(
        "Nenhuma NF-e selecionada possui contato habilitado com celular",
      );
    }

    const queued: NfeSyncResponse[] = [];
    for (const row of eligible) {
      queued.push(
        await this.enqueueActionJob(
          principal,
          row.id,
          row.blingId,
          "nfe.deliver",
          "nfe.delivery.queued",
        ),
      );
    }
    return nfeBulkActionResponseSchema.parse({ queued, skipped });
  }

  private async actionRows(
    principal: AuthPrincipal,
    rawIds: number[],
  ): Promise<NfeActionRow[]> {
    if (principal.tenantDemo)
      throw new BadRequestException(
        "Recurso indisponível na demonstração pública",
      );
    const ids = [...new Set(rawIds)];
    const rows = await this.database.$queryRaw<NfeActionRow[]>(Prisma.sql`
      SELECT
        n.id,
        n.id_bling::text AS "blingId",
        n.numero::text AS numero,
        n.situacao AS "fiscalStatus",
        CASE n.invoice_message_status WHEN 'sent' THEN 1 WHEN 'pending' THEN 2 WHEN 'failed' THEN 3 ELSE 4 END AS "statusId",
        COALESCE(p.desabilitar_envio, false) AS "envioDesabilitado",
        NULLIF(BTRIM(p.celular), '') AS celular
      FROM nfe n
      LEFT JOIN pessoa p
        ON p.id_bling = n.contato_id_bling
       AND p.unit_id = n.unit_id
      WHERE n.unit_id = ${principal.activeTenantId}
        AND n.id IN (${Prisma.join(ids)})
      ORDER BY n.id
    `);
    if (rows.length !== ids.length)
      throw new NotFoundException(
        "Uma ou mais NF-e não foram encontradas para esta empresa",
      );
    return rows;
  }

  private async enqueueActionJob(
    principal: AuthPrincipal,
    nfeId: number,
    blingId: string,
    jobType:
      "nfe.sync-details" | "nfe.deliver" | "nfe.process-xml" | "contact.update",
    auditAction:
      | "nfe.details.queued"
      | "nfe.delivery.queued"
      | "nfe.recalculation.queued"
      | "contact.update.queued",
    payload: Record<string, unknown> = { nfeId },
  ): Promise<NfeSyncResponse> {
    const id = randomUUID();
    const correlationId = randomUUID();
    const job = integrationJobSchema.parse({
      tenantId: principal.activeTenantId,
      jobType,
      correlationId,
      requestedBy: principal.userId,
      payload,
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
        action: auditAction,
        entityType: "nfe",
        entityId: String(nfeId),
        correlationId,
        metadata: { blingId },
      },
    });
    return nfeSyncResponseSchema.parse({
      id,
      correlationId,
      jobType,
      status: "queued",
    });
  }

  private where(unitId: string, query: NfeListQuery): Prisma.Sql {
    const filters: Prisma.Sql[] = [Prisma.sql`unit_id = ${unitId}`];
    if (query.numero) filters.push(Prisma.sql`numero = ${query.numero}`);
    if (query.serie !== undefined)
      filters.push(Prisma.sql`serie = ${query.serie}`);
    if (query.nome) filters.push(Prisma.sql`nome ILIKE ${`%${query.nome}%`}`);
    if (query.tipoVenda)
      filters.push(Prisma.sql`tipo_venda = ${query.tipoVenda}`);
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

function buildFinancialBreakdown(
  invoice: LegacyNfeDetailRow,
  costComponents: FinancialComponentRow[],
  taxComponents: FinancialTaxComponentRow[],
  feeComponents: FinancialComponentRow[],
  configuredCredits: FinancialComponentRow[],
) {
  const configuredCreditTotal = sumComponents(configuredCredits);
  const statutoryIcmsCredit = Math.max(
    0,
    decimal(invoice.creditoIcms) - configuredCreditTotal,
  );
  const credits = [
    ...(decimal(invoice.creditoIpi) !== 0
      ? [
          {
            label: "Crédito de IPI",
            value: moneyValue(invoice.creditoIpi),
            rate: null,
            items: 0,
          },
        ]
      : []),
    ...(statutoryIcmsCredit !== 0
      ? [
          {
            label: "Crédito de ICMS",
            value: moneyValue(statutoryIcmsCredit),
            rate: null,
            items: 0,
          },
        ]
      : []),
    ...configuredCredits,
  ];
  const costSubtotal =
    decimal(invoice.custoTotal) +
    sumComponents(costComponents) -
    sumComponents(credits);
  const taxSubtotal = sumComponents(taxComponents);
  const feeSubtotal = sumComponents(feeComponents);

  return {
    costs: {
      productCost: moneyValue(invoice.custoTotal),
      additions: costComponents,
      credits,
      adjustment: moneyValue(decimal(invoice.custoLiquido) - costSubtotal),
      total: moneyValue(invoice.custoLiquido),
    },
    taxes: {
      items: taxComponents,
      adjustment: moneyValue(decimal(invoice.impostos) - taxSubtotal),
      total: moneyValue(invoice.impostos),
    },
    fees: {
      items: feeComponents,
      adjustment: moneyValue(decimal(invoice.taxa) - feeSubtotal),
      total: moneyValue(invoice.taxa),
    },
    profit: {
      revenue: moneyValue(invoice.vendaLiquida),
      deductions: [
        { label: "Outras despesas", value: moneyValue(invoice.outrasDespesas) },
        { label: "Frete", value: moneyValue(invoice.frete) },
        { label: "Custos líquidos", value: moneyValue(invoice.custoLiquido) },
        { label: "Impostos", value: moneyValue(invoice.impostos) },
        { label: "Taxas", value: moneyValue(invoice.taxa) },
      ].filter((entry) => decimal(entry.value) !== 0),
      total: moneyValue(invoice.lucro),
    },
  };
}

function sumComponents(
  components: Array<{ value: string }>,
): number {
  return components.reduce((sum, component) => sum + decimal(component.value), 0);
}

function decimal(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyValue(value: string | number): string {
  const rounded = Math.round((decimal(value) + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2);
}
