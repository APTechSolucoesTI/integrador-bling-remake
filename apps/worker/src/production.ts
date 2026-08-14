import { BadRequestError } from "./worker-errors.js";
import {
  NfeXmlProcessor,
  type NfeXmlProcessResult,
} from "./nfe-xml-processor.js";
import {
  detailPolicyReason,
  resolveNfeSyncPolicy,
  summaryPolicyReason,
} from "./nfe-sync-policy.js";
import {
  decryptSecret,
  encryptSecret,
  Prisma,
  type DatabaseClient,
} from "@integrador/db";
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
  type BlingRateLimiter,
  type BlingSalesOrderDetail,
  type BlingTokenRecord,
  type BlingTokenRepository,
  type DistributedLock,
  type GatewayContext,
  type ListNfeInput,
} from "@integrador/integrations";

interface IdRow {
  id: number;
}
interface LegacyInvoiceRow {
  id: number;
  blingId: string;
}
interface LegacyInvoiceXmlRow {
  id: number;
  xmlUrl: string | null;
}
interface ExistsRow {
  exists: boolean;
}
interface OperationNatureEligibilityRow {
  externalId: string;
  description: string;
}
interface InvoiceEligibilityRow extends LegacyInvoiceRow {
  status: number;
  direction: number | null;
  customerId: string | null;
  customerName: string | null;
  customerDocument: string | null;
  natureId: string | null;
  natureDescription: string | null;
  salesChannelId: string | null;
}
interface SyncWindowRow {
  updatedFrom: string | null;
  updatedTo: string;
  startPage: number;
}
interface NfeDeliveryRow {
  id: number;
  number: string;
  statusId: number | null;
  pdfUrl: string | null;
  trackingCode: string | null;
  customerName: string | null;
  mobile: string | null;
  messagingDisabled: boolean;
  companyName: string;
  boletoUrl: string | null;
}
interface SatisfactionDeliveryRow {
  id: number;
  number: string;
  customerName: string;
  mobile: string;
  companyName: string;
  message: string;
  surveyLink: string;
}
interface GoalLifecycleRow {
  id: number;
  statusId: number;
  nextStart: string | null;
  nextEnd: string | null;
  nextCompetence: string | null;
}

export class ProductionIntegrationProcessor {
  readonly #bling: BlingRealGateway;
  readonly #blingRefresh: BlingTokenRefreshCoordinator;
  readonly #apchat: ApChatRealGateway;
  readonly #nfeXml: NfeXmlProcessor;

