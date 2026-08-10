import type { Metadata } from "next";
import { AdministrationClient } from "../../../components/administration/administration-client";

export const metadata: Metadata = { title: "Usuários e acesso" };

export default function UsersPage() {
  return <AdministrationClient mode="users" />;
}
