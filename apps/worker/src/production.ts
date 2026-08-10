import { BadRequestError } from "./worker-errors.js";
import { Prisma, type DatabaseClient } from "@integrador/db";
import {
  ApChatRealGateway,
  BlingOAuthHttpGateway,
  BlingRealGateway,
  BlingTokenRefreshCoordinator,
  type ApChatCredentialProvider,
  type ApChatCredentials,
  type ApChatMessage,
  type BlingAccessTokenProvider,
  type BlingClientCredentials,
  type BlingCredentialProvider,
  type BlingNfeSummary,
  type BlingProductDetail,
  type BlingProductSummary,
  type BlingRefreshAudit,
  type BlingSalesOrderDetail,
  type BlingTokenRecord,
  type BlingTokenRepository,
  type DistributedLock,
  type GatewayContext,
  type ListNfeInput,
} from "@integrador/integrations";

interface TenantTokenRow {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: bigint | number | null;
  status: string | null;
}
interface CredentialRow {
  clientId: string | null;
  clientSecret: string | null;
}
interface ApChatCredentialRow {
  uuid: string | null;
  token: string | null;
  testRecipient: string | null;
  messagesOpen: boolean;
}
interface IdRow {
  id: number;
}
interface LegacyInvoiceRow {
  id: number;
  blingId: string;
}
interface ExistsRow {
  exists: boolean;
}
interface SyncWindowRow {
  updatedFrom: string | null;
  updatedTo: string;
}

export class ProductionIntegrationProcessor {
  readonly #bling: BlingRealGateway;
  readonly #apchat: ApChatRealGateway;

