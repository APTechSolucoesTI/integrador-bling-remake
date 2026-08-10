import type { Metadata } from "next";
import { AdministrationClient } from "../../../components/administration/administration-client";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  return <AdministrationClient mode="settings" />;
}
