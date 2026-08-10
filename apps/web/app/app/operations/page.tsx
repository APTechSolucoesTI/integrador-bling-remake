import type { Metadata } from "next";
import { OperationsClient } from "../../../components/operations/operations-client";

export const metadata: Metadata = { title: "Jobs e integrações" };

export default function OperationsPage() {
  return <OperationsClient />;
}