  constructor(private readonly database: DatabaseClient) {
    const tokens = new LegacyBlingTokenRepository(database);
    const refresh = new BlingTokenRefreshCoordinator({
      tokens,
      credentials: new LegacyBlingCredentialProvider(database),
      lock: new PrismaAdvisoryLock(database),
      oauth: new BlingOAuthHttpGateway({ globalDemoMode: false }),
      audit: new PrismaBlingRefreshAudit(database),
    });
    this.#bling = new BlingRealGateway({
      globalDemoMode: false,
      tokenProvider: new RefreshingBlingTokenProvider(tokens, refresh),
    });
    const apchatBaseUrl = process.env["APCHAT_BASE_URL"]?.trim();
    this.#apchat = new ApChatRealGateway({
      globalDemoMode: false,
      credentials: new LegacyApChatCredentialProvider(database),
      ...(apchatBaseUrl ? { baseUrl: apchatBaseUrl } : {}),
    });
  }

  async syncNfe(
    context: GatewayContext & { demo: false },
    input: Pick<ListNfeInput, "issuedFrom" | "issuedTo">,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.database.tenant.findUnique({
      where: { id: context.tenantId },
      select: { legacyUnitId: true, demo: true, active: true },
    });
    if (!tenant?.active || tenant.demo || tenant.legacyUnitId === null)
      throw new BadRequestError("Tenant sem unidade produtiva ativa");

    const summaries: BlingNfeSummary[] = [];
    let requestedPages = 0;
    for (const status of [5, 6] as const) {
      for (let page = 1; page <= 4; page += 1) {
        requestedPages += 1;
        const items = await this.#bling.listNfe(context, {
          status,
          issuedFrom: `${input.issuedFrom} 00:00:00`,
          issuedTo: `${input.issuedTo} 23:59:59`,
          page,
          limit: 100,
        });
        summaries.push(...items);
        if (items.length < 100) break;
      }
    }

    await this.database.$transaction(async (transaction) => {
      for (const invoice of summaries) {
        const updated = await transaction.$executeRaw(Prisma.sql`
          UPDATE nfe
          SET numero = ${invoice.number},
              situacao = ${invoice.status},
              data_emissao = NULLIF(${invoice.issuedAt}, '')::timestamp,
              tipo = COALESCE(${invoice.type ?? null}, tipo),
              chave_acesso = COALESCE(${invoice.accessKey ?? null}, chave_acesso),
              contato_id_bling = COALESCE(${invoice.contactId === undefined ? null : String(invoice.contactId)}, contato_id_bling),
              natureza_operacao_id = COALESCE(${invoice.operationNatureId === undefined ? null : String(invoice.operationNatureId)}, natureza_operacao_id),
              loja_id = COALESCE(${invoice.storeId === undefined ? null : String(invoice.storeId)}, loja_id)
          WHERE unit_id = ${tenant.legacyUnitId}
            AND id_bling = ${String(invoice.id)}
        `);
        if (updated === 0) {
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO nfe (
              id_bling,
              unit_id,
              situacao,
              numero,
              data_emissao,
              tipo,
              chave_acesso,
              contato_id_bling,
              natureza_operacao_id,
              loja_id,
              pesquisa,
              tem_cod
            ) VALUES (
              ${String(invoice.id)},
              ${tenant.legacyUnitId},
              ${invoice.status},
              ${invoice.number},
              NULLIF(${invoice.issuedAt}, '')::timestamp,
              ${invoice.type ?? null},
              ${invoice.accessKey ?? null},
              ${invoice.contactId === undefined ? null : String(invoice.contactId)},
              ${invoice.operationNatureId === undefined ? null : String(invoice.operationNatureId)},
              ${invoice.storeId === undefined ? null : String(invoice.storeId)},
              'N',
              'N'
            )
          `);
        }

        if (invoice.contact?.name) {
          const contactId = String(invoice.contact.id);
          const document = invoice.contact.document?.replace(/\D/g, "") || null;
          const people = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
            SELECT id FROM pessoa
            WHERE unit_id = ${tenant.legacyUnitId} AND id_bling = ${contactId}
            ORDER BY id LIMIT 1
          `);
          let personId = people[0]?.id ?? null;
          if (personId === null) {
            const inserted = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
              INSERT INTO pessoa (
                id_bling,
                nome,
                numero_documento,
                ie,
                rg,
                telefone,
                email,
                unit_id,
                desabilitar_envio
              ) VALUES (
                ${contactId},
                ${invoice.contact.name},
                ${document},
                ${invoice.contact.stateRegistration ?? null},
                ${invoice.contact.identityDocument ?? null},
                ${invoice.contact.phone ?? null},
                ${invoice.contact.email ?? null},
                ${tenant.legacyUnitId},
                'N'
              ) RETURNING id
            `);
            personId = inserted[0]!.id;
          } else {
            await transaction.$executeRaw(Prisma.sql`
              UPDATE pessoa
              SET nome = ${invoice.contact.name},
                  numero_documento = COALESCE(${document}, numero_documento),
                  ie = COALESCE(${invoice.contact.stateRegistration ?? null}, ie),
                  rg = COALESCE(${invoice.contact.identityDocument ?? null}, rg),
                  telefone = COALESCE(${invoice.contact.phone ?? null}, telefone),
                  email = COALESCE(${invoice.contact.email ?? null}, email)
              WHERE id = ${personId} AND unit_id = ${tenant.legacyUnitId}
            `);
          }

          if (invoice.contact.address) {
            const addresses = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
              SELECT id FROM pessoa_endereco
              WHERE pessoa_id = ${personId} AND unit_id = ${tenant.legacyUnitId}
              ORDER BY id LIMIT 1
            `);
            const address = invoice.contact.address;
            if (addresses[0]) {
              await transaction.$executeRaw(Prisma.sql`
                UPDATE pessoa_endereco
                SET endereco = ${address.street ?? null},
                    numero = ${address.number ?? null},
                    complemento = ${address.complement ?? null},
                    bairro = ${address.district ?? null},
                    cep = ${address.zipCode ?? null},
                    municipio = ${address.city ?? null},
                    uf = ${address.state ?? null}
                WHERE id = ${addresses[0].id}
                  AND pessoa_id = ${personId}
                  AND unit_id = ${tenant.legacyUnitId}
              `);
            } else {
              await transaction.$executeRaw(Prisma.sql`
                INSERT INTO pessoa_endereco (
                  pessoa_id,
                  endereco,
                  numero,
                  complemento,
                  bairro,
                  cep,
                  municipio,
                  uf,
                  unit_id
                ) VALUES (
                  ${personId},
                  ${address.street ?? null},
                  ${address.number ?? null},
                  ${address.complement ?? null},
                  ${address.district ?? null},
                  ${address.zipCode ?? null},
                  ${address.city ?? null},
                  ${address.state ?? null},
                  ${tenant.legacyUnitId}
                )
              `);
            }
          }
        }
      }
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM nfe older
        USING nfe current
        WHERE older.unit_id = ${tenant.legacyUnitId}
          AND current.unit_id = older.unit_id
          AND older.situacao = 5
          AND current.situacao = 6
          AND current.numero = older.numero
          AND current.id <> older.id
      `);
    });

    return {
      mode: "production",
      fetched: summaries.length,
      persisted: summaries.length,
      pages: requestedPages,
    };
  }

  async syncProducts(
    context: GatewayContext & { demo: false },
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    const factoryGroups = [] as Awaited<
      ReturnType<BlingRealGateway["listProductGroups"]>
    >;
    for (let page = 1; page <= 9; page += 1) {
      const groups = await this.#bling.listProductGroups(context, page, 100);
      factoryGroups.push(
        ...groups.filter(
          (group) =>
            normalizedLabel(group.name) === "fabricacao propria" ||
            normalizedLabel(group.parentName) === "fabricacao propria",
        ),
      );
      if (groups.length < 100) break;
    }

    await this.database.$transaction(async (transaction) => {
      for (const group of factoryGroups) {
        const rows = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
          SELECT id FROM grupo_produto
          WHERE id_bling = ${group.id} AND unit_id = ${unitId}
          ORDER BY id LIMIT 1
        `);
        if (rows[0]) {
          await transaction.$executeRaw(Prisma.sql`
            UPDATE grupo_produto SET nome = ${group.name}
            WHERE id = ${rows[0].id} AND unit_id = ${unitId}
          `);
        } else {
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO grupo_produto (id_bling, nome, unit_id)
            VALUES (${group.id}, ${group.name}, ${unitId})
          `);
        }
      }
    });

    const windows = await this.database.$queryRaw<SyncWindowRow[]>(Prisma.sql`
      SELECT
        CASE WHEN MAX(ultima_atualizacao_bling) IS NULL THEN NULL
          ELSE TO_CHAR(MAX(ultima_atualizacao_bling) - INTERVAL '1 day', 'YYYY-MM-DD') || ' 00:00:00'
        END AS "updatedFrom",
        TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS') AS "updatedTo"
      FROM produtos WHERE unit_id = ${unitId}
    `);
    const window = windows[0]!;
    const products: Array<{
      summary: BlingProductSummary;
      detail: BlingProductDetail;
    }> = [];
    let pages = 0;
    for (let page = 1; page <= 69; page += 1) {
      pages += 1;
      const summaries = await this.#bling.listProducts(context, {
        page,
        limit: 100,
        ...(window.updatedFrom ? { updatedFrom: window.updatedFrom } : {}),
        ...(window.updatedFrom ? { updatedTo: window.updatedTo } : {}),
      });
      for (const summary of summaries) {
        products.push({
          summary,
          detail: await this.#bling.getProductDetail(context, summary.id),
        });
      }
      if (summaries.length < 100) break;
    }

    let inserted = 0;
    let updated = 0;
    const missingCost: string[] = [];
    await this.database.$transaction(async (transaction) => {
      for (const product of products) {
        if (!product.summary.cost) {
          missingCost.push(
            product.summary.code ?? product.summary.name ?? product.summary.id,
          );
        }
        const ownProduction = product.detail.productGroupId
          ? factoryGroups.some(
              (group) => group.id === product.detail.productGroupId,
            )
          : false;
        const rows = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
          SELECT id FROM produtos
          WHERE id_produto = ${product.summary.id} AND unit_id = ${unitId}
          ORDER BY id LIMIT 1
        `);
        if (rows[0]) {
          await transaction.$executeRaw(Prisma.sql`
            UPDATE produtos
            SET nome = COALESCE(${product.summary.name ?? null}, nome),
                codigo = COALESCE(${product.summary.code ?? null}, codigo),
                descricao = COALESCE(${product.summary.shortDescription ?? null}, descricao),
                ncm = COALESCE(${product.detail.ncm ?? null}, ncm),
                custo = COALESCE(${product.summary.cost || null}, custo),
                situacao = COALESCE(${product.summary.status ?? null}, situacao),
                fp = ${ownProduction ? "S" : "N"},
                ultima_atualizacao_bling = CURRENT_TIMESTAMP
            WHERE id = ${rows[0].id} AND unit_id = ${unitId}
          `);
          updated += 1;
        } else {
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO produtos (
              id_produto, nome, codigo, descricao, ncm, custo,
              situacao, fp, ultima_atualizacao_bling, unit_id
            ) VALUES (
              ${product.summary.id}, ${product.summary.name ?? null},
              ${product.summary.code ?? null}, ${product.summary.shortDescription ?? null},
              ${product.detail.ncm ?? null}, ${product.summary.cost ?? 0},
              ${product.summary.status ?? null}, ${ownProduction ? "S" : "N"},
              CURRENT_TIMESTAMP, ${unitId}
            )
          `);
          inserted += 1;
        }
      }
    });

    await this.#auditSynchronization(context, "bling.products.synchronized", {
      fetched: products.length,
      inserted,
      updated,
      factoryGroups: factoryGroups.length,
      missingCost: missingCost.length,
    });
    return {
      mode: "production",
      fetched: products.length,
      inserted,
      updated,
      pages,
      factoryGroups: factoryGroups.length,
      missingCost,
    };
  }

  async syncSalesOrders(
    context: GatewayContext & { demo: false },
    input: { from: string; to: string },
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    const orders: BlingSalesOrderDetail[] = [];
    let pages = 0;
    for (let page = 1; page <= 99; page += 1) {
      pages += 1;
      const ids = await this.#bling.listSalesOrders(context, {
        page,
        limit: 100,
        issuedFrom: input.from,
        issuedTo: input.to,
      });
      for (const id of ids) {
        orders.push(await this.#bling.getSalesOrderDetail(context, id));
      }
      if (ids.length < 100) break;
    }

    let inserted = 0;
    let updated = 0;
    await this.database.$transaction(async (transaction) => {
      for (const order of orders) {
        const rows = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
          SELECT id FROM pedido_venda
          WHERE id_bling = ${order.id} AND unit_id = ${unitId}
          ORDER BY id LIMIT 1
        `);
        if (rows[0]) {
          await transaction.$executeRaw(Prisma.sql`
            UPDATE pedido_venda
            SET numero = COALESCE(${order.number ?? null}, numero),
                data = COALESCE(NULLIF(${order.issuedAt ?? null}, '')::date, data),
                total = COALESCE(${order.total || null}, total),
                situacao = COALESCE(${order.statusId || null}, situacao),
                desconto = COALESCE(${order.discount || null}, desconto),
                nfe_id_bling = COALESCE(${order.nfeId ?? null}, nfe_id_bling),
                taxa_comissao = COALESCE(${order.commissionFee || null}, taxa_comissao),
                custo_frete = COALESCE(${order.freightCost || null}, custo_frete),
                ultima_att = CURRENT_TIMESTAMP
            WHERE id = ${rows[0].id} AND unit_id = ${unitId}
          `);
          updated += 1;
        } else {
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO pedido_venda (
              id_bling, numero, unit_id, ultima_att, data, total, situacao,
              desconto, nfe_id_bling, taxa_comissao, custo_frete
            ) VALUES (
              ${order.id}, ${order.number ?? null}, ${unitId}, CURRENT_TIMESTAMP,
              NULLIF(${order.issuedAt ?? null}, '')::date, ${order.total ?? null},
              ${order.statusId ?? null}, ${order.discount ?? null}, ${order.nfeId ?? null},
              ${order.commissionFee ?? null}, ${order.freightCost ?? null}
            )
          `);
          inserted += 1;
        }
      }
    });

    await this.#auditSynchronization(
      context,
      "bling.sales_orders.synchronized",
      {
        from: input.from,
        to: input.to,
        fetched: orders.length,
        inserted,
        updated,
      },
    );
    return {
      mode: "production",
      from: input.from,
      to: input.to,
      fetched: orders.length,
      inserted,
      updated,
      pages,
    };
  }

  async syncNfeDetails(
    context: GatewayContext & { demo: false },
    nfeId: number,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.database.tenant.findUnique({
      where: { id: context.tenantId },
      select: { legacyUnitId: true, demo: true, active: true },
    });
    if (!tenant?.active || tenant.demo || tenant.legacyUnitId === null)
      throw new BadRequestError("Tenant sem unidade produtiva ativa");

    const invoices = await this.database.$queryRaw<LegacyInvoiceRow[]>(
      Prisma.sql`
        SELECT id, id_bling::text AS "blingId"
        FROM nfe
        WHERE id = ${nfeId} AND unit_id = ${tenant.legacyUnitId}
        LIMIT 1
      `,
    );
    const invoice = invoices[0];
    if (!invoice)
      throw new BadRequestError("NF-e não encontrada na unidade ativa");

    const detail = await this.#bling.getNfeDetail(context, invoice.blingId);
    const contact = detail.contactId
      ? await this.#bling.getContactDetail(context, detail.contactId)
      : null;

    const boletoPayment =
      detail.paymentMethodIds.length === 0
        ? false
        : (
            await this.database.$queryRaw<ExistsRow[]>(Prisma.sql`
              SELECT EXISTS (
                SELECT 1
                FROM forma_pagamento
                WHERE unit_id = ${tenant.legacyUnitId}
                  AND id_bling::text IN (${Prisma.join(detail.paymentMethodIds)})
                  AND tipo_pagamento::text = '15'
              ) AS exists
            `)
          )[0]?.exists === true;

    const boletoBatch = boletoPayment
      ? await this.#bling.getBoletos(context, invoice.blingId)
      : { accounts: [] };
    const receivables = new Map<
      string,
      Awaited<ReturnType<BlingRealGateway["getReceivableDetail"]>>
    >();
    for (const account of boletoBatch.accounts) {
      receivables.set(
        account.id,
        await this.#bling.getReceivableDetail(context, account.id),
      );
    }

    const trackingCodes: string[] = [];
    if (isCorreios(detail.carrierName)) {
      for (const objectId of detail.logisticObjectIds) {
        const logistic = await this.#bling.getLogisticObject(context, objectId);
        if (logistic.trackingCode) trackingCodes.push(logistic.trackingCode);
      }
    }
    const uniqueTrackingCodes = [...new Set(trackingCodes)];

    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`
        UPDATE nfe
        SET link_xml = ${detail.xmlUrl ?? null},
            link_pdf = ${detail.pdfUrl ?? null},
            valor = ${detail.total ?? null},
            serie = ${detail.series ?? null},
            vendedor_id = ${detail.sellerId ?? null},
            parcela_obs = ${detail.installmentNote ?? null}
        WHERE id = ${invoice.id}
          AND id_bling = ${invoice.blingId}
          AND unit_id = ${tenant.legacyUnitId}
      `);

      if (contact) {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE pessoa
          SET telefone_contato = ${contact.phone ?? null},
              celular = ${contact.mobile ?? null}
          WHERE id_bling = ${contact.id}
            AND unit_id = ${tenant.legacyUnitId}
        `);
      }

      if (uniqueTrackingCodes.length > 0) {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE nfe
          SET codigo_rastreio = ${uniqueTrackingCodes[0] ?? null},
              codigo_rastreio2 = ${uniqueTrackingCodes[1] ?? null},
              tem_cod = 'S'
          WHERE id = ${invoice.id}
            AND unit_id = ${tenant.legacyUnitId}
        `);
      }

      for (const account of boletoBatch.accounts) {
        const receivable = receivables.get(account.id);
        const updated = await transaction.$executeRaw(Prisma.sql`
          UPDATE boleto
          SET nfe_id_bling = ${invoice.blingId},
              venda = ${boletoBatch.saleNumber ?? null},
              valor_total = ${boletoBatch.total ?? null},
              numero_externo = ${account.externalNumber ?? null},
              vencimento = NULLIF(${account.dueDate ?? null}, '')::date,
              valor = ${account.value ?? null},
              situacao = ${account.status ?? null},
              link_boleto = ${receivable?.boletoUrl ?? null},
              contato_id = ${receivable?.contactId ?? null}::bigint
          WHERE conta_id = ${account.id}::bigint
            AND unit_id = ${tenant.legacyUnitId}
        `);
        if (updated === 0) {
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO boleto (
              nfe_id_bling,
              venda,
              valor_total,
              conta_id,
              numero_externo,
              vencimento,
              valor,
              situacao,
              link_boleto,
              contato_id,
              unit_id
            ) VALUES (
              ${invoice.blingId},
              ${boletoBatch.saleNumber ?? null},
              ${boletoBatch.total ?? null},
              ${account.id}::bigint,
              ${account.externalNumber ?? null},
              NULLIF(${account.dueDate ?? null}, '')::date,
              ${account.value ?? null},
              ${account.status ?? null},
              ${receivable?.boletoUrl ?? null},
              ${receivable?.contactId ?? null}::bigint,
              ${tenant.legacyUnitId}
            )
          `);
        }
      }
    });

    await this.database.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: null,
        action: "nfe.details.synchronized",
        entityType: "nfe",
        entityId: String(invoice.id),
        correlationId: context.correlationId,
        metadata: {
          blingId: invoice.blingId,
          xml: Boolean(detail.xmlUrl),
          pdf: Boolean(detail.pdfUrl),
          boletos: boletoBatch.accounts.length,
          tracking: uniqueTrackingCodes.length,
        },
      },
    });

    return {
      mode: "production",
      nfeId: invoice.id,
      blingId: invoice.blingId,
      xml: Boolean(detail.xmlUrl),
      pdf: Boolean(detail.pdfUrl),
      boletos: boletoBatch.accounts.length,
      trackingCodes: uniqueTrackingCodes.slice(0, 2),
      contactUpdated: contact !== null,
    };
  }

  async deliverApChat(
    context: GatewayContext & { demo: false },
    message: ApChatMessage,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.database.tenant.findUnique({
      where: { id: context.tenantId },
      select: { legacyUnitId: true, demo: true, active: true },
    });
    if (!tenant?.active || tenant.demo || tenant.legacyUnitId === null)
      throw new BadRequestError("Tenant sem unidade produtiva ativa");
    const delivery = await this.#apchat.deliver(context, message);
    await this.database.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: null,
        action: "apchat.message.accepted",
        entityType: "integration",
        entityId: "apchat",
        correlationId: context.correlationId,
        metadata: {
          externalId: delivery.externalId,
          idempotencyKey: message.idempotencyKey,
        },
      },
    });
    return { mode: "production", ...delivery };
  }

  async #productionUnit(tenantId: string): Promise<number> {
    const tenant = await this.database.tenant.findUnique({
      where: { id: tenantId },
      select: { legacyUnitId: true, demo: true, active: true },
    });
    if (!tenant?.active || tenant.demo || tenant.legacyUnitId === null)
      throw new BadRequestError("Tenant sem unidade produtiva ativa");
    return tenant.legacyUnitId;
  }

  async #auditSynchronization(
    context: GatewayContext,
    action: string,
    metadata: Record<string, string | number | boolean>,
  ): Promise<void> {
    await this.database.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: null,
        action,
        entityType: "integration",
        entityId: "bling",
        correlationId: context.correlationId,
        metadata,
      },
    });
  }
}

