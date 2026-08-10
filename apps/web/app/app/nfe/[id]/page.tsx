import type { Metadata } from "next";
import { NfeDetailClient } from "../../../../components/nfe/nfe-detail-client";

export const metadata: Metadata = { title: "Detalhes da NF-e" };

export default function NfeDetailPage() {
  return <NfeDetailClient />;
}
