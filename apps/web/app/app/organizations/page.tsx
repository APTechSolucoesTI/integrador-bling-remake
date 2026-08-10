import type { Metadata } from "next";
import { OrganizationsClient } from "../../../components/administration/organizations-client";
export const metadata: Metadata = { title: "Empresas" };
export default function OrganizationsPage() { return <OrganizationsClient />; }
