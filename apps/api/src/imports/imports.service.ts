import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  csvImportMetadataResponseSchema,
  csvImportResultSchema,
  type CsvImportEntity,
  type CsvImportExecute,
  type CsvImportMetadataResponse,
  type CsvImportResult,
} from "@integrador/contracts";
import { Prisma, type DatabaseClient } from "@integrador/db";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";
import {
  CSV_IMPORT_BY_ENTITY,
  CSV_IMPORT_ENTITIES,
  importPermission,
} from "./imports.metadata.js";

type Row = Record<string, string>;
type Counters = { created: number; updated: number };

@Injectable()
export class ImportsService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  metadata(principal: AuthPrincipal): CsvImportMetadataResponse {
    return csvImportMetadataResponseSchema.parse({
      entities: CSV_IMPORT_ENTITIES.filter((entity) =>
        principal.permissions.includes(entity.permission),
      ),
    });
  }

  async execute(
    principal: AuthPrincipal,
    input: CsvImportExecute,
  ): Promise<CsvImportResult> {
    if (principal.tenantDemo)
      throw new BadRequestException("Importação indisponível na demonstração");
    const permission = importPermission(input.entity);
    if (!principal.permissions.includes(permission))
      throw new ForbiddenException("Sem permissão para importar este cadastro");
    const definition = CSV_IMPORT_BY_ENTITY.get(input.entity)!;
    const required = definition.fields.filter((item) => item.required);
    const run = await this.database.legacyImportRun.create({
      data: {
        tenantId: principal.activeTenantId,
        status: "running",
        startedAt: new Date(),
        statistics: { entity: input.entity, received: input.rows.length },
      },
    });
    const result: CsvImportResult = {
      entity: input.entity,
      processed: input.rows.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };
    for (const [index, row] of input.rows.entries()) {
      try {
        const missing = required.filter((item) => !clean(row[item.key]));
        if (missing.length)
          throw new Error(
            `Campos obrigatórios ausentes: ${missing.map((item) => item.label).join(", ")}`,
          );
        const counter = await this.importRow(
          principal.activeTenantId,
          input.entity,
          row,
        );
        result.created += counter.created;
        result.updated += counter.updated;
      } catch (cause) {
        result.failed += 1;
        if (result.errors.length < 50)
          result.errors.push({
            row: index + 1,
            message: safeMessage(cause),
          });
      }
    }
    await this.database.$transaction([
      this.database.legacyImportRun.update({
        where: { id: run.id },
        data: {
          status: result.failed === result.processed ? "failed" : "completed",
          finishedAt: new Date(),
          statistics: result,
          errorMessage:
            result.failed === result.processed
              ? "Nenhuma linha pôde ser importada"
              : null,
        },
      }),
      this.database.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "csv.import.completed",
          entityType: input.entity,
          entityId: run.id,
          correlationId: run.id,
          metadata: {
            processed: result.processed,
            created: result.created,
            updated: result.updated,
            failed: result.failed,
          },
        },
      }),
    ]);
    return csvImportResultSchema.parse(result);
  }

  private async importRow(
    tenantId: string,
    entity: CsvImportEntity,
    row: Row,
  ): Promise<Counters> {
    switch (entity) {
      case "product-groups":
        return this.productGroup(tenantId, row);
      case "products":
        return this.product(tenantId, row);
      case "contacts":
        return this.contact(tenantId, row);
      case "sellers":
        return this.seller(tenantId, row);
      case "sales-channels":
        return this.salesChannel(tenantId, row);
      case "payment-methods":
        return this.paymentMethod(tenantId, row);
      case "operation-natures":
        return this.operationNature(tenantId, row);
      case "sales-orders":
        return this.salesOrder(tenantId, row);
      case "invoices":
        return this.invoice(tenantId, row);
      case "invoice-items":
        return this.invoiceItem(tenantId, row);
      case "bills":
        return this.bill(tenantId, row);
      case "tracking-codes":
        return this.trackingCode(tenantId, row);
    }
  }

  private async productGroup(tenantId: string, row: Row): Promise<Counters> {
    const externalBlingId = required(row, "externalId");
    const existing = await this.database.productGroup.findUnique({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      select: { id: true },
    });
    await this.database.productGroup.upsert({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      create: {
        tenantId,
        externalBlingId,
        name: required(row, "name"),
        ownManufacture: boolean(row.ownManufacture),
      },
      update: {
        name: required(row, "name"),
        ownManufacture: boolean(row.ownManufacture),
      },
    });
    return count(existing);
  }

  private async product(tenantId: string, row: Row): Promise<Counters> {
    const externalBlingId = required(row, "externalId");
    const group = await this.findGroup(tenantId, row);
    const existing = await this.database.product.findUnique({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      select: { id: true },
    });
    const data = {
      sku: clean(row.sku),
      name: required(row, "name"),
      description: clean(row.description),
      ncm: digits(row.ncm)?.slice(0, 8) ?? null,
      cost: decimal(row.cost),
      groupId: group?.id ?? null,
      active: boolean(row.active, true),
      ownManufacture:
        boolean(row.ownManufacture) || group?.ownManufacture === true,
      monophase: boolean(row.monophase),
      lastSynchronizedAt: new Date(),
    };
    await this.database.product.upsert({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      create: { tenantId, externalBlingId, ...data },
      update: data,
    });
    return count(existing);
  }

  private async contact(tenantId: string, row: Row): Promise<Counters> {
    const externalBlingId = required(row, "externalId");
    const existing = await this.database.contact.findUnique({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      select: { id: true },
    });
    const contact = await this.database.contact.upsert({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      create: {
        tenantId,
        externalBlingId,
        name: required(row, "name"),
        documentNumber: digits(row.document),
        stateRegistration: clean(row.stateRegistration),
        identityDocument: clean(row.identityDocument),
        phone: clean(row.phone),
        contactPhone: clean(row.phone),
        mobilePhone: clean(row.mobile),
        email: clean(row.email)?.toLowerCase() ?? null,
        messagingDisabled: boolean(row.messagingDisabled),
      },
      update: {
        name: required(row, "name"),
        documentNumber: digits(row.document),
        stateRegistration: clean(row.stateRegistration),
        identityDocument: clean(row.identityDocument),
        phone: clean(row.phone),
        mobilePhone: clean(row.mobile),
        email: clean(row.email)?.toLowerCase() ?? null,
        messagingDisabled: boolean(row.messagingDisabled),
      },
    });
    if (
      [row.street, row.number, row.city, row.state, row.postalCode].some(clean)
    ) {
      const address = await this.database.contactAddress.findFirst({
        where: { tenantId, contactId: contact.id },
        orderBy: { id: "asc" },
      });
      const data = {
        street: clean(row.street),
        number: clean(row.number),
        complement: clean(row.complement),
        district: clean(row.district),
        postalCode: clean(row.postalCode),
        city: clean(row.city),
        state: clean(row.state)?.toUpperCase().slice(0, 2) ?? null,
        primary: true,
      };
      if (address)
        await this.database.contactAddress.update({
          where: { id: address.id },
          data,
        });
      else
        await this.database.contactAddress.create({
          data: { tenantId, contactId: contact.id, ...data },
        });
    }
    return count(existing);
  }

  private async seller(tenantId: string, row: Row): Promise<Counters> {
    const externalBlingId = required(row, "externalId");
    const sectorName = clean(row.sectorName);
    const sector = sectorName
      ? await this.database.sector.upsert({
          where: { tenantId_name: { tenantId, name: sectorName } },
          create: { tenantId, name: sectorName },
          update: {},
        })
      : null;
    const existing = await this.database.seller.findUnique({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      select: { id: true },
    });
    const data = {
      name: required(row, "name"),
      sectorId: sector?.id ?? null,
      active: boolean(row.active, true),
    };
    await this.database.seller.upsert({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      create: { tenantId, externalBlingId, ...data },
      update: data,
    });
    return count(existing);
  }

  private async salesChannel(tenantId: string, row: Row): Promise<Counters> {
    const externalBlingId = required(row, "externalId");
    const existing = await this.database.salesChannel.findUnique({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      select: { id: true },
    });
    const data = {
      description: required(row, "description"),
      type: clean(row.type),
      active: boolean(row.active, true),
    };
    await this.database.salesChannel.upsert({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      create: { tenantId, externalBlingId, ...data },
      update: data,
    });
    return count(existing);
  }

  private async paymentMethod(tenantId: string, row: Row): Promise<Counters> {
    const externalBlingId = required(row, "externalId");
    const existing = await this.database.paymentMethod.findUnique({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      select: { id: true },
    });
    const data = {
      description: required(row, "description"),
      paymentType: clean(row.paymentType),
      active: boolean(row.active, true),
    };
    await this.database.paymentMethod.upsert({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      create: { tenantId, externalBlingId, ...data },
      update: data,
    });
    return count(existing);
  }

  private async operationNature(tenantId: string, row: Row): Promise<Counters> {
    const externalBlingId = required(row, "externalId");
    const existing = await this.database.operationNature.findUnique({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      select: { id: true },
    });
    const data = {
      description: required(row, "description"),
      active: boolean(row.active, true),
    };
    await this.database.operationNature.upsert({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      create: { tenantId, externalBlingId, ...data },
      update: data,
    });
    return count(existing);
  }

  private async salesOrder(tenantId: string, row: Row): Promise<Counters> {
    const externalBlingId = required(row, "externalId");
    const existing = await this.database.salesOrder.findUnique({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      select: { id: true },
    });
    const data = {
      number: integer(row.number),
      issuedAt: date(row.issuedAt),
      total: decimal(row.total),
      statusCode: integer(row.statusCode),
      discount: decimal(row.discount),
      invoiceExternalId: clean(row.invoiceExternalId),
      commissionRate: decimal(row.commission),
      shippingCost: decimal(row.shippingCost),
      lastSynchronizedAt: new Date(),
    };
    await this.database.salesOrder.upsert({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      create: { tenantId, externalBlingId, ...data },
      update: data,
    });
    return count(existing);
  }

  private async invoice(tenantId: string, row: Row): Promise<Counters> {
    const externalBlingId = required(row, "externalId");
    const [contact, seller, channel, nature] = await Promise.all([
      this.findContact(tenantId, row.contactExternalId),
      this.findSeller(tenantId, row.sellerExternalId),
      this.findChannel(tenantId, row.channelExternalId),
      this.findNature(tenantId, row.natureExternalId),
    ]);
    if (contact && normalized(contact.name).includes("ebazar"))
      throw new Error("NF-e ignorada: cliente E-bazar");
    if (
      nature &&
      (!normalized(nature.description).includes("venda") ||
        normalized(nature.description).includes("devolucao"))
    )
      throw new Error("NF-e ignorada: natureza não elegível para venda");
    const existing = await this.database.invoice.findUnique({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      select: { id: true },
    });
    const data = {
      number: required(row, "number"),
      statusCode: integer(row.statusCode) ?? 0,
      issuedAt: date(row.issuedAt),
      direction: integer(row.direction),
      series: integer(row.series),
      accessKey: clean(row.accessKey),
      contactId: contact?.id ?? null,
      sellerId: seller?.id ?? null,
      salesChannelId: channel?.id ?? null,
      operationNatureId: nature?.id ?? null,
      contactExternalId: clean(row.contactExternalId),
      sellerExternalId: clean(row.sellerExternalId),
      salesChannelExternalId: clean(row.channelExternalId),
      operationNatureExternalId: clean(row.natureExternalId),
      total: decimal(row.total),
      xmlUrl: clean(row.xmlUrl),
      pdfUrl: clean(row.pdfUrl),
      calculationStatus: "pending" as const,
      calculationNotes: "Importada via CSV; ressincronize para recalcular",
      lastSynchronizedAt: new Date(),
    };
    await this.database.invoice.upsert({
      where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
      create: { tenantId, externalBlingId, ...data },
      update: data,
    });
    return count(existing);
  }

  private async invoiceItem(tenantId: string, row: Row): Promise<Counters> {
    const invoice = await this.findInvoice(tenantId, row.invoiceExternalId);
    if (!invoice) throw new Error("NF-e vinculada não encontrada");
    const lineNumber = integer(row.line);
    if (!lineNumber || lineNumber < 1)
      throw new Error("Número do item inválido");
    const product = await this.findProduct(tenantId, row.productExternalId);
    const existing = await this.database.invoiceItem.findUnique({
      where: { invoiceId_lineNumber: { invoiceId: invoice.id, lineNumber } },
      select: { id: true },
    });
    const quantity = decimal(row.quantity);
    const saleTotal = decimal(row.saleTotal);
    const saleUnit = clean(row.saleUnit)
      ? decimal(row.saleUnit)
      : quantity.equals(0)
        ? new Prisma.Decimal(0)
        : saleTotal.div(quantity);
    const costTotal = decimal(row.costTotal);
    const costUnit = clean(row.costUnit)
      ? decimal(row.costUnit)
      : quantity.equals(0)
        ? new Prisma.Decimal(0)
        : costTotal.div(quantity);
    const data = {
      tenantId,
      productId: product?.id ?? null,
      externalProductId: clean(row.productExternalId),
      description: clean(row.description),
      cfop: clean(row.cfop)?.slice(0, 8) ?? null,
      quantity,
      freight: decimal(row.freight),
      discount: decimal(row.discount),
      otherExpenses: decimal(row.otherExpenses),
      saleTotal,
      saleUnit,
      grossRevenueTotal: saleTotal,
      grossRevenueUnit: saleUnit,
      netRevenueTotal: saleTotal
        .minus(decimal(row.discount))
        .plus(decimal(row.freight))
        .plus(decimal(row.otherExpenses)),
      netRevenueUnit: saleUnit,
      costTotal,
      costUnit,
      grossCostTotal: costTotal,
      grossCostUnit: costUnit,
      netCostTotal: costTotal,
      netCostUnit: costUnit,
    };
    await this.database.invoiceItem.upsert({
      where: { invoiceId_lineNumber: { invoiceId: invoice.id, lineNumber } },
      create: { invoiceId: invoice.id, lineNumber, ...data },
      update: data,
    });
    return count(existing);
  }

  private async bill(tenantId: string, row: Row): Promise<Counters> {
    const invoiceExternalId = required(row, "invoiceExternalId");
    const externalAccountId = required(row, "accountExternalId");
    const invoice = await this.findInvoice(tenantId, invoiceExternalId);
    const existing = await this.database.bill.findFirst({
      where: { tenantId, externalAccountId },
      select: { id: true },
    });
    const data = {
      invoiceId: invoice?.id ?? null,
      invoiceExternalId,
      externalAccountId,
      externalNumber: clean(row.externalNumber),
      dueAt: date(row.dueAt),
      amount: decimal(row.amount),
      statusCode: integer(row.statusCode),
      url: clean(row.url),
    };
    if (existing)
      await this.database.bill.update({ where: { id: existing.id }, data });
    else await this.database.bill.create({ data: { tenantId, ...data } });
    return count(existing);
  }

  private async trackingCode(tenantId: string, row: Row): Promise<Counters> {
    const invoice = await this.findInvoice(tenantId, row.invoiceExternalId);
    if (!invoice) throw new Error("NF-e vinculada não encontrada");
    const code = required(row, "code");
    const existing = await this.database.trackingCode.findUnique({
      where: { invoiceId_code: { invoiceId: invoice.id, code } },
      select: { id: true },
    });
    await this.database.trackingCode.upsert({
      where: { invoiceId_code: { invoiceId: invoice.id, code } },
      create: {
        tenantId,
        invoiceId: invoice.id,
        code,
        carrier: clean(row.carrier),
        trackingUrl: clean(row.trackingUrl),
      },
      update: {
        carrier: clean(row.carrier),
        trackingUrl: clean(row.trackingUrl),
      },
    });
    return count(existing);
  }

  private findGroup(tenantId: string, row: Row) {
    const externalBlingId = clean(row.groupExternalId);
    const name = clean(row.groupName);
    if (!externalBlingId && !name) return null;
    return this.database.productGroup.findFirst({
      where: {
        tenantId,
        OR: [
          ...(externalBlingId ? [{ externalBlingId }] : []),
          ...(name
            ? [{ name: { equals: name, mode: "insensitive" as const } }]
            : []),
        ],
      },
      select: { id: true, ownManufacture: true },
    });
  }

  private findContact(tenantId: string, value: string | undefined) {
    const externalBlingId = clean(value);
    return externalBlingId
      ? this.database.contact.findUnique({
          where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
          select: { id: true, name: true },
        })
      : null;
  }
  private findSeller(tenantId: string, value: string | undefined) {
    const externalBlingId = clean(value);
    return externalBlingId
      ? this.database.seller.findUnique({
          where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
          select: { id: true },
        })
      : null;
  }
  private findChannel(tenantId: string, value: string | undefined) {
    const externalBlingId = clean(value);
    return externalBlingId
      ? this.database.salesChannel.findUnique({
          where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
          select: { id: true },
        })
      : null;
  }
  private findNature(tenantId: string, value: string | undefined) {
    const externalBlingId = clean(value);
    return externalBlingId
      ? this.database.operationNature.findUnique({
          where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
          select: { id: true, description: true },
        })
      : null;
  }
  private findInvoice(tenantId: string, value: string | undefined) {
    const externalBlingId = clean(value);
    return externalBlingId
      ? this.database.invoice.findUnique({
          where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
          select: { id: true },
        })
      : null;
  }
  private findProduct(tenantId: string, value: string | undefined) {
    const externalBlingId = clean(value);
    return externalBlingId
      ? this.database.product.findUnique({
          where: { tenantId_externalBlingId: { tenantId, externalBlingId } },
          select: { id: true },
        })
      : null;
  }
}

