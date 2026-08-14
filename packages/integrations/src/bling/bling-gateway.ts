import {
  assertRealOutboundAllowed,
  type GatewayContext,
} from "../gateway-context.js";

export interface BlingNfeSummary {
  id: number;
  number: string;
  status: number;
  issuedAt: string;
  type?: number;
  accessKey?: string;
  contactId?: number | string;
  contact?: {
    id: number | string;
    name?: string;
    document?: string;
    stateRegistration?: string;
    identityDocument?: string;
    phone?: string;
    email?: string;
    address?: {
      street?: string;
      number?: string;
      complement?: string;
      district?: string;
      zipCode?: string;
      city?: string;
      state?: string;
    };
  };
  operationNatureId?: string;
  storeId?: string;
}

export interface ListNfeInput {
  status: 2 | 5 | 6;
  direction?: 0 | 1;
  issuedFrom: string;
  issuedTo: string;
  page: number;
  limit: number;
}

export interface BlingNfeDetail {
  id: string;
  number?: string;
  series?: number;
  xmlUrl?: string;
  pdfUrl?: string;
  total?: number;
  sellerId?: string;
  contactId?: string;
  installmentNote?: string;
  paymentMethodIds: string[];
  carrierName?: string;
  logisticObjectIds: number[];
}

export interface BlingBoletoAccount {
  id: string;
  externalNumber?: string;
  dueDate?: string;
  value?: number;
  status?: number;
}

export interface BlingBoletoBatch {
  saleNumber?: string;
  invoiceNumber?: string;
  total?: number;
  accounts: BlingBoletoAccount[];
}

export interface BlingReceivableDetail {
  id: string;
  boletoUrl?: string;
  contactId?: string;
}

export interface BlingLogisticObject {
  id: string;
  trackingCode?: string;
}

export interface BlingContactDetail {
  id: string;
  phone?: string;
  mobile?: string;
}

export interface BlingContactUpdate {
  id: string;
  mobile?: string;
}

export interface ListBlingProductsInput {
  page: number;
  limit: number;
  updatedFrom?: string;
  updatedTo?: string;
}

export interface BlingProductSummary {
  id: string;
  name?: string;
  code?: string;
  shortDescription?: string;
  cost?: number;
  status?: string;
}

export interface BlingProductDetail {
  id: string;
  ncm?: string;
  productGroupId?: string;
}

export interface BlingProductGroup {
  id: string;
  name: string;
  parentName?: string;
}

export interface BlingPaymentMethod {
  id: string;
  description?: string;
  paymentType?: string;
}

export interface BlingSalesChannel {
  id: string;
  description?: string;
  channelType?: string;
}

export interface BlingSeller {
  id: string;
  name?: string;
}

export interface BlingOperationNature {
  id: string;
  description?: string;
}

export interface ListBlingSalesOrdersInput {
  page: number;
  limit: number;
  issuedFrom: string;
  issuedTo: string;
  updatedFrom?: string;
  updatedTo?: string;
}

export interface BlingSalesOrderDetail {
  id: string;
  number?: number;
  issuedAt?: string;
  total?: number;
  statusId?: number;
  discount?: number;
  nfeId?: string;
  commissionFee?: number;
  freightCost?: number;
}

export interface BlingGateway {
  listNfe(
    context: GatewayContext,
    input: ListNfeInput,
  ): Promise<BlingNfeSummary[]>;
  listPaymentMethods(context: GatewayContext): Promise<BlingPaymentMethod[]>;
  listSalesChannels(context: GatewayContext): Promise<BlingSalesChannel[]>;
  listSellers(context: GatewayContext): Promise<BlingSeller[]>;
  listOperationNatures(
    context: GatewayContext,
  ): Promise<BlingOperationNature[]>;
}

export interface BlingAccessTokenProvider {
  getAccessToken(tenantId: string, correlationId: string): Promise<string>;
  handleUnauthorized(tenantId: string, correlationId: string): Promise<void>;
}

export interface BlingRateLimiter {
  waitForTurn(context: GatewayContext): Promise<void>;
}

