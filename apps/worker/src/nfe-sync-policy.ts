import type { NfeSyncPolicy } from "@integrador/contracts";

interface StoredPolicy extends Omit<
  NfeSyncPolicy,
  "minimumTotal" | "maximumTotal"
> {
  minimumTotal: { toNumber(): number } | number | null;
  maximumTotal: { toNumber(): number } | number | null;
}

export interface NfePolicySummary {
  status: number;
  direction: number | null | undefined;
  customerId: string | null | undefined;
  customerName: string | null | undefined;
  customerDocument: string | null | undefined;
  natureId: string | null | undefined;
  natureDescription: string | null | undefined;
  salesChannelId: string | null | undefined;
}

export interface NfePolicyDetail {
  sellerId: string | null | undefined;
  total: number | null | undefined;
}

export function defaultNfeSyncPolicy(): NfeSyncPolicy {
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

export function resolveNfeSyncPolicy(
  stored: StoredPolicy | null,
): NfeSyncPolicy {
  if (!stored) return defaultNfeSyncPolicy();
  return {
    ...stored,
    minimumTotal: decimalNumber(stored.minimumTotal),
    maximumTotal: decimalNumber(stored.maximumTotal),
  };
}

export function summaryPolicyReason(
  invoice: NfePolicySummary,
  policy: NfeSyncPolicy,
): string | null {
  if (!policy.enabled) return null;
  if (!policy.allowedStatuses.includes(invoice.status))
    return `Situação ${invoice.status} não permitida`;
  if (
    invoice.direction !== null &&
    invoice.direction !== undefined &&
    !policy.allowedDirections.includes(invoice.direction)
  )
    return `Tipo de nota ${invoice.direction} não permitido`;

  const natureId = clean(invoice.natureId);
  const nature = normalize(invoice.natureDescription);
  if (!matchesExact(natureId, policy.includedNatureIds))
    return "Natureza fora da lista permitida";
  if (containsExact(natureId, policy.excludedNatureIds))
    return "Natureza bloqueada";
  if (policy.requireSaleNature && !nature.includes("venda"))
    return "Natureza sem indicação de venda";
  if (policy.excludeReturnNature && nature.includes("devolucao"))
    return "Natureza de devolução bloqueada";

  const customerId = clean(invoice.customerId);
  const customerDocument = digits(invoice.customerDocument);
  const customerName = normalize(invoice.customerName);
  if (!matchesExact(customerId, policy.includedCustomerIds))
    return "Cliente fora da lista permitida";
  if (containsExact(customerId, policy.excludedCustomerIds))
    return "Cliente bloqueado";
  if (!matchesExact(customerDocument, policy.includedCustomerDocuments, digits))
    return "Documento do cliente fora da lista permitida";
  if (containsExact(customerDocument, policy.excludedCustomerDocuments, digits))
    return "Documento do cliente bloqueado";
  if (!matchesTerm(customerName, policy.includedCustomerTerms))
    return "Nome do cliente fora da lista permitida";
  if (containsTerm(customerName, policy.excludedCustomerTerms))
    return "Nome do cliente bloqueado";

  const salesChannelId = clean(invoice.salesChannelId);
  if (!matchesExact(salesChannelId, policy.includedSalesChannelIds))
    return "Canal de venda fora da lista permitida";
  if (containsExact(salesChannelId, policy.excludedSalesChannelIds))
    return "Canal de venda bloqueado";
  return null;
}

export function detailPolicyReason(
  detail: NfePolicyDetail,
  policy: NfeSyncPolicy,
): string | null {
  if (!policy.enabled) return null;
  const sellerId = clean(detail.sellerId);
  if (!matchesExact(sellerId, policy.includedSellerIds))
    return "Vendedor fora da lista permitida";
  if (containsExact(sellerId, policy.excludedSellerIds))
    return "Vendedor bloqueado";
  const total = detail.total ?? 0;
  if (policy.minimumTotal !== null && total < policy.minimumTotal)
    return `Valor da NF-e abaixo de ${policy.minimumTotal}`;
  if (policy.maximumTotal !== null && total > policy.maximumTotal)
    return `Valor da NF-e acima de ${policy.maximumTotal}`;
  return null;
}

function matchesExact(
  value: string,
  included: string[],
  normalizer: (value: string | null | undefined) => string = clean,
): boolean {
  return (
    included.length === 0 ||
    included.some((entry) => normalizer(entry) === value)
  );
}

function containsExact(
  value: string,
  excluded: string[],
  normalizer: (value: string | null | undefined) => string = clean,
): boolean {
  return value !== "" && excluded.some((entry) => normalizer(entry) === value);
}

function matchesTerm(value: string, included: string[]): boolean {
  return (
    included.length === 0 || included.some((entry) => termMatches(value, entry))
  );
}

function containsTerm(value: string, excluded: string[]): boolean {
  return value !== "" && excluded.some((entry) => termMatches(value, entry));
}

function termMatches(value: string, term: string): boolean {
  const normalizedTerm = normalize(term);
  return (
    value.includes(normalizedTerm) ||
    value.replace(/\s/g, "").includes(normalizedTerm.replace(/\s/g, ""))
  );
}

function normalize(value: string | null | undefined): string {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clean(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function digits(value: string | null | undefined): string {
  return clean(value).replace(/\D/g, "");
}

function decimalNumber(
  value: { toNumber(): number } | number | null,
): number | null {
  if (value === null) return null;
  return typeof value === "number" ? value : value.toNumber();
}
