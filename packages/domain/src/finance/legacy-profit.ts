import { Decimal } from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type LegacyTaxRegime = "LP" | "SN";
export type DecimalInput = Decimal.Value;

export interface LegacyItemCalculationInput {
  regime: LegacyTaxRegime;
  quantity: DecimalInput;
  saleTotal: DecimalInput;
  saleUnit: DecimalInput;
  discount: DecimalInput;
  freight: DecimalInput;
  otherExpenses: DecimalInput;
  grossTaxAdditions: DecimalInput;
  costTotal: DecimalInput;
  allocatedCosts: DecimalInput;
  taxes: DecimalInput;
  fees: DecimalInput;
  ipiCreditRate: DecimalInput;
  icmsCreditRate: DecimalInput;
  fiscalIncentiveProduct: boolean;
}

export interface LegacyItemCalculation {
  grossSaleTotal: Decimal;
  grossSaleUnit: Decimal;
  netSaleTotal: Decimal;
  netSaleUnit: Decimal;
  ipiCredit: Decimal;
  icmsCredit: Decimal;
  grossCostTotal: Decimal;
  grossCostUnit: Decimal;
  netCostTotal: Decimal;
  netCostUnit: Decimal;
  profitTotal: Decimal;
  profitUnit: Decimal;
  marginTotal: Decimal;
  marginUnit: Decimal;
}

const decimal = (value: DecimalInput): Decimal => new Decimal(value);
const percentage = (base: Decimal, rate: DecimalInput): Decimal =>
  base.mul(decimal(rate).div(100));

/**
 * Caracterização pura das fórmulas em NFEService::saveTributacaoItemXml.
 *
 * O cálculo mantém duas assimetrias observadas no PHP:
 * - outras despesas entram na venda líquida total, mas não na unitária;
 * - créditos de IPI/ICMS só reduzem o custo no regime LP.
 *
 * Não arredonde intermediários aqui. O legado arredonda a venda líquida apenas
 * ao distribuir taxas/custos da nota e no agregado final.
 */
export function calculateLegacyItem(
  input: LegacyItemCalculationInput,
): LegacyItemCalculation {
  const quantity = decimal(input.quantity);
  const hasQuantity = quantity.gt(0);
  const saleTotal = decimal(input.saleTotal);
  const saleUnit = decimal(input.saleUnit);
  const discount = decimal(input.discount);
  const freight = decimal(input.freight);
  const otherExpenses = decimal(input.otherExpenses);
  const additions =
    input.regime === "LP" ? decimal(input.grossTaxAdditions) : new Decimal(0);

  const grossSaleTotal = saleTotal.add(additions);
  const grossSaleUnit = hasQuantity
    ? saleUnit.add(additions.div(quantity))
    : saleUnit;
  const netSaleTotal = grossSaleTotal
    .sub(discount)
    .add(freight)
    .add(otherExpenses);
  const netSaleUnit = hasQuantity
    ? grossSaleUnit.sub(discount.div(quantity)).add(freight.div(quantity))
    : new Decimal(0);

  const costTotal = decimal(input.costTotal);
  const ipiCredit =
    input.regime === "LP"
      ? percentage(costTotal, input.ipiCreditRate)
      : new Decimal(0);
  const icmsCredit =
    input.regime === "LP" && !input.fiscalIncentiveProduct
      ? percentage(costTotal, input.icmsCreditRate)
      : new Decimal(0);
  const grossCostTotal = costTotal.sub(ipiCredit).sub(icmsCredit);
  const grossCostUnit = hasQuantity
    ? grossCostTotal.div(quantity)
    : new Decimal(0);
  const netCostTotal = grossCostTotal.add(decimal(input.allocatedCosts));
  const netCostUnit = hasQuantity ? netCostTotal.div(quantity) : new Decimal(0);

  const feesFreightAndExpenses = decimal(input.fees)
    .add(freight)
    .add(otherExpenses);
  const profitTotal = netSaleTotal.sub(
    netCostTotal.add(decimal(input.taxes)).add(feesFreightAndExpenses),
  );
  const profitUnit = hasQuantity
    ? netSaleUnit.sub(
        netCostUnit
          .add(decimal(input.taxes).div(quantity))
          .add(feesFreightAndExpenses.div(quantity)),
      )
    : saleTotal.sub(
        grossCostTotal
          .add(decimal(input.taxes))
          .add(discount)
          .add(decimal(input.fees)),
      );

  return {
    grossSaleTotal,
    grossSaleUnit,
    netSaleTotal,
    netSaleUnit,
    ipiCredit,
    icmsCredit,
    grossCostTotal,
    grossCostUnit,
    netCostTotal,
    netCostUnit,
    profitTotal,
    profitUnit,
    marginTotal: netSaleTotal.isZero()
      ? new Decimal(0)
      : profitTotal.mul(100).div(netSaleTotal),
    marginUnit: netSaleUnit.isZero()
      ? new Decimal(0)
      : profitUnit.mul(100).div(netSaleUnit),
  };
}

export interface LegacyInvoiceTotals {
  netSale: Decimal;
  profit: Decimal;
  margin: Decimal;
  itemsWithoutProfit: number;
}

export function aggregateLegacyInvoice(
  items: readonly LegacyItemCalculation[],
): LegacyInvoiceTotals {
  const netSale = items
    .reduce((total, item) => total.add(item.netSaleTotal), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const profit = items.reduce(
    (total, item) => total.add(item.profitTotal),
    new Decimal(0),
  );

  return {
    netSale,
    profit,
    margin: netSale.isZero() ? new Decimal(0) : profit.mul(100).div(netSale),
    itemsWithoutProfit: items.filter(
      (item) => item.profitTotal.lte(0) || item.profitUnit.lte(0),
    ).length,
  };
}
