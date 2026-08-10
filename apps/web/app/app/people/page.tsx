import type { Metadata } from "next";
import { CatalogClient } from "../../../components/catalog/catalog-client";

export const metadata: Metadata = { title: "Pessoas" };

export default function PeoplePage() {
  return <CatalogClient kind="people" />;
}