function isCorreios(value: string | undefined): boolean {
  return Boolean(
    value
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .includes("correio"),
  );
}

function normalizedLabel(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

class LegacyApChatCredentialProvider implements ApChatCredentialProvider {
  constructor(private readonly database: DatabaseClient) {}

  async getCredentials(tenantId: string): Promise<ApChatCredentials> {
    const rows = await this.database.$queryRaw<
      ApChatCredentialRow[]
    >(Prisma.sql`
      SELECT
        NULLIF(BTRIM(config.uuid), '') AS uuid,
        NULLIF(BTRIM(config.token), '') AS token,
        NULLIF(BTRIM(config.num_teste), '') AS "testRecipient",
        COALESCE(config.msg, 'N') = 'S' AS "messagesOpen"
      FROM saas_tenant tenant
      JOIN ap_chat config ON config.unit_id = tenant.legacy_unit_id
      WHERE tenant.id = ${tenantId}::uuid
      ORDER BY config.id DESC
      LIMIT 1
    `);
    const credentials = rows[0];
    if (!credentials?.uuid || !credentials.token)
      throw new BadRequestError("APChat não configurado para a empresa");
    return {
      uuid: credentials.uuid,
      token: credentials.token,
      messagesOpen: credentials.messagesOpen,
      ...(credentials.testRecipient
        ? { testRecipient: credentials.testRecipient }
        : {}),
    };
  }
}

class LegacyBlingTokenRepository implements BlingTokenRepository {
  constructor(private readonly database: DatabaseClient) {}

  async findByTenant(tenantId: string): Promise<BlingTokenRecord | null> {
    const rows = await this.database.$queryRaw<TenantTokenRow[]>(Prisma.sql`
      SELECT
        bt.access_token AS "accessToken",
        bt.refresh_token AS "refreshToken",
        bt.expires_in AS "expiresAt",
        bt.status
      FROM saas_tenant tenant
      JOIN bling_tokens bt ON bt.unit_id = tenant.legacy_unit_id
      WHERE tenant.id = ${tenantId}::uuid
      ORDER BY bt.updated_at DESC NULLS LAST, bt.id DESC
      LIMIT 1
    `);
    const token = rows[0];
    if (
      !token?.accessToken ||
      !token.refreshToken ||
      token.expiresAt === null ||
      (token.status !== "S" && token.status !== "R")
    )
      return null;
    return {
      tenantId,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAtEpochSeconds: Number(token.expiresAt),
      status: token.status,
    };
  }

  async save(record: BlingTokenRecord): Promise<void> {
    await this.database.$executeRaw(Prisma.sql`
      UPDATE bling_tokens bt
      SET access_token = ${record.accessToken},
          refresh_token = ${record.refreshToken},
          expires_in = ${record.expiresAtEpochSeconds},
          status = ${record.status},
          updated_at = NOW()
      FROM saas_tenant tenant
      WHERE tenant.id = ${record.tenantId}::uuid
        AND bt.unit_id = tenant.legacy_unit_id
        AND bt.id = (
          SELECT current.id
          FROM bling_tokens current
          WHERE current.unit_id = tenant.legacy_unit_id
          ORDER BY current.updated_at DESC NULLS LAST, current.id DESC
          LIMIT 1
        )
    `);
  }
}

class LegacyBlingCredentialProvider implements BlingCredentialProvider {
  constructor(private readonly database: DatabaseClient) {}

  async getCredentials(tenantId: string): Promise<BlingClientCredentials> {
    const rows = await this.database.$queryRaw<CredentialRow[]>(Prisma.sql`
      SELECT
        unit.client_id AS "clientId",
        unit.client_secret AS "clientSecret"
      FROM saas_tenant tenant
      JOIN system_unit unit ON unit.id = tenant.legacy_unit_id
      WHERE tenant.id = ${tenantId}::uuid
      LIMIT 1
    `);
    const credentials = rows[0];
    if (!credentials?.clientId || !credentials.clientSecret)
      throw new BadRequestError("Credenciais OAuth Bling não configuradas");
    return {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
    };
  }
}

class RefreshingBlingTokenProvider implements BlingAccessTokenProvider {
  constructor(
    private readonly tokens: BlingTokenRepository,
    private readonly refresh: BlingTokenRefreshCoordinator,
  ) {}

  async getAccessToken(
    tenantId: string,
    correlationId: string,
  ): Promise<string> {
    let token = await this.tokens.findByTenant(tenantId);
    if (!token) throw new BadRequestError("Integração Bling sem token ativo");
    if (
      token.status !== "S" ||
      token.expiresAtEpochSeconds <= Math.floor(Date.now() / 1_000) + 120
    ) {
      await this.refresh.refreshIfNeeded(
        token.status === "R" ? 401 : "expires",
        {
          tenantId,
          correlationId,
          demo: false,
        },
      );
      token = await this.tokens.findByTenant(tenantId);
    }
    if (!token || token.status !== "S")
      throw new BadRequestError("Não foi possível renovar o token Bling");
    return token.accessToken;
  }

  async handleUnauthorized(
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    await this.refresh.refreshIfNeeded(401, {
      tenantId,
      correlationId,
      demo: false,
    });
  }
}

class PrismaAdvisoryLock implements DistributedLock {
  constructor(private readonly database: DatabaseClient) {}

  runExclusive<T>(
    key: string,
    ttlMs: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.database.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`
          SELECT set_config('lock_timeout', ${`${ttlMs}ms`}, true)
        `);
        await transaction.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
        `);
        return operation();
      },
      { maxWait: ttlMs, timeout: ttlMs + 35_000 },
    );
  }
}

class PrismaBlingRefreshAudit implements BlingRefreshAudit {
  constructor(private readonly database: DatabaseClient) {}

  async record(event: {
    tenantId: string;
    correlationId: string;
    outcome: "success" | "revoked" | "transient_failure" | "not_found";
    code?: string;
  }): Promise<void> {
    await this.database.auditLog.create({
      data: {
        tenantId: event.tenantId,
        actorUserId: null,
        action: `bling.refresh.${event.outcome}`,
        entityType: "integration",
        entityId: "bling",
        correlationId: event.correlationId,
        metadata: event.code ? { code: event.code } : {},
      },
    });
  }
}
