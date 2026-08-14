import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Prisma, type DatabaseClient } from "@integrador/db";
import { XMLParser } from "fast-xml-parser";

const MAX_XML_BYTES = 10 * 1024 * 1024;
const TAXES_IN_LP = new Set([
  "IPI",
  "ICMSST",
  "ICMS",
  "PIS",
  "COFINS",
  "DIFAL",
]);

type XmlObject = Record<string, unknown>;

interface ParsedTax {
  name: string;
  cst: number | null;
  base: number;
  reduction: number;
  rate: number;
  value: number;
}

interface ParsedItem {
  line: number;
  code: string;
  name: string;
  ncm: string | null;
  cfop: number | null;
  quantity: number;
  freight: number;
  discount: number;
  otherExpenses: number;
  grossValue: number;
  unitValue: number;
  taxes: ParsedTax[];
}

interface ProductRow {
  id: number;
  blingProductId: string | null;
  code: string | null;
  name: string | null;
  cost: number | null;
  status: string | null;
  monophase: string | null;
  ownManufacture: boolean;
}

interface ProductByLineRow extends ProductRow {
  line: number | null;
}

interface InvoiceContextRow {
  id: number;
  blingId: string;
  storeId: string | null;
  total: number | null;
  installmentNote: string | null;
}

interface FixedCostRow {
  id: number;
  name: string | null;
  scope: string | null;
  valueKind: string | null;
  value: number | null;
  category: string | null;
}

interface OrderCostRow {
  commission: number | null;
  freight: number | null;
}

interface RateRow {
  rate: number | null;
}

interface IdRow {
  id: number;
}

export interface NfeXmlProcessResult {
  items: number;
  inconsistentItems: number;
  calculated: boolean;
  totalCost: number;
  netRevenue: number;
  profit: number;
  margin: number;
  ignored?: boolean;
  ignoredReason?: string;
}

export interface NfeXmlPolicyFilters {
  includedCfops: string[];
  excludedCfops: string[];
  includedSkus: string[];
  excludedSkus: string[];
  includedNcms: string[];
  excludedNcms: string[];
}

function object(value: unknown): XmlObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as XmlObject)
    : null;
}

function list(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value).trim();
  return "";
}

function number(value: unknown): number {
  const parsed = Number.parseFloat(text(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  const raw = text(value);
  return raw === "" ? null : number(raw);
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isPrivateIp(address: string): boolean {
  if (address === "::1" || address === "0.0.0.0") return true;
  if (
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    address.startsWith("fe80:")
  )
    return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part)))
    return false;
  const [a = 0, b = 0] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function assertSafeXmlUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:")
    throw new Error("O XML da NF-e deve usar HTTPS");
  if (url.username || url.password)
    throw new Error("URL de XML com credenciais não é permitida");
  const hostname = url.hostname.toLocaleLowerCase("en-US");
  if (hostname === "localhost" || hostname.endsWith(".local"))
    throw new Error("Host privado não permitido para XML");
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateIp(address))
  )
    throw new Error("Host privado não permitido para XML");
  return url;
}

async function downloadXml(rawUrl: string): Promise<string> {
  let url = await assertSafeXmlUrl(rawUrl);
  let response: Response | null = null;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      headers: { accept: "application/xml,text/xml;q=0.9" },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location || redirects === 3)
      throw new Error("Redirecionamento inválido no XML da NF-e");
    url = await assertSafeXmlUrl(new URL(location, url).toString());
  }
  if (!response) throw new Error("Falha ao baixar XML da NF-e");
  if (!response.ok)
    throw new Error(`Falha ao baixar XML da NF-e (${response.status})`);
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_XML_BYTES)
    throw new Error("XML da NF-e excede 10 MB");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_XML_BYTES)
    throw new Error("XML da NF-e excede 10 MB");
  const xml = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
  if (!xml.startsWith("<")) throw new Error("Conteúdo recebido não é um XML");
  return xml;
}