interface BlingRealGatewayOptions {
  tokenProvider: BlingAccessTokenProvider;
  globalDemoMode: boolean;
  fetch?: typeof fetch;
  timeoutMs?: number;
  minimumIntervalMs?: number;
  rateLimiter?: BlingRateLimiter;
}

const BLING_BASE_URL = "https://api.bling.com.br/Api/v3";

export class BlingRealGateway implements BlingGateway {
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;
  readonly #minimumIntervalMs: number;
  #nextRequestAt = 0;

  constructor(private readonly options: BlingRealGatewayOptions) {
    this.#fetch = options.fetch ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#minimumIntervalMs = options.minimumIntervalMs ?? 400;
  }

  async listNfe(
    context: GatewayContext,
    input: ListNfeInput,
  ): Promise<BlingNfeSummary[]> {
    assertRealOutboundAllowed("Bling", context, this.options.globalDemoMode);

    const params = new URLSearchParams({
      pagina: String(input.page),
      limite: String(input.limit),
      situacao: String(input.status),
      tipo: String(input.direction ?? 1),
      dataEmissaoInicial: input.issuedFrom,
      dataEmissaoFinal: input.issuedTo,
    });
    const payload = await this.#request(context, `/nfe?${params.toString()}`);
    const data = payload["data"];
    if (!Array.isArray(data)) return [];

    return data.flatMap((raw): BlingNfeSummary[] => {
      if (typeof raw !== "object" || raw === null) return [];
      const item = raw as Record<string, unknown>;
      const invoiceNumber = stringOrNumberValue(item["numero"]);
      if (typeof item["id"] !== "number" || invoiceNumber === undefined) {
        return [];
      }
      const contact = record(item["contato"]);
      const contactId = stringOrNumberValue(contact?.["id"]);
      const address = record(contact?.["endereco"]);
      const nature = record(item["naturezaOperacao"]);
      const store = record(item["loja"]);
      const type = numberValue(item["tipo"]);
      const accessKey = stringValue(item["chaveAcesso"]);
      const operationNatureId = stringOrNumberValue(nature?.["id"]);
      const storeId = stringOrNumberValue(store?.["id"]);
      return [
        {
          id: item["id"],
          number: invoiceNumber,
          status:
            typeof item["situacao"] === "number"
              ? item["situacao"]
              : input.status,
          issuedAt:
            typeof item["dataEmissao"] === "string" ? item["dataEmissao"] : "",
          ...(type === undefined ? {} : { type }),
          ...(accessKey === undefined ? {} : { accessKey }),
          ...(contactId === undefined ? {} : { contactId }),
          ...(contactId !== undefined
            ? {
                contact: {
                  id: contactId,
                  ...optionalString("name", contact?.["nome"]),
                  ...optionalString("document", contact?.["numeroDocumento"]),
                  ...optionalString("stateRegistration", contact?.["ie"]),
                  ...optionalString("identityDocument", contact?.["rg"]),
                  ...optionalString("phone", contact?.["telefone"]),
                  ...optionalString("email", contact?.["email"]),
                  ...(address
                    ? {
                        address: {
                          ...optionalString("street", address["endereco"]),
                          ...optionalString("number", address["numero"]),
                          ...optionalString(
                            "complement",
                            address["complemento"],
                          ),
                          ...optionalString("district", address["bairro"]),
                          ...optionalString("zipCode", address["cep"]),
                          ...optionalString("city", address["municipio"]),
                          ...optionalString("state", address["uf"]),
                        },
                      }
                    : {}),
                },
              }
            : {}),
          ...(operationNatureId === undefined ? {} : { operationNatureId }),
          ...(storeId === undefined ? {} : { storeId }),
        },
      ];
    });
  }

  async getNfeDetail(
    context: GatewayContext,
    nfeId: string,
  ): Promise<BlingNfeDetail> {
    assertSafeIdentifier(nfeId, "NF-e");
    const payload = await this.#request(
      context,
      `/nfe/${encodeURIComponent(nfeId)}`,
    );
    const data = record(payload["data"]);
    const id = stringOrNumberValue(data?.["id"]);
    if (!data || id === undefined) throw new Error("BlingInvalidNfeDetail");

