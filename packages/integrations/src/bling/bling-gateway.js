import { assertRealOutboundAllowed, } from "../gateway-context.js";
const BLING_BASE_URL = "https://api.bling.com.br/Api/v3";
export class BlingRealGateway {
    options;
    #fetch;
    #timeoutMs;
    #minimumIntervalMs;
    #nextRequestAt = 0;
    constructor(options) {
        this.options = options;
        this.#fetch = options.fetch ?? fetch;
        this.#timeoutMs = options.timeoutMs ?? 30_000;
        this.#minimumIntervalMs = options.minimumIntervalMs ?? 400;
    }
    async listNfe(context, input) {
        assertRealOutboundAllowed("Bling", context, this.options.globalDemoMode);
        const params = new URLSearchParams({
            pagina: String(input.page),
            limite: String(input.limit),
            situacao: String(input.status),
            tipo: "1",
            dataEmissaoInicial: input.issuedFrom,
            dataEmissaoFinal: input.issuedTo,
        });
        const payload = await this.#request(context, `/nfe?${params.toString()}`);
        const data = payload["data"];
        if (!Array.isArray(data))
            return [];
        return data.flatMap((raw) => {
            if (typeof raw !== "object" || raw === null)
                return [];
            const item = raw;
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
                    status: typeof item["situacao"] === "number"
                        ? item["situacao"]
                        : input.status,
                    issuedAt: typeof item["dataEmissao"] === "string" ? item["dataEmissao"] : "",
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
                                            ...optionalString("complement", address["complemento"]),
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
    async getNfeDetail(context, nfeId) {
        assertSafeIdentifier(nfeId, "NF-e");
        const payload = await this.#request(context, `/nfe/${encodeURIComponent(nfeId)}`);
        const data = record(payload["data"]);
        const id = stringOrNumberValue(data?.["id"]);
        if (!data || id === undefined)
            throw new Error("BlingInvalidNfeDetail");
        const installments = arrayValue(data["parcelas"])
            .map(record)
            .filter((item) => item !== undefined);
        const paymentMethodIds = installments.flatMap((installment) => {
            const payment = record(installment["formaPagamento"]);
            const paymentId = stringOrNumberValue(payment?.["id"]);
            return paymentId === undefined ? [] : [paymentId];
        });
        const transport = record(data["transporte"]);
        const carrier = record(transport?.["transportador"]);
        const logisticObjectIds = arrayValue(transport?.["volumes"]).flatMap((volume) => {
            const rawId = record(volume)?.["id"];
            const parsed = numericValue(rawId);
            return parsed === undefined || !Number.isInteger(parsed)
                ? []
                : [parsed];
        });
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
    async getBoletos(context, nfeId) {
        assertSafeIdentifier(nfeId, "NF-e");
        const params = new URLSearchParams({ idOrigem: nfeId });
        const payload = await this.#request(context, `/contas/receber/boletos?${params.toString()}`);
        const data = record(payload["data"]);
        if (!data)
            return { accounts: [] };
        const sale = record(data["venda"]);
        const invoice = record(data["notaFiscal"]);
        const saleNumber = stringOrNumberValue(sale?.["numero"]);
        const invoiceNumber = stringOrNumberValue(invoice?.["numero"]);
        const total = numericValue(data["valorTotal"]);
        const accounts = arrayValue(data["contas"]).flatMap((raw) => {
            const item = record(raw);
            const id = stringOrNumberValue(item?.["id"]);
            if (!item || id === undefined)
                return [];
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
        });
        return {
            accounts,
            ...(saleNumber === undefined ? {} : { saleNumber }),
            ...(invoiceNumber === undefined ? {} : { invoiceNumber }),
            ...(total === undefined ? {} : { total }),
        };
    }
    async getReceivableDetail(context, receivableId) {
        assertSafeIdentifier(receivableId, "conta a receber");
        const payload = await this.#request(context, `/contas/receber/${encodeURIComponent(receivableId)}`);
        const data = record(payload["data"]);
        const id = stringOrNumberValue(data?.["id"]) ?? receivableId;
        if (!data)
            throw new Error("BlingInvalidReceivableDetail");
        const contact = record(data["contato"]);
        const boletoUrl = stringValue(data["linkBoleto"]);
        const contactId = stringOrNumberValue(contact?.["id"]);
        return {
            id,
            ...(boletoUrl === undefined ? {} : { boletoUrl }),
            ...(contactId === undefined ? {} : { contactId }),
        };
    }
    async getLogisticObject(context, objectId) {
        if (!Number.isInteger(objectId) || objectId <= 0)
            throw new Error("Identificador logístico inválido");
        const payload = await this.#request(context, `/logisticas/objetos/${objectId}`);
        const data = record(payload["data"]);
        if (!data)
            throw new Error("BlingInvalidLogisticObject");
        const tracking = record(data["rastreamento"]);
        const id = stringOrNumberValue(data["id"]) ?? String(objectId);
        const trackingCode = stringValue(tracking?.["codigo"]);
        return {
            id,
            ...(trackingCode === undefined ? {} : { trackingCode }),
        };
    }
    async getContactDetail(context, contactId) {
        assertSafeIdentifier(contactId, "contato");
        const payload = await this.#request(context, `/contatos/${encodeURIComponent(contactId)}`);
        const data = record(payload["data"]);
        const id = stringOrNumberValue(data?.["id"]);
        if (!data || id === undefined)
            throw new Error("BlingInvalidContactDetail");
        const phone = stringValue(data["telefone"]);
        const mobile = stringValue(data["celular"]);
        return {
            id,
            ...(phone === undefined ? {} : { phone }),
            ...(mobile === undefined ? {} : { mobile }),
        };
    }
    async listProducts(context, input) {
        const params = new URLSearchParams({
            pagina: String(input.page),
            limite: String(input.limit),
            criterio: "5",
            tipo: "P,E,PS,C,V",
        });
        if (input.updatedFrom)
            params.set("dataAlteracaoInicial", input.updatedFrom);
        if (input.updatedTo)
            params.set("dataAlteracaoFinal", input.updatedTo);
        const payload = await this.#request(context, `/produtos?${params.toString()}`);
        return arrayValue(payload["data"]).flatMap((raw) => {
            const item = record(raw);
            const id = stringOrNumberValue(item?.["id"]);
            if (!item || id === undefined)
                return [];
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
    async getProductDetail(context, productId) {
        assertSafeIdentifier(productId, "produto");
        const payload = await this.#request(context, `/produtos/${encodeURIComponent(productId)}`);
        const data = record(payload["data"]);
        const id = stringOrNumberValue(data?.["id"]);
        if (!data || id === undefined)
            throw new Error("BlingInvalidProductDetail");
        const taxation = record(data["tributacao"]);
        const group = record(taxation?.["grupoProduto"]);
        const rawNcm = stringOrNumberValue(taxation?.["ncm"]);
        const ncm = rawNcm?.replace(/[.,\s]+/g, "");
        const productGroupId = stringOrNumberValue(group?.["id"]);
        return {
            id,
            ...(ncm ? { ncm } : {}),
            ...(productGroupId === undefined ? {} : { productGroupId }),
        };
    }
    async listProductGroups(context, page, limit) {
        const params = new URLSearchParams({
            pagina: String(page),
            limite: String(limit),
        });
        const payload = await this.#request(context, `/grupos-produtos?${params.toString()}`);
        return arrayValue(payload["data"]).flatMap((raw) => {
            const item = record(raw);
            const id = stringOrNumberValue(item?.["id"]);
            const name = stringValue(item?.["nome"]);
            if (!item || id === undefined || name === undefined)
                return [];
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
    async listSalesOrders(context, input) {
        const params = new URLSearchParams({
            pagina: String(input.page),
            limite: String(input.limit),
            dataInicial: input.issuedFrom,
            dataFinal: input.issuedTo,
        });
        if (input.updatedFrom)
            params.set("dataAlteracaoInicial", input.updatedFrom);
        if (input.updatedTo)
            params.set("dataAlteracaoFinal", input.updatedTo);
        const payload = await this.#request(context, `/pedidos/vendas?${params.toString()}`);
        return arrayValue(payload["data"]).flatMap((raw) => {
            const id = stringOrNumberValue(record(raw)?.["id"]);
            return id === undefined ? [] : [id];
        });
    }
    async getSalesOrderDetail(context, orderId) {
        assertSafeIdentifier(orderId, "pedido de venda");
        const payload = await this.#request(context, `/pedidos/vendas/${encodeURIComponent(orderId)}`);
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
    async #request(context, relativePath) {
        if (!relativePath.startsWith("/") || relativePath.includes("://")) {
            throw new Error("Caminho Bling inválido");
        }
        const token = await this.options.tokenProvider.getAccessToken(context.tenantId, context.correlationId);
        await this.#waitForRateLimit();
        const response = await this.#fetch(`${BLING_BASE_URL}${relativePath}`, {
            headers: {
                accept: "application/json",
                authorization: `Bearer ${token}`,
                "enable-jwt": "1",
                "x-correlation-id": context.correlationId,
            },
            signal: AbortSignal.timeout(this.#timeoutMs),
        });
        if (response.status === 401) {
            await this.options.tokenProvider.handleUnauthorized(context.tenantId, context.correlationId);
            throw new Error("BlingUnauthorized");
        }
        if (!response.ok)
            throw new Error(`BlingHttpError:${response.status}`);
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
            throw new Error("BlingInvalidContentType");
        }
        const payload = await response.json();
        if (typeof payload !== "object" ||
            payload === null ||
            Array.isArray(payload)) {
            throw new Error("BlingInvalidPayload");
        }
        return payload;
    }
    async #waitForRateLimit() {
        const now = Date.now();
        const scheduledAt = Math.max(now, this.#nextRequestAt);
        this.#nextRequestAt = scheduledAt + this.#minimumIntervalMs;
        const waitMs = scheduledAt - now;
        if (waitMs > 0)
            await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
}
function record(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
function arrayValue(value) {
    return Array.isArray(value) ? value : [];
}
function stringValue(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
function stringOrNumberValue(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return String(value);
    return stringValue(value);
}
function numberValue(value) {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : undefined;
}
function numericValue(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value !== "string" || value.trim().length === 0)
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function integerValue(value) {
    const parsed = numericValue(value);
    return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined;
}
function assertSafeIdentifier(value, label) {
    if (!/^\d+$/.test(value))
        throw new Error(`Identificador de ${label} inválido`);
}
function optionalString(key, value) {
    const parsed = stringValue(value);
    return parsed === undefined ? {} : { [key]: parsed };
}
const DEMO_NFES = [
    {
        id: 9_000_001,
        number: "000001042",
        status: 6,
        issuedAt: "2026-08-06T14:30:00-03:00",
        contactId: 8_000_001,
    },
];
export class BlingFakeGateway {
    listNfe(_context, input) {
        void _context;
        return Promise.resolve(DEMO_NFES.filter((nfe) => nfe.status === input.status).map((nfe) => ({
            ...nfe,
        })));
    }
}