function tax(
  name: string,
  node: XmlObject | null,
  fields: {
    cst?: string;
    base: string;
    reduction?: string;
    rate: string;
    value: string;
  },
): ParsedTax | null {
  if (!node) return null;
  const parsed: ParsedTax = {
    name,
    cst: nullableNumber(node[fields.cst ?? "CST"]),
    base: number(node[fields.base]),
    reduction: number(node[fields.reduction ?? "pRedBC"]),
    rate: number(node[fields.rate]),
    value: number(node[fields.value]),
  };
  return parsed.base > 0 || parsed.rate > 0 || parsed.value > 0 ? parsed : null;
}

function firstChild(node: XmlObject | null): XmlObject | null {
  if (!node) return null;
  for (const value of Object.values(node)) {
    const child = object(value);
    if (child) return child;
  }
  return null;
}

function parseTaxes(det: XmlObject): ParsedTax[] {
  const imposto = object(det["imposto"]);
  if (!imposto) return [];
  const result: ParsedTax[] = [];
  const icms = firstChild(object(imposto["ICMS"]));
  const icmsTax = tax("ICMS", icms, {
    cst: icms?.["CST"] === undefined ? "CSOSN" : "CST",
    base: "vBC",
    rate: "pICMS",
    value: "vICMS",
  });
  if (icmsTax) result.push(icmsTax);
  const icmsSt = tax("ICMSST", icms, {
    cst: icms?.["CST"] === undefined ? "CSOSN" : "CST",
    base: "vBCST",
    reduction: "pRedBCST",
    rate: "pICMSST",
    value: "vICMSST",
  });
  if (icmsSt) result.push(icmsSt);

  const ipi = firstChild(object(imposto["IPI"]));
  const pis = firstChild(object(imposto["PIS"]));
  const cofins = firstChild(object(imposto["COFINS"]));
  const simpleTaxes: Array<[string, XmlObject | null, string, string]> = [
    ["IPI", ipi, "pIPI", "vIPI"],
    ["PIS", pis, "pPIS", "vPIS"],
    ["COFINS", cofins, "pCOFINS", "vCOFINS"],
  ];
  for (const [name, node, rate, value] of simpleTaxes) {
    const parsed = tax(name, node, { base: "vBC", rate, value });
    if (parsed) result.push(parsed);
  }

  const difalNode = object(imposto["ICMSUFDest"]);
  if (difalNode) {
    const destinationRate = number(difalNode["pICMSUFDest"]);
    const interstateRate = number(difalNode["pICMSInter"]);
    const difal: ParsedTax = {
      name: "DIFAL",
      cst: null,
      base: number(difalNode["vBCUFDest"]),
      reduction: 0,
      rate: Math.max(0, destinationRate - interstateRate),
      value: number(difalNode["vICMSUFDest"]),
    };
    if (difal.base > 0 || difal.value > 0) result.push(difal);
  }

  const ibscbs = object(imposto["IBSCBS"]);
  const group = object(ibscbs?.["gIBSCBS"]);
  if (group) {
    const base = number(group["vBC"]);
    const cst = nullableNumber(ibscbs?.["CST"]);
    const ibsUf = object(group["gIBSUF"]);
    const ibsMun = object(group["gIBSMun"]);
    const cbs = object(group["gCBS"]);
    const futureTaxes: ParsedTax[] = [
      {
        name: "IBSUF",
        cst,
        base,
        reduction: 0,
        rate: number(ibsUf?.["pIBSUF"]),
        value: number(ibsUf?.["vIBSUF"]),
      },
      {
        name: "IBSMUN",
        cst,
        base,
        reduction: 0,
        rate: number(ibsMun?.["pIBSMun"]),
        value: number(ibsMun?.["vIBSMun"]),
      },
      {
        name: "IBS",
        cst,
        base,
        reduction: 0,
        rate: 0,
        value: number(group["vIBS"]),
      },
      {
        name: "CBS",
        cst,
        base,
        reduction: 0,
        rate: number(cbs?.["pCBS"]),
        value: number(cbs?.["vCBS"]),
      },
    ];
    result.push(
      ...futureTaxes.filter((entry) => entry.rate > 0 || entry.value > 0),
    );
  }
  return result;
}

