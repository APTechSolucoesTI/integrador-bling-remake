import type { Metadata } from "next";
import { BusinessClient } from "../../../components/business/business-client";
export const metadata: Metadata = { title: "Custos e tributação" };
export default function FiscalPage() { return <BusinessClient mode="fiscal" />; }
