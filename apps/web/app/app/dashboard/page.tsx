import type { Metadata } from "next";
import { DashboardClient } from "../../../components/dashboard/dashboard-client";

export const metadata: Metadata = { title: "Visão geral" };

export default function DashboardPage() {
  return <DashboardClient />;
}
