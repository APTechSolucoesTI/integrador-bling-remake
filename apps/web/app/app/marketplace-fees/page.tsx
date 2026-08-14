import type { Metadata } from "next";
import { MarketplaceFeesClient } from "../../../components/marketplace-fees/marketplace-fees-client";

export const metadata: Metadata = { title: "Taxas Mercado Livre" };

export default function MarketplaceFeesPage() {
  return <MarketplaceFeesClient />;
}