  constructor(private readonly database: DatabaseClient) {
    this.#nfeXml = new NfeXmlProcessor(database);
    const tokens = new PrismaBlingTokenRepository(database);
    this.#blingRefresh = new BlingTokenRefreshCoordinator({
      tokens,
      credentials: new PrismaBlingCredentialProvider(database),
      lock: new PrismaAdvisoryLock(database),
      oauth: new BlingOAuthHttpGateway({ globalDemoMode: false }),
      audit: new PrismaBlingRefreshAudit(database),
    });
    this.#bling = new BlingRealGateway({
      globalDemoMode: false,
      tokenProvider: new RefreshingBlingTokenProvider(
        tokens,
        this.#blingRefresh,
      ),
      rateLimiter: new PrismaBlingRateLimiter(database),
    });
    const apchatBaseUrl = process.env["APCHAT_BASE_URL"]?.trim();
    this.#apchat = new ApChatRealGateway({
      globalDemoMode: false,
      credentials: new PrismaApChatCredentialProvider(database),
      ...(apchatBaseUrl ? { baseUrl: apchatBaseUrl } : {}),
    });
  }

  async refreshBlingToken(
    context: GatewayContext & { demo: false },
  ): Promise<Record<string, unknown>> {
    const refreshed = await this.#blingRefresh.refreshIfNeeded(401, context);
    if (!refreshed)
      throw new BadRequestError(
        "Não foi possível renovar o token Bling; reconecte a integração",
      );
    return { refreshed: true };
  }

  async syncNfe(
    context: GatewayContext & { demo: false },
    input: Pick<ListNfeInput, "issuedFrom" | "issuedTo"> & {
      autoDeliver?: boolean;
      maxPages?: number;
      pageSize?: number;
      maxRecords?: number;
    },
  ): Promise<Record<string, unknown>> {
    const tenant = await this.database.tenant.findUnique({
      where: { id: context.tenantId },
      select: { demo: true, active: true },
    });
    if (!tenant?.active || tenant.demo)
      throw new BadRequestError("Tenant sem unidade produtiva ativa");

    const policy = resolveNfeSyncPolicy(
      await this.database.nfeSyncPolicy.findUnique({
        where: { tenantId: context.tenantId },
      }),
    );

    const summaries: BlingNfeSummary[] = [];
    let requestedPages = 0;
    const pageSize = Math.min(Math.max(input.pageSize ?? 100, 1), 100);
    const maxPages = Math.min(Math.max(input.maxPages ?? 4, 1), 4);
    const maxRecords = Math.max(input.maxRecords ?? Number.MAX_SAFE_INTEGER, 1);
    const statuses = policy.allowedStatuses.filter(
      (status): status is 2 | 5 | 6 =>
        status === 2 || status === 5 || status === 6,
    );
    const directions = policy.allowedDirections.filter(
      (direction): direction is 0 | 1 => direction === 0 || direction === 1,
    );
    for (const status of statuses) {
      for (const direction of directions) {
        for (let page = 1; page <= maxPages; page += 1) {
          requestedPages += 1;
          const items = await this.#bling.listNfe(context, {
            status,
            direction,
            issuedFrom: `${input.issuedFrom} 00:00:00`,
            issuedTo: `${input.issuedTo} 23:59:59`,
            page,
            limit: pageSize,
          });
          summaries.push(...items.slice(0, maxRecords - summaries.length));
          if (items.length < pageSize || summaries.length >= maxRecords) break;
        }
        if (summaries.length >= maxRecords) break;
      }
      if (summaries.length >= maxRecords) break;
    }

    // O legado só admite notas de venda de naturezas previamente cadastradas.
    // Atualizamos o catálogo antes da decisão para não descartar uma nota por
    // uma cópia local desatualizada da natureza de operação.
    if (summaries.length > 0) await this.syncOperationNatures(context);
    const natureRows = await this.database.$queryRaw<
      OperationNatureEligibilityRow[]
    >(Prisma.sql`
        SELECT id_bling::text AS "externalId", descricao AS description
        FROM natureza_operacao
        WHERE unit_id = ${context.tenantId} AND active = true
      `);
    const natureDescriptions = new Map(
      natureRows.map((nature) => [nature.externalId, nature.description]),
    );
    const exclusions = summaries.flatMap((invoice) => {
      const reason = summaryPolicyReason(
        {
          status: invoice.status,
          direction: invoice.type,
          customerId: String(invoice.contactId ?? invoice.contact?.id ?? ""),
          customerName: invoice.contact?.name,
          customerDocument: invoice.contact?.document,
          natureId: invoice.operationNatureId,
          natureDescription: natureDescriptions.get(
            String(invoice.operationNatureId ?? ""),
          ),
          salesChannelId: invoice.storeId,
        },
        policy,
      );
      return reason ? [{ invoice, reason }] : [];
    });
    const excludedIds = new Set(
      exclusions.map(({ invoice }) => String(invoice.id)),
    );
    const eligibleSummaries = summaries.filter(
      (invoice) => !excludedIds.has(String(invoice.id)),
    );
    const excludedExternalIds = [...excludedIds];

    await this.database.$transaction(
      async (transaction) => {
        if (excludedExternalIds.length > 0) {
          await transaction.$executeRaw(Prisma.sql`
          DELETE FROM boleto
          WHERE unit_id = ${context.tenantId}
            AND nfe_id_bling::text IN (${Prisma.join(excludedExternalIds)})
        `);
          await transaction.$executeRaw(Prisma.sql`
          DELETE FROM nfe
          WHERE unit_id = ${context.tenantId}
            AND id_bling::text IN (${Prisma.join(excludedExternalIds)})
        `);
        }
        for (const invoice of eligibleSummaries) {
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
          WHERE unit_id = ${context.tenantId}
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
              loja_id
            ) VALUES (
              ${String(invoice.id)},
              ${context.tenantId},
              ${invoice.status},
              ${invoice.number},
              NULLIF(${invoice.issuedAt}, '')::timestamp,
              ${invoice.type ?? null},
              ${invoice.accessKey ?? null},
              ${invoice.contactId === undefined ? null : String(invoice.contactId)},
              ${invoice.operationNatureId === undefined ? null : String(invoice.operationNatureId)},
              ${invoice.storeId === undefined ? null : String(invoice.storeId)}
            )
          `);
          }

          if (invoice.contact?.name) {
            const contactId = String(invoice.contact.id);
            const document =
              invoice.contact.document?.replace(/\D/g, "") || null;
            const people = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
            SELECT id FROM pessoa
            WHERE unit_id = ${context.tenantId} AND id_bling = ${contactId}
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
                ${context.tenantId},
                FALSE
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
              WHERE id = ${personId} AND unit_id = ${context.tenantId}
            `);
            }

            if (invoice.contact.address) {
              const addresses = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
              SELECT id FROM pessoa_endereco
              WHERE pessoa_id = ${personId} AND unit_id = ${context.tenantId}
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
                  AND unit_id = ${context.tenantId}
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
                  ${context.tenantId}
                )
              `);
              }
            }
          }
        }
        await transaction.$executeRaw(Prisma.sql`
        DELETE FROM nfe older
        USING nfe current
        WHERE older.unit_id = ${context.tenantId}
          AND current.unit_id = older.unit_id
          AND older.situacao = 5
          AND current.situacao = 6
          AND current.numero = older.numero
          AND current.id <> older.id
      `);
      },
      { maxWait: 15_000, timeout: 180_000 },
    );

    const externalIds = [
      ...new Set(eligibleSummaries.map((invoice) => String(invoice.id))),
    ];
    const localInvoices = externalIds.length
      ? await this.database.$queryRaw<LegacyInvoiceRow[]>(Prisma.sql`
          SELECT id, id_bling::text AS "blingId"
          FROM nfe
          WHERE unit_id = ${context.tenantId}
            AND id_bling::text IN (${Prisma.join(externalIds)})
          ORDER BY data_emissao, id
        `)
      : [];
    let enrichmentFailed = 0;
    let ignoredAfterDetail = 0;
    const detailIgnoredReasons: string[] = [];
    for (const invoice of localInvoices) {
      try {
        const result = await this.syncNfeDetails(context, invoice.id);
        if (result["ignored"] === true) {
          ignoredAfterDetail += 1;
          const reason = result["reason"];
          detailIgnoredReasons.push(
            typeof reason === "string" ? reason : "Regra detalhada",
          );
        }
      } catch (error) {
        enrichmentFailed += 1;
        const message = safeErrorMessage(error);
        await this.database.$executeRaw(Prisma.sql`
          UPDATE nfe
          SET calculation_status = 'failed'::"CalculationStatus",
              obs_calculo = ${`Falha ao detalhar NF-e: ${message}`.slice(0, 500)}
          WHERE id = ${invoice.id} AND unit_id = ${context.tenantId}
        `);
      }
    }

    let delivered = 0;
    if (input.autoDeliver && localInvoices.length > 0) {
      const ready = await this.database.$queryRaw<IdRow[]>(Prisma.sql`
        SELECT id
        FROM nfe
        WHERE unit_id = ${context.tenantId}
          AND id IN (${Prisma.join(localInvoices.map((invoice) => invoice.id))})
          AND invoice_message_status = 'pending'
        ORDER BY id
      `);
      for (const invoice of ready) {
        const result = await this.deliverNfe(context, invoice.id);
        if (result["accepted"] === true) delivered += 1;
      }
    }

    return {
      mode: "production",
      fetched: summaries.length,
      persisted: eligibleSummaries.length - ignoredAfterDetail,
      ignoredByPolicy: exclusions.length + ignoredAfterDetail,
      ignoredAfterDetail,
      ignoredReasons: Object.fromEntries(
        [
          ...new Set([
            ...exclusions.map(({ reason }) => reason),
            ...detailIgnoredReasons,
          ]),
        ].map((reason) => [
          reason,
          exclusions.filter((entry) => entry.reason === reason).length +
            detailIgnoredReasons.filter((entry) => entry === reason).length,
        ]),
      ),
      pages: requestedPages,
      enriched: localInvoices.length,
      enrichmentFailed,
      delivered,
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
            UPDATE grupo_produto SET nome = ${group.name}, own_manufacture = TRUE
            WHERE id = ${rows[0].id} AND unit_id = ${unitId}
          `);
        } else {
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO grupo_produto (id_bling, nome, unit_id, own_manufacture)
            VALUES (${group.id}, ${group.name}, ${unitId}, TRUE)
          `);
        }
      }
    });

    const windows = await this.database.$queryRaw<SyncWindowRow[]>(Prisma.sql`
      SELECT
        CASE WHEN NOT EXISTS (
          SELECT 1 FROM saas_audit_log
          WHERE tenant_id = ${unitId}::uuid
            AND action = 'bling.products.synchronized'
        ) THEN NULL
          WHEN MAX(ultima_atualizacao_bling) IS NULL THEN NULL
          ELSE TO_CHAR(MAX(ultima_atualizacao_bling) - INTERVAL '1 day', 'YYYY-MM-DD') || ' 00:00:00'
        END AS "updatedFrom",
        TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS') AS "updatedTo",
        CASE WHEN EXISTS (
          SELECT 1 FROM saas_audit_log
          WHERE tenant_id = ${unitId}::uuid
            AND action = 'bling.products.synchronized'
        ) THEN 1 ELSE FLOOR(COUNT(*) / 100.0)::int + 1 END AS "startPage"
      FROM produtos WHERE unit_id = ${unitId}
    `);
    const window = windows[0]!;
    let pages = 0;
    let fetched = 0;
    let inserted = 0;
    let updated = 0;
    let detailFailed = 0;
    const missingCost: string[] = [];
    for (let page = window.startPage; page <= 69; page += 1) {
      pages += 1;
      const summaries = await this.#bling.listProducts(context, {
        page,
        limit: 100,
        ...(window.updatedFrom ? { updatedFrom: window.updatedFrom } : {}),
        ...(window.updatedFrom ? { updatedTo: window.updatedTo } : {}),
      });
      const products: Array<{
        summary: BlingProductSummary;
        detail: BlingProductDetail;
      }> = [];
      for (const summary of summaries) {
        try {
          products.push({
            summary,
            detail: await this.#bling.getProductDetail(context, summary.id),
          });
        } catch {
          detailFailed += 1;
          products.push({ summary, detail: { id: summary.id } });
        }
      }
      fetched += products.length;
      await this.database.$transaction(
        async (transaction) => {
          for (const product of products) {
            if (!product.summary.cost) {
              missingCost.push(
                product.summary.code ??
                  product.summary.name ??
                  product.summary.id,
              );
            }
            const groupRows = product.detail.productGroupId
              ? await transaction.$queryRaw<IdRow[]>(Prisma.sql`
                SELECT id FROM grupo_produto
                WHERE id_bling = ${product.detail.productGroupId}
                  AND unit_id = ${unitId}
                ORDER BY id LIMIT 1
              `)
              : [];
            const groupId = groupRows[0]?.id ?? null;
            const ownProduction = groupId !== null;
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
                  active = COALESCE(${product.summary.status ?? "A"}, 'A') <> 'I',
                  group_id = ${groupId},
                  fabricacao_propria = ${ownProduction},
                  ultima_atualizacao_bling = CURRENT_TIMESTAMP
              WHERE id = ${rows[0].id} AND unit_id = ${unitId}
            `);
              updated += 1;
            } else {
              await transaction.$executeRaw(Prisma.sql`
              INSERT INTO produtos (
                id_produto, nome, codigo, descricao, ncm, custo, group_id,
                active, fabricacao_propria, ultima_atualizacao_bling, unit_id
              ) VALUES (
                ${product.summary.id}, ${product.summary.name ?? "Produto sem nome"},
                ${product.summary.code ?? null}, ${product.summary.shortDescription ?? null},
                ${product.detail.ncm ?? null}, ${product.summary.cost ?? 0}, ${groupId},
                ${product.summary.status ?? "A"} <> 'I', ${ownProduction},
                CURRENT_TIMESTAMP, ${unitId}
              )
            `);
              inserted += 1;
            }
          }
        },
        { maxWait: 15_000, timeout: 120_000 },
      );
      if (summaries.length < 100) break;
    }

    await this.#auditSynchronization(context, "bling.products.synchronized", {
      fetched,
      inserted,
      updated,
      factoryGroups: factoryGroups.length,
      missingCost: missingCost.length,
      detailFailed,
      resumedFromPage: window.startPage,
    });
    return {
      mode: "production",
      fetched,
      inserted,
      updated,
      pages,
      factoryGroups: factoryGroups.length,
      missingCost,
      detailFailed,
      resumedFromPage: window.startPage,
    };
  }

  async syncCancelledNfe(
    context: GatewayContext & { demo: false },
    input: Pick<ListNfeInput, "issuedFrom" | "issuedTo">,
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    const cancelled: BlingNfeSummary[] = [];
    let pages = 0;
    for (let page = 1; page <= 4; page += 1) {
      pages += 1;
      const items = await this.#bling.listNfe(context, {
        status: 2,
        issuedFrom: `${input.issuedFrom} 00:00:01`,
        issuedTo: `${input.issuedTo} 23:59:59`,
        page,
        limit: 100,
      });
      cancelled.push(...items);
      if (items.length < 100) break;
    }
    let updated = 0;
    await this.database.$transaction(async (transaction) => {
      for (const invoice of cancelled) {
        updated += await transaction.$executeRaw(Prisma.sql`
          UPDATE nfe
          SET situacao = 2,
              cancelled_at = NOW(),
              invoice_message_status = 'skipped'::"MessageStatus",
              obs_envio = 'NF-e cancelada no Bling'
          WHERE unit_id = ${unitId}
            AND (
              id_bling::text = ${String(invoice.id)}
              OR numero::text = ${invoice.number}
            )
        `);
      }
    });
    await this.#auditSynchronization(
      context,
      "bling.cancelled_nfe.synchronized",
      {
        from: input.issuedFrom,
        to: input.issuedTo,
        fetched: cancelled.length,
        updated,
      },
    );
    return {
      mode: "production",
      from: input.issuedFrom,
      to: input.issuedTo,
      fetched: cancelled.length,
      updated,
      pages,
    };
  }

  async syncPaymentMethods(
    context: GatewayContext & { demo: false },
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    const methods = await this.#bling.listPaymentMethods(context);
    await this.database.$transaction(async (transaction) => {
      for (const method of methods) {
        const updated = await transaction.$executeRaw(Prisma.sql`
          UPDATE forma_pagamento
          SET descricao = ${method.description ?? "Sem descrição"},
              tipo_pagamento = ${method.paymentType ?? null}
          WHERE unit_id = ${unitId}
            AND id_bling = ${method.id}
        `);
        if (updated === 0) {
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO forma_pagamento (
              unit_id,
              id_bling,
              descricao,
              tipo_pagamento
            ) VALUES (
              ${unitId},
              ${method.id},
              ${method.description ?? "Sem descrição"},
              ${method.paymentType ?? null}
            )
          `);
        }
      }
    });
    await this.#auditSynchronization(
      context,
      "bling.payment_methods.synchronized",
      {
        fetched: methods.length,
        unitId,
      },
    );
    return { mode: "production", fetched: methods.length, unitId };
  }

  async syncSalesChannels(
    context: GatewayContext & { demo: false },
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    const channels = await this.#bling.listSalesChannels(context);
    await this.database.$transaction(async (transaction) => {
      for (const channel of channels) {
        const updated = await transaction.$executeRaw(Prisma.sql`
          UPDATE canal_venda
          SET descricao = ${channel.description ?? "Sem descrição"},
              tipo = ${channel.channelType ?? null}
          WHERE unit_id = ${unitId}
            AND loja_id = ${channel.id}
        `);
        if (updated === 0) {
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO canal_venda (
              unit_id,
              loja_id,
              descricao,
              tipo
            ) VALUES (
              ${unitId},
              ${channel.id},
              ${channel.description ?? "Sem descrição"},
              ${channel.channelType ?? null}
            )
          `);
        }
      }
    });
    await this.#auditSynchronization(
      context,
      "bling.sales_channels.synchronized",
      {
        fetched: channels.length,
        unitId,
      },
    );
    return { mode: "production", fetched: channels.length, unitId };
  }

  async syncSellers(
    context: GatewayContext & { demo: false },
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    const sellers = await this.#bling.listSellers(context);
    await this.database.$transaction(async (transaction) => {
      for (const seller of sellers) {
        const updated = await transaction.$executeRaw(Prisma.sql`
          UPDATE vendedores
          SET nome = ${seller.name ?? "Sem nome"}
          WHERE unit_id = ${unitId}
            AND id_bling = ${seller.id}
        `);
        if (updated === 0) {
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO vendedores (unit_id, id_bling, nome)
            VALUES (${unitId}, ${seller.id}, ${seller.name ?? "Sem nome"})
          `);
        }
      }
    });
    await this.#auditSynchronization(context, "bling.sellers.synchronized", {
      fetched: sellers.length,
      unitId,
    });
    return { mode: "production", fetched: sellers.length, unitId };
  }

  async syncOperationNatures(
    context: GatewayContext & { demo: false },
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    const natures = await this.#bling.listOperationNatures(context);
    await this.database.$transaction(async (transaction) => {
      for (const nature of natures) {
        const updated = await transaction.$executeRaw(Prisma.sql`
          UPDATE natureza_operacao
          SET descricao = ${nature.description ?? "Sem descrição"}
          WHERE unit_id = ${unitId}
            AND id_bling = ${nature.id}
        `);
        if (updated === 0) {
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO natureza_operacao (unit_id, id_bling, descricao)
            VALUES (${unitId}, ${nature.id}, ${nature.description ?? "Sem descrição"})
          `);
        }
      }
    });
    await this.#auditSynchronization(
      context,
      "bling.operation_natures.synchronized",
      { fetched: natures.length, unitId },
    );
    return { mode: "production", fetched: natures.length, unitId };
  }

  async syncSalesOrders(
    context: GatewayContext & { demo: false },
    input: { from: string; to: string },
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    let pages = 0;
    let fetched = 0;
    let detailFailed = 0;
    let inserted = 0;
    let updated = 0;
    for (let page = 1; page <= 99; page += 1) {
      pages += 1;
      const ids = await this.#bling.listSalesOrders(context, {
        page,
        limit: 100,
        issuedFrom: input.from,
        issuedTo: input.to,
      });
      const orders: BlingSalesOrderDetail[] = [];
      for (const id of ids) {
        try {
          orders.push(await this.#bling.getSalesOrderDetail(context, id));
        } catch {
          detailFailed += 1;
        }
      }
      fetched += orders.length;
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
                total = COALESCE(${order.total ?? null}, total),
                situacao = COALESCE(${order.statusId ?? null}, situacao),
                desconto = COALESCE(${order.discount ?? null}, desconto),
                nfe_id_bling = COALESCE(${order.nfeId ?? null}, nfe_id_bling),
                taxa_comissao = COALESCE(${order.commissionFee ?? null}, taxa_comissao),
                custo_frete = COALESCE(${order.freightCost ?? null}, custo_frete),
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
      if (ids.length < 100) break;
    }

    await this.#auditSynchronization(
      context,
      "bling.sales_orders.synchronized",
      {
        from: input.from,
        to: input.to,
        fetched,
        inserted,
        updated,
        detailFailed,
      },
    );
    return {
      mode: "production",
      from: input.from,
      to: input.to,
      fetched,
      inserted,
      updated,
      pages,
      detailFailed,
    };
  }

  async syncNfeDetails(
    context: GatewayContext & { demo: false },
    nfeId: number,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.database.tenant.findUnique({
      where: { id: context.tenantId },
      select: { demo: true, active: true },
    });
    if (!tenant?.active || tenant.demo)
      throw new BadRequestError("Tenant sem unidade produtiva ativa");

    const invoices = await this.database.$queryRaw<InvoiceEligibilityRow[]>(
      Prisma.sql`
        SELECT n.id,
               n.id_bling::text AS "blingId",
               n.situacao AS status,
               n.tipo AS direction,
               n.contato_id_bling::text AS "customerId",
               (
                 SELECT p.nome FROM pessoa p
                 WHERE p.unit_id = n.unit_id
                   AND p.id_bling::text = n.contato_id_bling::text
                 ORDER BY p.id LIMIT 1
               ) AS "customerName",
               (
                 SELECT p.numero_documento FROM pessoa p
                 WHERE p.unit_id = n.unit_id
                   AND p.id_bling::text = n.contato_id_bling::text
                 ORDER BY p.id LIMIT 1
               ) AS "customerDocument",
               n.natureza_operacao_id::text AS "natureId",
               (
                 SELECT nat.descricao FROM natureza_operacao nat
                 WHERE nat.unit_id = n.unit_id
                   AND nat.id_bling::text = n.natureza_operacao_id::text
                   AND nat.active = true
                 ORDER BY nat.id LIMIT 1
               ) AS "natureDescription",
               n.loja_id::text AS "salesChannelId"
        FROM nfe n
        WHERE n.id = ${nfeId} AND n.unit_id = ${context.tenantId}
        LIMIT 1
      `,
    );
    const invoice = invoices[0];
    if (!invoice)
      throw new BadRequestError("NF-e não encontrada na unidade ativa");
    const policy = resolveNfeSyncPolicy(
      await this.database.nfeSyncPolicy.findUnique({
        where: { tenantId: context.tenantId },
      }),
    );
    const ignoredReason = summaryPolicyReason(
      {
        status: invoice.status,
        direction: invoice.direction,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        customerDocument: invoice.customerDocument,
        natureId: invoice.natureId,
        natureDescription: invoice.natureDescription,
        salesChannelId: invoice.salesChannelId,
      },
      policy,
    );
    if (ignoredReason) {
      await this.#removeIgnoredInvoice(context, invoice, ignoredReason);
      return { mode: "production", ignored: true, reason: ignoredReason };
    }

    const detail = await this.#bling.getNfeDetail(context, invoice.blingId);
    const detailIgnoredReason = detailPolicyReason(
      { sellerId: detail.sellerId, total: detail.total },
      policy,
    );
    if (detailIgnoredReason) {
      await this.#removeIgnoredInvoice(context, invoice, detailIgnoredReason);
      return {
        mode: "production",
        ignored: true,
        reason: detailIgnoredReason,
      };
    }
    const itemPolicyConfigured =
      policy.enabled &&
      [
        policy.includedCfops,
        policy.excludedCfops,
        policy.includedSkus,
        policy.excludedSkus,
        policy.includedNcms,
        policy.excludedNcms,
      ].some((values) => values.length > 0);
    if (itemPolicyConfigured && !detail.xmlUrl) {
      const reason = "XML indisponível para validar regras de item";
      await this.#removeIgnoredInvoice(context, invoice, reason);
      return { mode: "production", ignored: true, reason };
    }
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
                WHERE unit_id = ${context.tenantId}
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
          AND unit_id = ${context.tenantId}
      `);

      if (contact) {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE pessoa
          SET telefone_contato = ${contact.phone ?? null},
              celular = ${contact.mobile ?? null}
          WHERE id_bling = ${contact.id}
            AND unit_id = ${context.tenantId}
        `);
      }

      await transaction.$executeRaw(Prisma.sql`
        UPDATE nfe
        SET codigo_rastreio = ${uniqueTrackingCodes[0] ?? null},
            codigo_rastreio2 = ${uniqueTrackingCodes[1] ?? null}
        WHERE id = ${invoice.id}
          AND unit_id = ${context.tenantId}
      `);

      // Ressincronização é uma reconstrução do estado remoto atual. Assim,
      // boletos removidos ou alterados no Bling não permanecem como lixo local.
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM boleto
        WHERE unit_id = ${context.tenantId}
          AND nfe_id_bling::text = ${invoice.blingId}
      `);

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
              contato_id = ${receivable?.contactId ?? null}
          WHERE conta_id = ${account.id}
            AND unit_id = ${context.tenantId}
        `);
        if (updated === 0) {
          await transaction.$executeRaw(Prisma.sql`
            INSERT INTO boleto (
              nfe_id,
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
              ${invoice.id},
              ${invoice.blingId},
              ${boletoBatch.saleNumber ?? null},
              ${boletoBatch.total ?? null},
              ${account.id},
              ${account.externalNumber ?? null},
              NULLIF(${account.dueDate ?? null}, '')::date,
              ${account.value ?? null},
              ${account.status ?? null},
              ${receivable?.boletoUrl ?? null},
              ${receivable?.contactId ?? null},
              ${context.tenantId}
            )
          `);
        }
      }

      await transaction.$executeRaw(Prisma.sql`
        UPDATE nfe current
        SET invoice_message_status = CASE
              WHEN current.invoice_message_status = 'sent' THEN 'sent'::"MessageStatus"
              WHEN EXISTS (
                SELECT 1 FROM canal_venda channel
                WHERE channel.unit_id = current.unit_id
                  AND channel.loja_id = current.loja_id
                  AND LOWER(COALESCE(channel.tipo, '')) = 'mercadolivre'
              ) THEN 'skipped'::"MessageStatus"
              WHEN NOT EXISTS (
                SELECT 1 FROM pessoa person
                WHERE person.unit_id = current.unit_id
                  AND person.id_bling = current.contato_id_bling
              ) THEN 'failed'::"MessageStatus"
              WHEN COALESCE((
                SELECT NULLIF(BTRIM(person.celular), '') FROM pessoa person
                WHERE person.unit_id = current.unit_id
                  AND person.id_bling = current.contato_id_bling
                ORDER BY person.id LIMIT 1
              ), '') = '' THEN 'failed'::"MessageStatus"
              WHEN NULLIF(BTRIM(current.link_pdf), '') IS NULL THEN 'failed'::"MessageStatus"
              ELSE 'pending'::"MessageStatus"
            END,
            obs_envio = CASE
              WHEN current.invoice_message_status = 'sent' THEN COALESCE(current.obs_envio, 'NF-e enviada')
              WHEN EXISTS (
                SELECT 1 FROM canal_venda channel
                WHERE channel.unit_id = current.unit_id
                  AND channel.loja_id = current.loja_id
                  AND LOWER(COALESCE(channel.tipo, '')) = 'mercadolivre'
              ) THEN 'Envio automático desabilitado para Mercado Livre'
              WHEN NOT EXISTS (
                SELECT 1 FROM pessoa person
                WHERE person.unit_id = current.unit_id
                  AND person.id_bling = current.contato_id_bling
              ) THEN 'Contato não encontrado'
              WHEN COALESCE((
                SELECT NULLIF(BTRIM(person.celular), '') FROM pessoa person
                WHERE person.unit_id = current.unit_id
                  AND person.id_bling = current.contato_id_bling
                ORDER BY person.id LIMIT 1
              ), '') = '' THEN 'Contato sem celular'
              WHEN NULLIF(BTRIM(current.link_pdf), '') IS NULL THEN 'PDF da NF-e indisponível'
              ELSE 'NF-e pronta para envio'
            END
        WHERE current.id = ${invoice.id}
          AND current.unit_id = ${context.tenantId}
      `);
    });

    let xmlCalculation: NfeXmlProcessResult | null = null;
    let xmlCalculationError: string | null = null;
    if (detail.xmlUrl) {
      try {
        xmlCalculation = await this.#nfeXml.process({
          tenantId: context.tenantId,
          unitId: context.tenantId,
          nfeId: invoice.id,
          xmlUrl: detail.xmlUrl,
          correlationId: context.correlationId,
          ...(policy.enabled
            ? {
                itemPolicy: {
                  includedCfops: policy.includedCfops,
                  excludedCfops: policy.excludedCfops,
                  includedSkus: policy.includedSkus,
                  excludedSkus: policy.excludedSkus,
                  includedNcms: policy.includedNcms,
                  excludedNcms: policy.excludedNcms,
                },
              }
            : {}),
        });
        if (xmlCalculation.ignored) {
          const reason =
            xmlCalculation.ignoredReason ?? "Regra de item bloqueou a NF-e";
          await this.#removeIgnoredInvoice(context, invoice, reason);
          return { mode: "production", ignored: true, reason };
        }
      } catch (error) {
        xmlCalculationError =
          error instanceof Error
            ? error.message
            : "Falha desconhecida ao calcular a NF-e";
        await this.database.$executeRaw(Prisma.sql`
          UPDATE nfe
          SET calculation_status = 'failed'::"CalculationStatus", obs_calculo = ${xmlCalculationError.slice(0, 500)}
          WHERE id = ${invoice.id} AND unit_id = ${context.tenantId}
        `);
      }
    }

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
          calculation: xmlCalculation ? { ...xmlCalculation } : null,
          calculationError: xmlCalculationError,
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
      calculation: xmlCalculation,
      calculationError: xmlCalculationError,
    };
  }

  async processNfeXml(
    context: GatewayContext & { demo: false },
    nfeId: number,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.database.tenant.findUnique({
      where: { id: context.tenantId },
      select: { demo: true, active: true },
    });
    if (!tenant?.active || tenant.demo)
      throw new BadRequestError("Tenant sem unidade produtiva ativa");
    const invoice = (
      await this.database.$queryRaw<LegacyInvoiceXmlRow[]>(Prisma.sql`
        SELECT id, link_xml AS "xmlUrl"
        FROM nfe
        WHERE id = ${nfeId} AND unit_id = ${context.tenantId}
        LIMIT 1
      `)
    )[0];
    if (!invoice)
      throw new BadRequestError("NF-e não encontrada na unidade ativa");
    if (!invoice.xmlUrl)
      throw new BadRequestError("NF-e ainda não possui XML sincronizado");
    const calculation = await this.#nfeXml.process({
      tenantId: context.tenantId,
      unitId: context.tenantId,
      nfeId: invoice.id,
      xmlUrl: invoice.xmlUrl,
      correlationId: context.correlationId,
    });
    return { mode: "production", nfeId: invoice.id, calculation };
  }

  async deliverApChat(
    context: GatewayContext & { demo: false },
    message: ApChatMessage,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.database.tenant.findUnique({
      where: { id: context.tenantId },
      select: { demo: true, active: true },
    });
    if (!tenant?.active || tenant.demo)
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

  async deliverNfe(
    context: GatewayContext & { demo: false },
    nfeId: number,
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    const rows = await this.database.$queryRaw<NfeDeliveryRow[]>(Prisma.sql`
      SELECT
        n.id,
        n.numero::text AS number,
        CASE n.invoice_message_status WHEN 'sent' THEN 1 WHEN 'pending' THEN 2 WHEN 'failed' THEN 3 ELSE 4 END AS "statusId",
        NULLIF(BTRIM(n.link_pdf), '') AS "pdfUrl",
        NULLIF(BTRIM(n.codigo_rastreio), '') AS "trackingCode",
        NULLIF(BTRIM(p.nome), '') AS "customerName",
        NULLIF(BTRIM(p.celular), '') AS mobile,
        COALESCE(p.desabilitar_envio, FALSE) AS "messagingDisabled",
        unit.name AS "companyName",
        boleto."boletoUrl"
      FROM nfe n
      JOIN saas_tenant unit ON unit.id = n.unit_id
      LEFT JOIN pessoa p
        ON p.id_bling = n.contato_id_bling
       AND p.unit_id = n.unit_id
      LEFT JOIN LATERAL (
        SELECT NULLIF(BTRIM(b.link_boleto), '') AS "boletoUrl"
        FROM boleto b
        WHERE b.nfe_id_bling = n.id_bling
          AND b.unit_id = n.unit_id
          AND NULLIF(BTRIM(b.link_boleto), '') IS NOT NULL
        ORDER BY b.vencimento NULLS LAST, b.id
        LIMIT 1
      ) boleto ON TRUE
      WHERE n.id = ${nfeId}
        AND n.unit_id = ${unitId}
      LIMIT 1
    `);
    const invoice = rows[0];
    if (!invoice) throw new BadRequestError("NF-e não encontrada");
    if (invoice.statusId !== 2)
      throw new BadRequestError("NF-e não está pronta para envio");
    if (invoice.messagingDisabled) {
      await this.#markDeliveryIssue(
        unitId,
        nfeId,
        "skipped",
        "Mensagens desabilitadas para o contato",
      );
      return { mode: "production", nfeId, skipped: "messaging_disabled" };
    }
    if (!invoice.mobile) {
      await this.#markDeliveryIssue(
        unitId,
        nfeId,
        "failed",
        "Contato sem celular. Abra o contato da nota e informe um número com DDD.",
      );
      return { mode: "production", nfeId, skipped: "mobile_missing" };
    }
    if (!invoice.pdfUrl) {
      await this.#markDeliveryIssue(
        unitId,
        nfeId,
        "failed",
        "DANFE indisponível. Ressincronize os documentos da NF-e antes do envio.",
      );
      throw new BadRequestError(
        "NF-e sem DANFE. Ressincronize documentos antes do envio",
      );
    }

    let body = `Olá ${invoice.customerName ?? "cliente"}, aqui é da ${invoice.companyName}!\n\nNota Fiscal: ${invoice.pdfUrl}`;
    if (invoice.boletoUrl) body += `\n\nBoleto: ${invoice.boletoUrl}`;
    if (invoice.trackingCode) {
      body += `\n\nRastreio: https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(invoice.trackingCode)}`;
    }

    const idempotencyKey = `nfe-${context.tenantId}-${nfeId}`;
    let delivery: Awaited<ReturnType<ApChatRealGateway["deliver"]>>;
    try {
      delivery = await this.#apchat.deliver(context, {
        recipient: invoice.mobile,
        body,
        idempotencyKey,
      });
    } catch (error) {
      await this.#markDeliveryIssue(
        unitId,
        nfeId,
        "failed",
        deliveryFailureReason(error),
      );
      throw error;
    }
    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`
        UPDATE nfe
        SET invoice_message_status = 'sent'::"MessageStatus",
            obs_envio = 'NF-e enviada pelo APChat',
            data_nota_envio = CURRENT_TIMESTAMP
        WHERE id = ${nfeId}
          AND unit_id = ${unitId}
          AND invoice_message_status = 'pending'
      `);
      await transaction.auditLog.create({
        data: {
          tenantId: context.tenantId,
          actorUserId: null,
          action: "nfe.delivery.accepted",
          entityType: "nfe",
          entityId: String(nfeId),
          correlationId: context.correlationId,
          metadata: {
            externalId: delivery.externalId,
            idempotencyKey,
            boleto: Boolean(invoice.boletoUrl),
            tracking: Boolean(invoice.trackingCode),
          },
        },
      });
    });
    return {
      mode: "production",
      nfeId,
      accepted: delivery.accepted,
      externalId: delivery.externalId,
    };
  }

  async updateContact(
    context: GatewayContext & { demo: false },
    input: {
      nfeId: number;
      contactId: number;
      contactBlingId: string;
      mobilePhone: string;
      messagingDisabled: boolean;
    },
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    const rows = await this.database.$queryRaw<
      Array<{ id: number; blingId: string }>
    >(Prisma.sql`
      SELECT p.id, p.id_bling::text AS "blingId"
      FROM nfe n
      JOIN pessoa p ON p.id_bling = n.contato_id_bling AND p.unit_id = n.unit_id
      WHERE n.id = ${input.nfeId}
        AND p.id = ${input.contactId}
        AND p.id_bling = ${input.contactBlingId}
        AND n.unit_id = ${unitId}
      LIMIT 1
    `);
    const contact = rows[0];
    if (!contact) throw new BadRequestError("Contato da NF-e não encontrado");

    await this.#bling.updateContactMobile(
      context,
      contact.blingId,
      input.mobilePhone,
    );

    const affected = await this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`
        UPDATE pessoa
        SET celular = ${input.mobilePhone || null},
            desabilitar_envio = ${input.messagingDisabled}
        WHERE id = ${contact.id} AND unit_id = ${unitId}
      `);
      const updated = await transaction.$executeRaw(Prisma.sql`
        UPDATE nfe current
        SET invoice_message_status = CASE
              WHEN current.invoice_message_status = 'sent' THEN 'sent'::"MessageStatus"
              WHEN ${input.messagingDisabled} THEN 'skipped'::"MessageStatus"
              WHEN EXISTS (
                SELECT 1 FROM canal_venda channel
                WHERE channel.unit_id = current.unit_id
                  AND channel.loja_id = current.loja_id
                  AND LOWER(COALESCE(channel.tipo, '')) = 'mercadolivre'
              ) THEN 'skipped'::"MessageStatus"
              WHEN ${input.mobilePhone} = '' THEN 'failed'::"MessageStatus"
              WHEN NULLIF(BTRIM(current.link_pdf), '') IS NULL THEN 'failed'::"MessageStatus"
              ELSE 'pending'::"MessageStatus"
            END,
            obs_envio = CASE
              WHEN current.invoice_message_status = 'sent' THEN COALESCE(current.obs_envio, 'NF-e enviada')
              WHEN ${input.messagingDisabled} THEN 'Mensagens desabilitadas para o contato'
              WHEN EXISTS (
                SELECT 1 FROM canal_venda channel
                WHERE channel.unit_id = current.unit_id
                  AND channel.loja_id = current.loja_id
                  AND LOWER(COALESCE(channel.tipo, '')) = 'mercadolivre'
              ) THEN 'Envio automático desabilitado para Mercado Livre'
              WHEN ${input.mobilePhone} = '' THEN 'Contato sem celular'
              WHEN NULLIF(BTRIM(current.link_pdf), '') IS NULL THEN 'PDF da NF-e indisponível'
              ELSE 'NF-e pronta para envio'
            END
        WHERE current.unit_id = ${unitId}
          AND current.contato_id_bling = ${contact.blingId}
      `);
      await transaction.auditLog.create({
        data: {
          tenantId: context.tenantId,
          actorUserId: null,
          action: "contact.updated-in-bling",
          entityType: "pessoa",
          entityId: String(contact.id),
          correlationId: context.correlationId,
          metadata: {
            messagingDisabled: input.messagingDisabled,
            affectedInvoices: updated,
          },
        },
      });
      return updated;
    });
    return {
      mode: "production",
      contactId: contact.id,
      affectedInvoices: affected,
    };
  }

  async deliverSatisfactionSurveys(
    context: GatewayContext & { demo: false },
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    const due = await this.database.$queryRaw<SatisfactionDeliveryRow[]>(
      Prisma.sql`
        SELECT
          n.id,
          n.numero::text AS number,
          p.nome AS "customerName",
          p.celular AS mobile,
          unit.name AS "companyName",
          config.msg AS message,
          config.link AS "surveyLink"
        FROM nfe n
        JOIN pessoa p
          ON p.id_bling = n.contato_id_bling
         AND p.unit_id = n.unit_id
        JOIN saas_tenant unit ON unit.id = n.unit_id
        JOIN pesquisa_satisfacao config ON config.unit_id = n.unit_id
        WHERE n.unit_id = ${unitId}
          AND n.invoice_message_status = 'sent'
          AND n.satisfaction_message_status = 'pending'
          AND n.data_nota_envio IS NOT NULL
          AND config.habilitar = TRUE
          AND NULLIF(BTRIM(config.msg), '') IS NOT NULL
          AND NULLIF(BTRIM(config.link), '') IS NOT NULL
          AND COALESCE(p.desabilitar_envio, FALSE) = FALSE
          AND NULLIF(BTRIM(p.celular), '') IS NOT NULL
          AND (
            n.data_nota_envio::date + COALESCE(config.tempo_dia_env, 0)
          ) = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
        ORDER BY n.data_nota_envio, n.id
      `,
    );

    let delivered = 0;
    for (const invoice of due) {
      const body = plainMessage(invoice.message)
        .replaceAll("{cliente}", invoice.customerName)
        .replaceAll("{pesquisa}", invoice.surveyLink)
        .replaceAll("{empresa}", invoice.companyName);
      const idempotencyKey = `satisfaction-${context.tenantId}-${invoice.id}`;
      const delivery = await this.#apchat.deliver(context, {
        recipient: invoice.mobile,
        body,
        idempotencyKey,
      });
      await this.database.$transaction(async (transaction) => {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE nfe
          SET satisfaction_message_status = 'sent'::"MessageStatus",
              data_pesquisa_envio = CURRENT_TIMESTAMP
          WHERE id = ${invoice.id}
            AND unit_id = ${unitId}
            AND satisfaction_message_status = 'pending'
        `);
        await transaction.auditLog.create({
          data: {
            tenantId: context.tenantId,
            actorUserId: null,
            action: "satisfaction.delivery.accepted",
            entityType: "nfe",
            entityId: String(invoice.id),
            correlationId: context.correlationId,
            metadata: {
              invoiceNumber: invoice.number,
              externalId: delivery.externalId,
              idempotencyKey,
            },
          },
        });
      });
      delivered += 1;
    }
    return { mode: "production", due: due.length, delivered, unitId };
  }

  async processExpiredGoals(
    context: GatewayContext & { demo: false },
  ): Promise<Record<string, unknown>> {
    const unitId = await this.#productionUnit(context.tenantId);
    const expired = await this.database.$queryRaw<IdRow[]>(Prisma.sql`
      SELECT id
      FROM meta
      WHERE unit_id = ${unitId}
        AND status = 'open'
        AND data_final IS NOT NULL
        AND data_final::date < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
      ORDER BY id
    `);
    let processed = 0;
    for (const candidate of expired) {
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
          WHERE id = ${candidate.id}
            AND unit_id = ${unitId}
          FOR UPDATE
        `);
        const goal = rows[0];
        if (
          !goal ||
          goal.statusId !== 1 ||
          !goal.nextStart ||
          !goal.nextEnd ||
          !goal.nextCompetence
        ) {
          return;
        }
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
          WHERE id = ${goal.id}
            AND unit_id = ${unitId}
            AND status = 'open'
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
            FROM meta_custo WHERE meta_id = ${goal.id}
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
            FROM meta_vendedores WHERE meta_id = ${goal.id}
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
            FROM meta_setor WHERE meta_id = ${goal.id}
          `);
        }
        await transaction.operationalLog.create({
          data: {
            tenantId: unitId,
            jobType: "goals.lifecycle",
            operation: "process_expired",
            status: "completed",
            message: `Meta ${goal.id} finalizada automaticamente.`,
            details: {
              nextGoalId,
              nextCompetence: goal.nextCompetence,
            },
            correlationId: context.correlationId,
          },
        });
        await transaction.auditLog.create({
          data: {
            tenantId: context.tenantId,
            actorUserId: null,
            action: "goals.expired.processed",
            entityType: "goal",
            entityId: String(goal.id),
            correlationId: context.correlationId,
            metadata: {
              nextGoalId,
              nextCompetence: goal.nextCompetence,
              nextGoalAlreadyExisted: existing.length > 0,
            },
          },
        });
        processed += 1;
      });
    }
    return { mode: "production", expired: expired.length, processed, unitId };
  }

  async #productionUnit(tenantId: string): Promise<string> {
    const tenant = await this.database.tenant.findUnique({
      where: { id: tenantId },
      select: { demo: true, active: true },
    });
    if (!tenant?.active || tenant.demo)
      throw new BadRequestError("Tenant sem unidade produtiva ativa");
    return tenantId;
  }

  async #markDeliveryIssue(
    unitId: string,
    nfeId: number,
    status: "failed" | "skipped",
    reason: string,
  ): Promise<void> {
    await this.database.$executeRaw(Prisma.sql`
      UPDATE nfe
      SET invoice_message_status = ${status}::"MessageStatus",
          obs_envio = ${reason}
      WHERE id = ${nfeId}
        AND unit_id = ${unitId}
        AND invoice_message_status <> 'sent'
    `);
  }

  async #removeIgnoredInvoice(
    context: GatewayContext,
    invoice: LegacyInvoiceRow,
    reason: string,
  ): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM boleto
        WHERE unit_id = ${context.tenantId}
          AND nfe_id_bling::text = ${invoice.blingId}
      `);
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM nfe
        WHERE id = ${invoice.id} AND unit_id = ${context.tenantId}
      `);
    });
    await this.database.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: null,
        action: "nfe.synchronization.ignored",
        entityType: "nfe",
        entityId: String(invoice.id),
        correlationId: context.correlationId,
        metadata: { blingId: invoice.blingId, reason },
      },
    });
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

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Falha desconhecida";
}

function deliveryFailureReason(error: unknown): string {
  const message = safeErrorMessage(error);
  if (message.includes("ApChatHttpError:401"))
    return "APChat recusou a autenticação (401). Revise o token do canal.";
  if (message.includes("ApChatHttpError:403"))
    return "APChat recusou a credencial ou o acesso ao canal (403). Confirme se UUID, token e URL pertencem à mesma conta.";
  if (message.includes("ApChatHttpError:429"))
    return "Limite temporário do APChat atingido (429). O worker tentará novamente.";
  if (message.includes("ApChat"))
    return `Falha no APChat: ${message.slice(0, 180)}`;
  return "Falha inesperada ao enviar a NF-e. Consulte Jobs e integrações para os detalhes técnicos.";
}

function plainMessage(value: string): string {
  return value
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .trim();
}

function decodeSecret(value: Uint8Array | null): string | null {
  return decryptSecret(value);
}

class PrismaApChatCredentialProvider implements ApChatCredentialProvider {
  constructor(private readonly database: DatabaseClient) {}

  async getCredentials(tenantId: string): Promise<ApChatCredentials> {
    const config = await this.database.apChatConfig.findUnique({
      where: { tenantId },
    });
    const uuid = decodeSecret(config?.workspaceIdCiphertext ?? null);
    const token = decodeSecret(config?.tokenCiphertext ?? null);
    if (!config?.enabled || !uuid || !token)
      throw new BadRequestError("APChat não configurado para a empresa");
    return {
      uuid,
      token,
      messagesOpen: config.sendMessages,
      ...(config.testPhone ? { testRecipient: config.testPhone } : {}),
    };
  }
}

class PrismaBlingTokenRepository implements BlingTokenRepository {
  constructor(private readonly database: DatabaseClient) {}

  async findByTenant(tenantId: string): Promise<BlingTokenRecord | null> {
    const credential = await this.database.oAuthCredential.findUnique({
      where: { tenantId_kind: { tenantId, kind: "bling" } },
    });
    const accessToken = decodeSecret(credential?.accessTokenCiphertext ?? null);
    const refreshToken = decodeSecret(
      credential?.refreshTokenCiphertext ?? null,
    );
    if (
      !credential ||
      !accessToken ||
      !refreshToken ||
      credential.accessTokenExpiresAt === null ||
      (credential.status !== "connected" && credential.status !== "pending")
    )
      return null;
    return {
      tenantId,
      accessToken,
      refreshToken,
      expiresAtEpochSeconds: Math.floor(
        credential.accessTokenExpiresAt.getTime() / 1_000,
      ),
      status: credential.status === "connected" ? "S" : "R",
    };
  }

  async save(record: BlingTokenRecord): Promise<void> {
    await this.database.oAuthCredential.update({
      where: {
        tenantId_kind: { tenantId: record.tenantId, kind: "bling" },
      },
      data: {
        accessTokenCiphertext: encryptSecret(record.accessToken),
        refreshTokenCiphertext: encryptSecret(record.refreshToken),
        accessTokenExpiresAt: new Date(record.expiresAtEpochSeconds * 1_000),
        status: record.status === "S" ? "connected" : "pending",
      },
    });
  }
}

class PrismaBlingCredentialProvider implements BlingCredentialProvider {
  constructor(private readonly database: DatabaseClient) {}

  async getCredentials(tenantId: string): Promise<BlingClientCredentials> {
    const credential = await this.database.oAuthCredential.findUnique({
      where: { tenantId_kind: { tenantId, kind: "bling" } },
    });
    const clientId =
      decodeSecret(credential?.clientIdCiphertext ?? null) ??
      process.env["BLING_CLIENT_ID"];
    const clientSecret =
      decodeSecret(credential?.clientSecretCiphertext ?? null) ??
      process.env["BLING_CLIENT_SECRET"];
    if (!clientId || !clientSecret)
      throw new BadRequestError("Credenciais OAuth Bling não configuradas");
    return { clientId, clientSecret };
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
        await transaction.$queryRaw<Array<{ acquired: number }>>(Prisma.sql`
          WITH acquired_lock AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
          )
          SELECT 1::int AS acquired
          FROM acquired_lock
        `);
        return operation();
      },
      { maxWait: ttlMs, timeout: ttlMs + 35_000 },
    );
  }
}

class PrismaBlingRateLimiter implements BlingRateLimiter {
  constructor(private readonly database: DatabaseClient) {}

  async waitForTurn(context: GatewayContext): Promise<void> {
    const rows = await this.database.$transaction(async (transaction) =>
      transaction.$queryRaw<Array<{ waitMs: number }>>(Prisma.sql`
        INSERT INTO integration_rate_limit (
          tenant_id,
          kind,
          next_available_at,
          updated_at
        ) VALUES (
          ${context.tenantId}::uuid,
          'bling'::"IntegrationKind",
          NOW() + INTERVAL '400 milliseconds',
          NOW()
        )
        ON CONFLICT (tenant_id, kind) DO UPDATE
        SET
          next_available_at = GREATEST(
            NOW(),
            integration_rate_limit.next_available_at
          ) + INTERVAL '400 milliseconds',
          updated_at = NOW()
        RETURNING GREATEST(
          0,
          FLOOR(
            EXTRACT(EPOCH FROM (
              next_available_at - NOW() - INTERVAL '400 milliseconds'
            )) * 1000
          )
        )::int AS "waitMs"
      `),
    );
    const waitMs = rows[0]?.waitMs ?? 0;
    if (waitMs > 0)
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
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
