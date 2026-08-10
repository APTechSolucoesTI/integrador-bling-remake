import type { Metadata } from "next";
import { NfeClient } from "../../../components/nfe/nfe-client";

export const metadata: Metadata = { title: "Notas fiscais" };

export default function NfePage() {
  return <NfeClient />;
}