    const installments = arrayValue(data["parcelas"])
      .map(record)
      .filter((item): item is Record<string, unknown> => item !== undefined);
    const paymentMethodIds = installments.flatMap((installment) => {
      const payment = record(installment["formaPagamento"]);
      const paymentId = stringOrNumberValue(payment?.["id"]);
      return paymentId === undefined ? [] : [paymentId];
    });
    const transport = record(data["transporte"]);
    const carrier = record(transport?.["transportador"]);
    const logisticObjectIds = arrayValue(transport?.["volumes"]).flatMap(
      (volume) => {
        const rawId = record(volume)?.["id"];
        const parsed = numericValue(rawId);
        return parsed === undefined || !Number.isInteger(parsed)
          ? []
          : [parsed];
      },
    );
    const seller = record(data["vendedor"]);
    const contact = record(data["contato"]);
    const number = stringOrNumberValue(data["numero"]);
    const series = numericValue(data["serie"]);
    const xmlUrl = stringValue(data["xml"]);
    const pdfUrl = stringValue(data["linkPDF"]);
    const total = numericValue(data["valorNota"]);
    const sellerId = stringOrNumberValue(seller?.["id"]);
    const contactId = stringOrNumberValue(contact?.["id"]);
    const installmentNote = stringValue(installments[0]?.["observacoes"]);
    const carrierName = stringValue(carrier?.["nome"]);

