import type { Metadata } from "next";
import { BusinessClient } from "../../../components/business/business-client";
export const metadata: Metadata = { title: "Cadastros comerciais" };
export default function CommercialPage() { return <BusinessClient mode="commercial" />; }
