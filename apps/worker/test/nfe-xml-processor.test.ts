import { describe, expect, it } from "vitest";
import {
  applyConfiguredDifal,
  resolveFreightCost,
} from "../src/nfe-xml-processor.js";

describe("fonte do frete da NF-e", () => {
  it("não soma novamente o frete do pedido quando o XML já possui frete", () => {
    expect(resolveFreightCost(16.99, 13.1, 1)).toBe(16.99);
  });

  it("distribui o frete do pedido somente quando o XML não possui frete", () => {
    expect(resolveFreightCost(0, 20, 0.25)).toBe(5);
  });
});

describe("DIFAL configurado", () => {
  it("reproduz a regra do legado para destinatário não contribuinte", () => {
    const taxes = applyConfiguredDifal(
      [
        {
          name: "ICMS",
          cst: 0,
          base: 410,
          reduction: 0,
          rate: 12,
          value: 49.2,
        },
      ],
      19.5,
    );

    expect(taxes.find((tax) => tax.name === "DIFAL")).toMatchObject({
      base: 410,
      rate: 7.5,
      value: 30.75,
    });
  });

  it("substitui o DIFAL do XML pela alíquota interna configurada", () => {
    const taxes = applyConfiguredDifal(
      [
        {
          name: "ICMS",
          cst: 0,
          base: 146,
          reduction: 0,
          rate: 12,
          value: 17.52,
        },
        {
          name: "DIFAL",
          cst: null,
          base: 146,
          reduction: 0,
          rate: 8,
          value: 11.68,
        },
      ],
      22,
    );

    expect(taxes.filter((tax) => tax.name === "DIFAL")).toEqual([
      expect.objectContaining({ rate: 10, value: 14.6 }),
    ]);
  });
});