    return {
      id,
      paymentMethodIds: [...new Set(paymentMethodIds)],
      logisticObjectIds: [...new Set(logisticObjectIds)],
      ...(number === undefined ? {} : { number }),
      ...(series === undefined ? {} : { series }),
      ...(xmlUrl === undefined ? {} : { xmlUrl }),
      ...(pdfUrl === undefined ? {} : { pdfUrl }),
      ...(total === undefined ? {} : { total }),
      ...(sellerId === undefined ? {} : { sellerId }),
      ...(contactId === undefined ? {} : { contactId }),
      ...(installmentNote === undefined ? {} : { installmentNote }),
      ...(carrierName === undefined ? {} : { carrierName }),
    };
  }

  async getBoletos(
    context: GatewayContext,
    nfeId: string,
  ): Promise<BlingBoletoBatch> {
    assertSafeIdentifier(nfeId, "NF-e");
    const params = new URLSearchParams({ idOrigem: nfeId });
    let payload: Record<string, unknown>;
    try {
      payload = await this.#request(
        context,
        `/contas/receber/boletos?${params.toString()}`,
      );
    } catch (error) {
      // O Bling responde 404 quando a forma está classificada como boleto,
      // mas a NF-e não possui cobrança gerada (caso comum em notas ML Full).
      // No legado isso era tratado como coleção vazia e não impedia que o
      // valor, XML e cálculo da nota fossem persistidos.
      if (error instanceof Error && error.message === "BlingHttpError:404") {
        return { accounts: [] };
      }
      throw error;
    }
    const data = record(payload["data"]);
    if (!data) return { accounts: [] };
    const sale = record(data["venda"]);
    const invoice = record(data["notaFiscal"]);
    const saleNumber = stringOrNumberValue(sale?.["numero"]);
    const invoiceNumber = stringOrNumberValue(invoice?.["numero"]);
    const total = numericValue(data["valorTotal"]);
    const accounts = arrayValue(data["contas"]).flatMap(
      (raw): BlingBoletoAccount[] => {
        const item = record(raw);
        const id = stringOrNumberValue(item?.["id"]);
        if (!item || id === undefined) return [];
        const externalNumber = stringOrNumberValue(item["numeroExterno"]);
        const dueDate = stringValue(item["vencimento"]);
        const value = numericValue(item["valor"]);
        const status = numericValue(item["situacao"]);
        return [
          {
            id,
            ...(externalNumber === undefined ? {} : { externalNumber }),
            ...(dueDate === undefined ? {} : { dueDate }),
            ...(value === undefined ? {} : { value }),
            ...(status === undefined ? {} : { status }),
          },
        ];
      },
    );
    return {
      accounts,
      ...(saleNumber === undefined ? {} : { saleNumber }),
      ...(invoiceNumber === undefined ? {} : { invoiceNumber }),
      ...(total === undefined ? {} : { total }),
    };
  }

  async getReceivableDetail(
    context: GatewayContext,
    receivableId: string,
  ): Promise<BlingReceivableDetail> {
    assertSafeIdentifier(receivableId, "conta a receber");
    const payload = await this.#request(
      context,
      `/contas/receber/${encodeURIComponent(receivableId)}`,
    );
    const data = record(payload["data"]);
    const id = stringOrNumberValue(data?.["id"]) ?? receivableId;
    if (!data) throw new Error("BlingInvalidReceivableDetail");
    const contact = record(data["contato"]);
    const boletoUrl = stringValue(data["linkBoleto"]);
    const contactId = stringOrNumberValue(contact?.["id"]);
    return {
      id,
      ...(boletoUrl === undefined ? {} : { boletoUrl }),
      ...(contactId === undefined ? {} : { contactId }),
    };
  }

  async getLogisticObject(
    context: GatewayContext,
    objectId: number,
  ): Promise<BlingLogisticObject> {
    if (!Number.isInteger(objectId) || objectId <= 0)
      throw new Error("Identificador logístico inválido");
    const payload = await this.#request(
      context,
      `/logisticas/objetos/${objectId}`,
    );
    const data = record(payload["data"]);
    if (!data) throw new Error("BlingInvalidLogisticObject");
    const tracking = record(data["rastreamento"]);
    const id = stringOrNumberValue(data["id"]) ?? String(objectId);
    const trackingCode = stringValue(tracking?.["codigo"]);
    return {
      id,
      ...(trackingCode === undefined ? {} : { trackingCode }),
    };
  }

  async getContactDetail(
    context: GatewayContext,
    contactId: string,
  ): Promise<BlingContactDetail> {
    assertSafeIdentifier(contactId, "contato");
    const payload = await this.#request(
      context,
      `/contatos/${encodeURIComponent(contactId)}`,
    );
    const data = record(payload["data"]);
    const id = stringOrNumberValue(data?.["id"]);
    if (!data || id === undefined) throw new Error("BlingInvalidContactDetail");
    const phone = stringValue(data["telefone"]);
    const mobile = stringValue(data["celular"]);
    return {
      id,
      ...(phone === undefined ? {} : { phone }),
      ...(mobile === undefined ? {} : { mobile }),
    };
  }

  async updateContactMobile(
    context: GatewayContext,
    contactId: string,
    mobile: string,
  ): Promise<BlingContactUpdate> {
    assertSafeIdentifier(contactId, "contato");
    const current = await this.#request(
      context,
      `/contatos/${encodeURIComponent(contactId)}`,
    );
    const data = record(current["data"]);
    const id = stringOrNumberValue(data?.["id"]);
    if (!data || id === undefined) throw new Error("BlingInvalidContactDetail");

    // O Bling exige o cadastro completo no PUT. Preservamos todos os campos
    // recebidos no GET e alteramos somente o celular, como no legado.
    const payload = { ...data, celular: mobile };
    await this.#request(
      context,
      `/contatos/${encodeURIComponent(contactId)}`,
      { method: "PUT", body: JSON.stringify(payload) },
      true,
    );
    return { id, ...(mobile ? { mobile } : {}) };
  }

  async listProducts(
    context: GatewayContext,
    input: ListBlingProductsInput,
  ): Promise<BlingProductSummary[]> {
    const params = new URLSearchParams({
      pagina: String(input.page),
      limite: String(input.limit),
      criterio: "5",
      tipo: "P,E,PS,C,V",
    });
    if (input.updatedFrom)
      params.set("dataAlteracaoInicial", input.updatedFrom);
    if (input.updatedTo) params.set("dataAlteracaoFinal", input.updatedTo);
    const payload = await this.#request(
      context,
      `/produtos?${params.toString()}`,
    );
    return arrayValue(payload["data"]).flatMap((raw) => {
      const item = record(raw);
      const id = stringOrNumberValue(item?.["id"]);
      if (!item || id === undefined) return [];
      const name = stringValue(item["nome"]);
      const code = stringOrNumberValue(item["codigo"]);
      const shortDescription = stringValue(item["descricaoCurta"]);
      const cost = numericValue(item["precoCusto"]);
      const status = stringValue(item["situacao"]);
      return [
        {
          id,
          ...(name === undefined ? {} : { name }),
          ...(code === undefined ? {} : { code }),
          ...(shortDescription === undefined ? {} : { shortDescription }),
          ...(cost === undefined ? {} : { cost }),
          ...(status === undefined ? {} : { status }),
        },
      ];
    });
  }

  async getProductDetail(
    context: GatewayContext,
    productId: string,
  ): Promise<BlingProductDetail> {
    assertSafeIdentifier(productId, "produto");
    const payload = await this.#request(
      context,
      `/produtos/${encodeURIComponent(productId)}`,
    );
    const data = record(payload["data"]);
    const id = stringOrNumberValue(data?.["id"]);
    if (!data || id === undefined) throw new Error("BlingInvalidProductDetail");
    const taxation = record(data["tributacao"]);
    const group = record(taxation?.["grupoProduto"]);
    const rawNcm = stringOrNumberValue(taxation?.["ncm"]);
    const normalizedNcm = rawNcm?.replace(/\D+/g, "");
    const ncm = normalizedNcm?.length === 8 ? normalizedNcm : undefined;
    const productGroupId = stringOrNumberValue(group?.["id"]);
    return {
      id,
      ...(ncm ? { ncm } : {}),
      ...(productGroupId === undefined ? {} : { productGroupId }),
    };
  }

  async listProductGroups(
    context: GatewayContext,
    page: number,
    limit: number,
  ): Promise<BlingProductGroup[]> {
    const params = new URLSearchParams({
      pagina: String(page),
      limite: String(limit),
    });
    const payload = await this.#request(
      context,
      `/grupos-produtos?${params.toString()}`,
    );
    return arrayValue(payload["data"]).flatMap((raw) => {
      const item = record(raw);
      const id = stringOrNumberValue(item?.["id"]);
      const name = stringValue(item?.["nome"]);
      if (!item || id === undefined || name === undefined) return [];
      const parent = record(item["grupoProdutoPai"]);
      const parentName = stringValue(parent?.["nome"]);
      return [
        {
          id,
          name,
          ...(parentName === undefined ? {} : { parentName }),
        },
      ];
    });
  }

  async listPaymentMethods(
    context: GatewayContext,
  ): Promise<BlingPaymentMethod[]> {
    const payload = await this.#request(
      context,
      "/formas-pagamentos?pagina=1&limite=100",
    );
    return arrayValue(payload["data"]).flatMap((raw) => {
      const item = record(raw);
      const id = stringOrNumberValue(item?.["id"]);
      if (!item || id === undefined) return [];
      const description = stringValue(item["descricao"]);
      const paymentType = stringOrNumberValue(item["tipoPagamento"]);
      return [
        {
          id,
          ...(description === undefined ? {} : { description }),
          ...(paymentType === undefined ? {} : { paymentType }),
        },
      ];
    });
  }

  async listSalesChannels(
    context: GatewayContext,
  ): Promise<BlingSalesChannel[]> {
    const payload = await this.#request(
      context,
      "/canais-venda?situacao=1&pagina=1&limite=100",
    );
    return arrayValue(payload["data"]).flatMap((raw) => {
      const item = record(raw);
      const id = stringOrNumberValue(item?.["id"]);
      if (!item || id === undefined) return [];
      const description = stringValue(item["descricao"]);
      const channelType = stringValue(item["tipo"]);
      return [
        {
          id,
          ...(description === undefined ? {} : { description }),
          ...(channelType === undefined ? {} : { channelType }),
        },
      ];
    });
  }

  async listSellers(context: GatewayContext): Promise<BlingSeller[]> {
    const payload = await this.#request(
      context,
      "/vendedores?situacaoContato=A&pagina=1&limite=100",
    );
    return arrayValue(payload["data"]).flatMap((raw) => {
      const item = record(raw);
      const id = stringOrNumberValue(item?.["id"]);
      if (!item || id === undefined) return [];
      const contact = record(item["contato"]);
      const name = stringValue(contact?.["nome"]);
      return [{ id, ...(name === undefined ? {} : { name }) }];
    });
  }

  async listOperationNatures(
    context: GatewayContext,
  ): Promise<BlingOperationNature[]> {
    const payload = await this.#request(
      context,
      "/naturezas-operacoes?situacao=1&pagina=1&limite=100",
    );
    return arrayValue(payload["data"]).flatMap((raw) => {
      const item = record(raw);
      const id = stringOrNumberValue(item?.["id"]);
      if (!item || id === undefined) return [];
      const description = stringValue(item["descricao"]);
      return [{ id, ...(description === undefined ? {} : { description }) }];
    });
  }

  async listSalesOrders(
    context: GatewayContext,
    input: ListBlingSalesOrdersInput,
  ): Promise<string[]> {
    const params = new URLSearchParams({
      pagina: String(input.page),
      limite: String(input.limit),
      dataInicial: input.issuedFrom,
      dataFinal: input.issuedTo,
    });
    if (input.updatedFrom)
      params.set("dataAlteracaoInicial", input.updatedFrom);
    if (input.updatedTo) params.set("dataAlteracaoFinal", input.updatedTo);
    const payload = await this.#request(
      context,
      `/pedidos/vendas?${params.toString()}`,
    );
    return arrayValue(payload["data"]).flatMap((raw) => {
      const id = stringOrNumberValue(record(raw)?.["id"]);
      return id === undefined ? [] : [id];
    });
  }

  async getSalesOrderDetail(
    context: GatewayContext,
    orderId: string,
  ): Promise<BlingSalesOrderDetail> {
    assertSafeIdentifier(orderId, "pedido de venda");
    const payload = await this.#request(
      context,
      `/pedidos/vendas/${encodeURIComponent(orderId)}`,
    );
    const data = record(payload["data"]);
    const id = stringOrNumberValue(data?.["id"]);
    if (!data || id === undefined)
      throw new Error("BlingInvalidSalesOrderDetail");
    const status = record(data["situacao"]);
    const discount = record(data["desconto"]);
    const invoice = record(data["notaFiscal"]);
    const fees = record(data["taxas"]);
    const number = integerValue(data["numero"]);
    const issuedAt = stringValue(data["data"]);
    const total = numericValue(data["total"]);
    const statusId = integerValue(status?.["id"]);
    const discountValue = numericValue(discount?.["valor"]);
    const nfeId = stringOrNumberValue(invoice?.["id"]);
    const commissionFee = numericValue(fees?.["taxaComissao"]);
    const freightCost = numericValue(fees?.["custoFrete"]);
    return {
      id,
      ...(number === undefined ? {} : { number }),
      ...(issuedAt === undefined ? {} : { issuedAt }),
      ...(total === undefined ? {} : { total }),
      ...(statusId === undefined ? {} : { statusId }),
      ...(discountValue === undefined ? {} : { discount: discountValue }),
      ...(nfeId === undefined ? {} : { nfeId }),
      ...(commissionFee === undefined ? {} : { commissionFee }),
      ...(freightCost === undefined ? {} : { freightCost }),
    };
  }

  async #request(
    context: GatewayContext,
    relativePath: string,
    init: Pick<RequestInit, "method" | "body"> = {},
    allowEmpty = false,
  ): Promise<Record<string, unknown>> {
    assertRealOutboundAllowed("Bling", context, this.options.globalDemoMode);
    if (!relativePath.startsWith("/") || relativePath.includes("://")) {
      throw new Error("Caminho Bling inválido");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = await this.options.tokenProvider.getAccessToken(
        context.tenantId,
        context.correlationId,
      );
      await this.options.rateLimiter?.waitForTurn(context);
      await this.#waitForRateLimit();
      const response = await this.#fetch(`${BLING_BASE_URL}${relativePath}`, {
        ...init,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
          "enable-jwt": "1",
          "x-correlation-id": context.correlationId,
        },
        signal: AbortSignal.timeout(this.#timeoutMs),
      });

      if (response.status === 401 && attempt === 0) {
        await this.options.tokenProvider.handleUnauthorized(
          context.tenantId,
          context.correlationId,
        );
        continue;
      }
      if (response.status === 401) throw new Error("BlingUnauthorized");
      if (response.status === 403) throw new Error("BlingForbidden");
      // A NF-e recém-listada pode ficar alguns instantes indisponível no
      // endpoint de detalhe do Bling. O legado repetia todo o enriquecimento
      // até três vezes; sem esta equivalência o remake persistia a nota com
      // valor zero e só a corrigia em uma ressincronização manual posterior.
      if (
        response.status === 404 &&
        /^\/nfe\/[^/?]+$/.test(relativePath) &&
        attempt < 2
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1)),
        );
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await waitForRetry(response, attempt);
        continue;
      }
      if (response.status === 429) throw new Error("BlingRateLimited");
      if (!response.ok) throw new Error(`BlingHttpError:${response.status}`);

      if (allowEmpty && response.status === 204) return {};
      const contentType = response.headers.get("content-type") ?? "";
      if (allowEmpty && !contentType) return {};
      if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error("BlingInvalidContentType");
      }
      const payload: unknown = await response.json();
      if (
        typeof payload !== "object" ||
        payload === null ||
        Array.isArray(payload)
      ) {
        throw new Error("BlingInvalidPayload");
      }
      return payload as Record<string, unknown>;
    }
    throw new Error("BlingRetryExhausted");
  }

  async #waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const scheduledAt = Math.max(now, this.#nextRequestAt);
    this.#nextRequestAt = scheduledAt + this.#minimumIntervalMs;
    const waitMs = scheduledAt - now;
    if (waitMs > 0)
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
}