function parseXml(xml: string): ParsedItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
    processEntities: false,
  });
  const parsed = object(parser.parse(xml));
  const nfe =
    object(object(parsed?.["nfeProc"])?.["NFe"]) ?? object(parsed?.["NFe"]);
  const info = object(nfe?.["infNFe"]);
  if (!info) throw new Error("XML não contém uma NF-e válida");
  return list(info["det"]).map((rawDet, index) => {
    const det = object(rawDet);
    const product = object(det?.["prod"]);
    if (!det || !product) throw new Error(`Item ${index + 1} inválido no XML`);
    const quantity = number(product["qCom"]);
    const grossValue = number(product["vProd"]);
    return {
      line: number(det["@nItem"]) || index + 1,
      code: text(product["cProd"]),
      name: text(product["xProd"]),
      ncm: text(product["NCM"]).replace(/[.,\s]+/g, "") || null,
      cfop: nullableNumber(product["CFOP"]),
      quantity,
      freight: number(product["vFrete"]),
      discount: number(product["vDesc"]),
      otherExpenses: number(product["vOutro"]),
      grossValue,
      unitValue:
        number(product["vUnCom"]) || (quantity > 0 ? grossValue / quantity : 0),
      taxes: parseTaxes(det),
    };
  });
}

function installmentCount(note: string | null): number | null {
  if (!note || !normalizeName(note).includes("credito")) return null;
  const match = note.match(/\d+/);
  return match ? Number.parseInt(match[0] ?? "", 10) : null;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export class NfeXmlProcessor {
  constructor(private readonly database: DatabaseClient) {}

  async process(input: {
    tenantId: string;
    unitId: string;
    nfeId: number;
    xmlUrl: string;
    correlationId: string;
    itemPolicy?: NfeXmlPolicyFilters;
  }): Promise<NfeXmlProcessResult> {
    const xml = await downloadXml(input.xmlUrl);
    const items = parseXml(xml);
    if (items.length === 0) throw new Error("XML da NF-e não possui itens");
    const ignoredReason = input.itemPolicy
      ? itemPolicyReason(items, input.itemPolicy)
      : null;
    if (ignoredReason) {
      return {
        items: items.length,
        inconsistentItems: 0,
        calculated: false,
        totalCost: 0,
        netRevenue: 0,
        profit: 0,
        margin: 0,
        ignored: true,
        ignoredReason,
      };
    }

    const result = await this.database.$transaction(
      async (transaction) => {
        const invoice = (
          await transaction.$queryRaw<InvoiceContextRow[]>(Prisma.sql`
          SELECT n.id,
                 n.id_bling::text AS "blingId",
                 n.loja_id::text AS "storeId",
                 n.valor::float AS total,
                 n.parcela_obs AS "installmentNote"
          FROM nfe n
          WHERE n.id = ${input.nfeId} AND n.unit_id = ${input.unitId}
          FOR UPDATE
        `)
        )[0];
        if (!invoice) throw new Error("NF-e não encontrada para cálculo");

        const products = await transaction.$queryRaw<ProductRow[]>(Prisma.sql`
        SELECT id,
               id_produto::text AS "blingProductId",
               codigo::text AS code,
               nome AS name,
               custo::float AS cost,
               CASE WHEN active THEN 'A' ELSE 'I' END AS status,
               CASE WHEN monophase THEN 'S' ELSE 'N' END AS monophase,
               fabricacao_propria AS "ownManufacture"
        FROM produtos
        WHERE unit_id = ${input.unitId}
      `);
        const previousProducts = await transaction.$queryRaw<
          ProductByLineRow[]
        >(Prisma.sql`
        SELECT ni.n_item AS line,
               p.id,
               p.id_produto::text AS "blingProductId",
               p.codigo::text AS code,
               p.nome AS name,
               p.custo::float AS cost,
               CASE WHEN p.active THEN 'A' ELSE 'I' END AS status,
               CASE WHEN p.monophase THEN 'S' ELSE 'N' END AS monophase,
               p.fabricacao_propria AS "ownManufacture"
        FROM nfe_item ni
        JOIN produtos p ON p.id = ni.produtos_id AND p.unit_id = ni.unit_id
        WHERE ni.nfe_id = ${input.nfeId} AND ni.unit_id = ${input.unitId}
      `);
        const fixedCosts = await transaction.$queryRaw<
          FixedCostRow[]
        >(Prisma.sql`
        SELECT cf.id,
               cf.nome AS name,
               cf.tipo AS scope,
               cf.tipo_valor AS "valueKind",
               cf.valor::float AS value,
               tcf.tipo AS category
        FROM custo_fixo cf
        LEFT JOIN tipo_custo_fixo tcf ON tcf.id = cf.tipo_custo_fixo_id AND tcf.unit_id = cf.unit_id
        WHERE cf.unit_id = ${input.unitId}
          AND cf.active = true
          AND (
            NOT EXISTS (
              SELECT 1 FROM cfcv link
              WHERE link.fixed_cost_id = cf.id AND link.unit_id = cf.unit_id
            )
            OR EXISTS (
              SELECT 1
              FROM cfcv link
              JOIN canal_venda cv
                ON cv.id = link.canal_venda_id AND cv.unit_id = link.unit_id
              WHERE link.fixed_cost_id = cf.id
                AND link.unit_id = cf.unit_id
                AND cv.loja_id::text = ${invoice.storeId}
            )
          )
      `);
        const orderCosts = (
          await transaction.$queryRaw<OrderCostRow[]>(Prisma.sql`
          SELECT taxa_comissao::float AS commission, custo_frete::float AS freight
          FROM pedido_venda
          WHERE unit_id = ${input.unitId} AND nfe_id_bling::text = ${invoice.blingId}
          ORDER BY id DESC LIMIT 1
        `)
        )[0] ?? { commission: null, freight: null };
        const installments = installmentCount(invoice.installmentNote);
        const installmentRate = installments
          ? ((
              await transaction.$queryRaw<RateRow[]>(Prisma.sql`
              SELECT aliquota::float AS rate FROM taxa_parcelamento
              WHERE unit_id = ${input.unitId} AND parcela = ${installments}
              LIMIT 1
            `)
            )[0]?.rate ?? 0)
          : 0;

        await transaction.$executeRaw(Prisma.sql`
        DELETE FROM credito_item WHERE unit_id = ${input.unitId}
          AND nfe_item_id IN (SELECT id FROM nfe_item WHERE nfe_id = ${input.nfeId} AND unit_id = ${input.unitId})
      `);
        await transaction.$executeRaw(Prisma.sql`
        DELETE FROM custo_item WHERE unit_id = ${input.unitId}
          AND nfe_item_id IN (SELECT id FROM nfe_item WHERE nfe_id = ${input.nfeId} AND unit_id = ${input.unitId})
      `);
        await transaction.$executeRaw(Prisma.sql`
        DELETE FROM taxa_item WHERE unit_id = ${input.unitId}
          AND nfe_item_id IN (SELECT id FROM nfe_item WHERE nfe_id = ${input.nfeId} AND unit_id = ${input.unitId})
      `);
        await transaction.$executeRaw(Prisma.sql`
        DELETE FROM tributacao_item WHERE unit_id = ${input.unitId}
          AND nfe_item_id IN (SELECT id FROM nfe_item WHERE nfe_id = ${input.nfeId} AND unit_id = ${input.unitId})
      `);
        await transaction.$executeRaw(Prisma.sql`
        DELETE FROM nfe_item WHERE nfe_id = ${input.nfeId} AND unit_id = ${input.unitId}
      `);

        const productsByCode = new Map(
          products
            .filter((product) => product.code)
            .map((product) => [product.code, product]),
        );
        const productsByName = new Map(
          products
            .filter((product) => product.name)
            .map((product) => [normalizeName(product.name ?? ""), product]),
        );
        const previousProductsByLine = new Map(
          previousProducts
            .filter((product) => product.line !== null)
            .map((product) => [product.line, product]),
        );
        const noteTotal =
          invoice.total && invoice.total > 0
            ? invoice.total
            : items.reduce(
                (sum, item) =>
                  sum +
                  item.grossValue -
                  item.discount +
                  item.freight +
                  item.otherExpenses,
                0,
              );
        const taxIds = new Map<string, number>();
        const totals = {
          grossCost: 0,
          netCost: 0,
          netRevenue: 0,
          taxes: 0,
          fees: 0,
          freight: 0,
          discount: 0,
          profit: 0,
          ipiCredit: 0,
          icmsCredit: 0,
          otherExpenses: 0,
          inconsistent: 0,
          withoutProfit: 0,
        };

        for (const item of items) {
          const product =
            productsByCode.get(item.code) ??
            productsByName.get(normalizeName(item.name)) ??
            previousProductsByLine.get(item.line);
          const inconsistencies: string[] = [];
          if (!product)
            inconsistencies.push(
              `Produto ${item.code || "SEM_CODIGO"} não encontrado`,
            );
          if (item.quantity <= 0)
            inconsistencies.push("quantidade ausente no XML");
          if (item.grossValue <= 0)
            inconsistencies.push("valor total ausente no XML");
          if (product && (!product.cost || product.cost <= 0))
            inconsistencies.push("custo ausente no Bling");
          if (
            product &&
            normalizeName(product.name ?? "").split(" ")[0] !==
              normalizeName(item.name).split(" ")[0]
          )
            inconsistencies.push("descrição diverge da NF-e");

          const ipiSt = item.taxes
            .filter((entry) => entry.name === "IPI" || entry.name === "ICMSST")
            .reduce((sum, entry) => sum + entry.value, 0);
          const grossRevenue = item.grossValue + ipiSt;
          const netRevenue =
            grossRevenue - item.discount + item.freight + item.otherExpenses;
          const allocation =
            noteTotal > 0 ? netRevenue / noteTotal : 1 / items.length;
          const grossCost = (product?.cost ?? 0) * item.quantity;
          let fixedCostTotal = 0;
          let configuredTaxTotal = 0;
          let feeTotal = 0;
          let fixedCreditTotal = 0;
          const freight = item.freight + (orderCosts.freight ?? 0) * allocation;

          const inserted = await transaction.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO nfe_item (
            nfe_id, unit_id, produtos_id, id_produto, cfop, qnt, frete, desconto,
            outras_despesas, custo_total, custo_unitario, venda_total, venda_unitario,
            venda_bruto_total, venda_bruto_unitario, venda_liquido_total,
            venda_liquido_unitario, inconsistencia, n_item
          ) VALUES (
            ${input.nfeId}, ${input.unitId}, ${product?.id ?? null}, ${product?.blingProductId ?? null},
            ${item.cfop}, ${item.quantity}, ${freight}, ${item.discount}, ${item.otherExpenses},
            ${grossCost}, ${product?.cost ?? 0}, ${item.grossValue}, ${item.unitValue},
            ${grossRevenue}, ${item.quantity > 0 ? grossRevenue / item.quantity : 0}, ${netRevenue},
            ${item.quantity > 0 ? netRevenue / item.quantity : 0},
            ${inconsistencies.length > 0 ? inconsistencies.join(", ") : null}, ${item.line}
          ) RETURNING id
        `);
          const nfeItemId = inserted[0]?.id;
          if (!nfeItemId) throw new Error("Falha ao salvar item da NF-e");

          for (const entry of item.taxes) {
            let taxId = taxIds.get(entry.name);
            if (!taxId) {
              taxId = (
                await transaction.$queryRaw<IdRow[]>(Prisma.sql`
                SELECT id FROM tributacao WHERE unit_id=${input.unitId} AND nome = ${entry.name} ORDER BY id LIMIT 1
              `)
              )[0]?.id;
              if (!taxId) {
                taxId = (
                  await transaction.$queryRaw<IdRow[]>(Prisma.sql`
                  INSERT INTO tributacao (unit_id,nome) VALUES (${input.unitId},${entry.name}) RETURNING id
                `)
                )[0]?.id;
              }
              if (!taxId)
                throw new Error(`Falha ao registrar tributo ${entry.name}`);
              taxIds.set(entry.name, taxId);
            }
            await transaction.$executeRaw(Prisma.sql`
            INSERT INTO tributacao_item (
              nfe_item_id, tributacao_id, unit_id, cst, valor_base, reducao, aliquota, valor
            ) VALUES (
              ${nfeItemId}, ${taxId}, ${input.unitId}, ${entry.cst}, ${entry.base},
              ${entry.reduction}, ${entry.rate}, ${entry.value}
            )
          `);
          }

          if (installmentRate > 0) {
            const value = (netRevenue * installmentRate) / 100;
            feeTotal += value;
            await transaction.$executeRaw(Prisma.sql`
            INSERT INTO taxa_item (nfe_item_id, unit_id, nome, aliquota, valor)
            VALUES (${nfeItemId}, ${input.unitId}, 'Taxa Parcelamento', ${installmentRate}, ${value})
          `);
          }
          if ((orderCosts.commission ?? 0) > 0) {
            const value = (orderCosts.commission ?? 0) * allocation;
            feeTotal += value;
            await transaction.$executeRaw(Prisma.sql`
            INSERT INTO taxa_item (nfe_item_id, unit_id, nome, valor)
            VALUES (${nfeItemId}, ${input.unitId}, 'Comissão Mercado Livre', ${value})
          `);
          }

          for (const cost of fixedCosts) {
            const rate = cost.value ?? 0;
            const isCredit = normalizeName(cost.category ?? "") === "credito";
            if (isCredit && product?.ownManufacture) continue;
            const base = isCredit
              ? grossCost
              : cost.scope === "Nota"
                ? noteTotal
                : netRevenue;
            const value = isCredit
              ? cost.valueKind === "P"
                ? (grossCost * rate) / 100
                : cost.scope === "Nota"
                  ? rate * allocation
                  : rate
              : cost.valueKind === "F"
                ? cost.scope === "Nota"
                  ? rate * allocation
                  : rate
                : (base * (cost.scope === "Nota" ? rate * allocation : rate)) /
                  100;
            if (value === 0) continue;
            if (cost.category === "Custo") {
              fixedCostTotal += value;
              await transaction.$executeRaw(Prisma.sql`
              INSERT INTO custo_item (nfe_item_id, unit_id, custo_fixo_id, aliquota, valor)
              VALUES (${nfeItemId}, ${input.unitId}, ${cost.id}, ${cost.valueKind === "P" ? rate : null}, ${value})
            `);
            } else if (cost.category === "Imposto") {
              configuredTaxTotal += value;
              let configuredTaxId = taxIds.get(
                cost.name ?? "Imposto configurado",
              );
              if (!configuredTaxId) {
                configuredTaxId = (
                  await transaction.$queryRaw<IdRow[]>(Prisma.sql`
                  SELECT id FROM tributacao WHERE unit_id=${input.unitId} AND nome = ${cost.name ?? "Imposto configurado"} ORDER BY id LIMIT 1
                `)
                )[0]?.id;
              }
              if (!configuredTaxId) {
                configuredTaxId = (
                  await transaction.$queryRaw<IdRow[]>(Prisma.sql`
                  INSERT INTO tributacao (unit_id,nome) VALUES (${input.unitId},${cost.name ?? "Imposto configurado"}) RETURNING id
                `)
                )[0]?.id;
              }
              if (!configuredTaxId)
                throw new Error("Falha ao registrar imposto configurado");
              taxIds.set(cost.name ?? "Imposto configurado", configuredTaxId);
              await transaction.$executeRaw(Prisma.sql`
              INSERT INTO tributacao_item (nfe_item_id, tributacao_id, unit_id, valor_base, aliquota, valor)
              VALUES (${nfeItemId}, ${configuredTaxId}, ${input.unitId}, ${base}, ${rate}, ${value})
            `);
            } else if (cost.category === "Taxa") {
              feeTotal += value;
              await transaction.$executeRaw(Prisma.sql`
              INSERT INTO taxa_item (nfe_item_id, unit_id, custo_fixo_id, nome, aliquota, valor)
              VALUES (${nfeItemId}, ${input.unitId}, ${cost.id}, ${cost.name}, ${rate}, ${value})
            `);
            } else if (isCredit) {
              fixedCreditTotal += value;
              await transaction.$executeRaw(Prisma.sql`
              INSERT INTO credito_item (nfe_item_id, unit_id, custo_fixo_id, aliquota, valor)
              VALUES (${nfeItemId}, ${input.unitId}, ${cost.id}, ${rate}, ${value})
            `);
            }
          }

          const xmlTaxTotal = item.taxes
            .filter((entry) => TAXES_IN_LP.has(entry.name))
            .reduce((sum, entry) => sum + entry.value, 0);
          const ipiRate =
            item.taxes.find((entry) => entry.name === "IPI")?.rate ?? 0;
          const ipiCredit = (grossCost * ipiRate) / 100;
          const icmsCredit = fixedCreditTotal;
          const netCost =
            Math.max(0, grossCost - ipiCredit - icmsCredit) + fixedCostTotal;
          const taxTotal = xmlTaxTotal + configuredTaxTotal;
          const profit =
            netRevenue -
            (netCost + taxTotal + feeTotal + freight + item.otherExpenses);
          const margin = netRevenue !== 0 ? (profit * 100) / netRevenue : 0;

          await transaction.$executeRaw(Prisma.sql`
          UPDATE nfe_item
          SET frete = ${freight},
              custo_bruto_total = ${Math.max(0, grossCost - ipiCredit - icmsCredit)},
              custo_bruto_unitario = ${item.quantity > 0 ? Math.max(0, grossCost - ipiCredit - icmsCredit) / item.quantity : 0},
              custo_liquido_total = ${netCost},
              custo_liquido_unitario = ${item.quantity > 0 ? netCost / item.quantity : 0},
              imposto_total = ${taxTotal},
              imposto_unitario = ${item.quantity > 0 ? taxTotal / item.quantity : taxTotal},
              taxa = ${feeTotal},
              credito_ipi = ${ipiCredit},
              credito_icms = ${icmsCredit},
              valor_lucro_total = ${profit},
              valor_lucro_unitario = ${item.quantity > 0 ? profit / item.quantity : profit},
              margem_lucro_total = ${margin},
              margem_lucro_unitario = ${margin}
          WHERE id = ${nfeItemId} AND unit_id = ${input.unitId}
        `);

          totals.grossCost += grossCost;
          totals.netCost += netCost;
          totals.netRevenue += netRevenue;
          totals.taxes += taxTotal;
          totals.fees += feeTotal;
          totals.freight += freight;
          totals.discount += item.discount;
          totals.profit += profit;
          totals.ipiCredit += ipiCredit;
          totals.icmsCredit += icmsCredit;
          totals.otherExpenses += item.otherExpenses;
          if (inconsistencies.length > 0) totals.inconsistent += 1;
          if (profit <= 0) totals.withoutProfit += 1;
        }

        const margin =
          totals.netRevenue !== 0
            ? (totals.profit * 100) / totals.netRevenue
            : 0;
        const calculated = totals.inconsistent === 0;
        const observation = [
          totals.inconsistent > 0
            ? `${totals.inconsistent} item(ns) com inconsistência`
            : null,
          totals.withoutProfit > 0
            ? `${totals.withoutProfit} item(ns) sem lucro`
            : null,
        ]
          .filter(Boolean)
          .join("; ");
        await transaction.$executeRaw(Prisma.sql`
        UPDATE nfe
        SET calculation_status = ${calculated ? "calculated" : "inconsistent"}::"CalculationStatus",
            obs_calculo = ${observation || null},
            custo_total = ${totals.grossCost},
            custo_liquido = ${totals.netCost},
            venda_liquido = ${totals.netRevenue},
            impostos = ${totals.taxes},
            lucro = ${totals.profit},
            margem_lucro = ${margin},
            frete = ${totals.freight},
            desconto = ${totals.discount},
            taxa = ${totals.fees},
            credito_ipi = ${totals.ipiCredit},
            credito_icms = ${totals.icmsCredit},
            outras_despesas = ${totals.otherExpenses}
        WHERE id = ${input.nfeId} AND unit_id = ${input.unitId}
      `);
        return {
          items: items.length,
          inconsistentItems: totals.inconsistent,
          calculated,
          totalCost: round(totals.netCost),
          netRevenue: round(totals.netRevenue),
          profit: round(totals.profit),
          margin: round(margin),
        } satisfies NfeXmlProcessResult;
      },
      { timeout: 30_000 },
    );

    await this.database.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: null,
        action: "nfe.xml.processed",
        entityType: "nfe",
        entityId: String(input.nfeId),
        correlationId: input.correlationId,
        metadata: result,
      },
    });
    return result;
  }
}

function itemPolicyReason(
  items: ParsedItem[],
  policy: NfeXmlPolicyFilters,
): string | null {
  const cfops = items.map((item) =>
    item.cfop === null ? "" : String(item.cfop),
  );
  const skus = items.map((item) => item.code.trim().toLocaleLowerCase("pt-BR"));
  const ncms = items.map((item) => (item.ncm ?? "").replace(/\D/g, ""));
  const includedCfops = policy.includedCfops.map(normalizeDigits);
  const excludedCfops = policy.excludedCfops.map(normalizeDigits);
  const includedSkus = policy.includedSkus.map((value) =>
    value.trim().toLocaleLowerCase("pt-BR"),
  );
  const excludedSkus = policy.excludedSkus.map((value) =>
    value.trim().toLocaleLowerCase("pt-BR"),
  );
  const includedNcms = policy.includedNcms.map(normalizeDigits);
  const excludedNcms = policy.excludedNcms.map(normalizeDigits);

  if (
    includedCfops.length > 0 &&
    !cfops.some((value) => includedCfops.includes(value))
  )
    return "Nenhum item possui CFOP permitido";
  if (cfops.some((value) => value !== "" && excludedCfops.includes(value)))
    return "NF-e contém CFOP bloqueado";
  if (
    includedSkus.length > 0 &&
    !skus.some((value) => includedSkus.includes(value))
  )
    return "Nenhum item possui SKU permitido";
  if (skus.some((value) => value !== "" && excludedSkus.includes(value)))
    return "NF-e contém SKU bloqueado";
  if (
    includedNcms.length > 0 &&
    !ncms.some((value) => includedNcms.includes(value))
  )
    return "Nenhum item possui NCM permitido";
  if (ncms.some((value) => value !== "" && excludedNcms.includes(value)))
    return "NF-e contém NCM bloqueado";
  return null;
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}
