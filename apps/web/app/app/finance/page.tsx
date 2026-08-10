import type { Metadata } from "next";
import { FinanceClient } from "../../../components/finance/finance-client";

export const metadata: Metadata = { title: "Custos e margem" };

export default function FinancePage() {
  return <FinanceClient />;
}
