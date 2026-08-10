import type { Metadata } from "next";
import { BusinessClient } from "../../../components/business/business-client";
export const metadata: Metadata = { title: "Boletos e rastreamento" };
export default function DocumentsPage() { return <BusinessClient mode="documents" />; }
