import type { Metadata } from "next";
import { NfeDetailClient } from "../../../../../components/nfe/nfe-detail-client";

export const metadata: Metadata = { title: "Rentabilidade da NF-e" };

export default function FinancialNfeDetailPage() {
  return <NfeDetailClient financial />;
}
