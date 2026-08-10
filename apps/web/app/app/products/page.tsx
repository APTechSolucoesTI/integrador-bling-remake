import type { Metadata } from "next";
import { CatalogClient } from "../../../components/catalog/catalog-client";

export const metadata: Metadata = { title: "Produtos" };

export default function ProductsPage() {
  return <CatalogClient kind="products" />;
}
