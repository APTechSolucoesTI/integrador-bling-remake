import { describe, expect, it } from "vitest";
import {
  DEMO_STORAGE_KEY,
  calculateDemoMetrics,
  createDefaultDemoState,
  loadDemoState,
  saveDemoState,
} from "./demo-store";

describe("demo local", () => {
  it("calcula os cards com centavos inteiros e ignora notas canceladas", () => {
    const state = createDefaultDemoState();
    const expectedRevenue = state.invoices
      .filter((item) => item.status !== "Cancelada")
      .reduce((total, item) => total + item.valueCents, 0);
    expect(calculateDemoMetrics(state).revenueCents).toBe(expectedRevenue);
  });

  it("descarta localStorage adulterado e restaura os mocks", () => {
    const state = loadDemoState({
      getItem: () => JSON.stringify({ version: 1, invoices: "não confiável" }),
    });
    expect(state.invoices.length).toBeGreaterThan(5);
  });

  it("salva e recupera manipulações locais", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const state = createDefaultDemoState();
    state.products[0]!.stock += 7;
    expect(saveDemoState(storage, state)).toBe(true);
    expect(values.has(DEMO_STORAGE_KEY)).toBe(true);
    expect(loadDemoState(storage).products[0]!.stock).toBe(
      state.products[0]!.stock,
    );
  });
});
