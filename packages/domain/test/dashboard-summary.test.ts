import { describe, expect, it } from "vitest";
import { aggregateDashboard } from "../src/dashboard/dashboard-summary.js";

describe("dashboard summary", () => {
  it("usa margem agregada lucro/faturamento como o DashFinal", () => {
    const summary = aggregateDashboard(
      [
        {
          number: "1",
          issuedAt: new Date("2026-07-10T00:00:00Z"),
          customerName: "A",
          channel: "Bling",
          grossRevenue: "100.00",
          netRevenue: "90.00",
          cost: "50.00",
          tax: "10.00",
          profit: "30.00",
          status: "Autorizada",
          hasBoleto: true,
          hasTracking: false,
        },
        {
          number: "2",
          issuedAt: new Date("2026-08-01T00:00:00Z"),
          customerName: "B",
          channel: "Mercado Livre",
          grossRevenue: "300.00",
          netRevenue: "250.00",
          cost: "170.00",
          tax: "30.00",
          profit: "60.00",
          status: "Autorizada",
          hasBoleto: false,
          hasTracking: true,
        },
      ],
      ["2026-07", "2026-08"],
    );
    expect(summary.metrics).toMatchObject({
      grossRevenue: "400.00",
      profit: "90.00",
      marginPercent: "22.50",
      invoiceCount: 2,
    });
    expect(summary.months[1]).toMatchObject({
      grossRevenue: "300.00",
      profit: "60.00",
    });
  });
});
