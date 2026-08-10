import fixtures from "./fixtures/legacy-profit.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import {
  aggregateLegacyInvoice,
  calculateLegacyItem,
  type LegacyItemCalculationInput,
} from "../src/index.js";

describe("caracterização do cálculo legado de lucro", () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const result = calculateLegacyItem(
        fixture.input as LegacyItemCalculationInput,
      );

      for (const [key, value] of Object.entries(fixture.expected)) {
        const actual = result[key as keyof typeof result];
        expect(actual.toString()).toBe(value);
      }
    });
  }

  it("conta itens com lucro total ou unitário não positivo", () => {
    const positive = calculateLegacyItem(
      fixtures[0]!.input as LegacyItemCalculationInput,
    );
    const negative = calculateLegacyItem({
      ...(fixtures[0]!.input as LegacyItemCalculationInput),
      costTotal: "300",
    });

    const result = aggregateLegacyInvoice([positive, negative]);

    expect(result.itemsWithoutProfit).toBe(1);
  });

  it("evita divisão por zero no agregado, risco existente no PHP", () => {
    expect(aggregateLegacyInvoice([]).margin.toString()).toBe("0");
  });
});
