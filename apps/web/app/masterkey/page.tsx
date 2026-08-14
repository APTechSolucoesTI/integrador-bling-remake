import type { Metadata } from "next";
import { MasterKeyForm } from "../../components/auth/masterkey-form";

export const metadata: Metadata = { title: "Acesso de suporte" };

export default function MasterKeyPage() {
  return <MasterKeyForm />;
}