async function waitForRetry(
  response: Response,
  attempt: number,
): Promise<void> {
  const retryAfter = Number(response.headers.get("retry-after"));
  const delay =
    Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1_000, 30_000)
      : 500 * 2 ** attempt;
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringOrNumberValue(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return stringValue(value);
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function integerValue(value: unknown): number | undefined {
  const parsed = numericValue(value);
  return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined;
}

function assertSafeIdentifier(value: string, label: string): void {
  if (!/^\d+$/.test(value))
    throw new Error(`Identificador de ${label} inválido`);
}

function optionalString<K extends string>(
  key: K,
  value: unknown,
): Partial<Record<K, string>> {
  const parsed = stringValue(value);
  return parsed === undefined ? {} : ({ [key]: parsed } as Record<K, string>);
}

const DEMO_NFES: readonly BlingNfeSummary[] = [
  {
    id: 9_000_001,
    number: "000001042",
    status: 6,
    issuedAt: "2026-08-06T14:30:00-03:00",
    contactId: 8_000_001,
  },
];

export class BlingFakeGateway implements BlingGateway {
  listNfe(
    _context: GatewayContext,
    input: ListNfeInput,
  ): Promise<BlingNfeSummary[]> {
    void _context;
    return Promise.resolve(
      DEMO_NFES.filter((nfe) => nfe.status === input.status).map((nfe) => ({
        ...nfe,
      })),
    );
  }

  listPaymentMethods(_context: GatewayContext): Promise<BlingPaymentMethod[]> {
    void _context;
    return Promise.resolve([
      { id: "1", description: "Dinheiro", paymentType: "1" },
      { id: "15", description: "Boleto bancário", paymentType: "15" },
    ]);
  }

  listSalesChannels(_context: GatewayContext): Promise<BlingSalesChannel[]> {
    void _context;
    return Promise.resolve([
      { id: "1001", description: "Venda direta", channelType: "LojaFisica" },
      {
        id: "1002",
        description: "Mercado Livre",
        channelType: "MercadoLivre",
      },
    ]);
  }

  listSellers(_context: GatewayContext): Promise<BlingSeller[]> {
    void _context;
    return Promise.resolve([
      { id: "501", name: "Equipe comercial" },
      { id: "502", name: "Venda interna" },
    ]);
  }

  listOperationNatures(
    _context: GatewayContext,
  ): Promise<BlingOperationNature[]> {
    void _context;
    return Promise.resolve([
      { id: "601", description: "Venda de mercadoria" },
      { id: "602", description: "Venda interestadual" },
    ]);
  }
}