function clean(value: string | undefined): string | null {
  const result = value?.replace(/^\uFEFF/, "").trim();
  return result ? result : null;
}
function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
function required(row: Row, key: string): string {
  const value = clean(row[key]);
  if (!value) throw new Error(`Campo ${key} não informado`);
  return value;
}
function digits(value: string | undefined): string | null {
  const result = clean(value)?.replace(/\D/g, "") ?? "";
  return result || null;
}
function boolean(value: string | undefined, fallback = false): boolean {
  const normalized = clean(value)
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!normalized) return fallback;
  return ["1", "s", "sim", "true", "ativo", "a", "yes"].includes(normalized);
}
function decimal(value: string | undefined): Prisma.Decimal {
  const raw = clean(value);
  if (!raw) return new Prisma.Decimal(0);
  const normalized = raw
    .replace(/R\$|\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  try {
    return new Prisma.Decimal(normalized);
  } catch {
    throw new Error(`Número inválido: ${raw}`);
  }
}
function integer(value: string | undefined): number | null {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Inteiro inválido: ${raw}`);
  return parsed;
}
function date(value: string | undefined): Date | null {
  const raw = clean(value);
  if (!raw) return null;
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})(.*)$/.exec(raw);
  const normalized = brazilian
    ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}${brazilian[4]}`
    : raw;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Data inválida: ${raw}`);
  return parsed;
}
function count(existing: { id: unknown } | null): Counters {
  return existing ? { created: 0, updated: 1 } : { created: 1, updated: 0 };
}
function safeMessage(cause: unknown): string {
  const message =
    cause instanceof Error ? cause.message : "Falha ao importar linha";
  return message.replace(/\s+/g, " ").slice(0, 240);
}
