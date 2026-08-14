import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardClient } from "../../../components/dashboard/dashboard-client";

export const metadata: Metadata = { title: "Visão geral" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<main>Carregando dashboard...</main>}>
      <DashboardClient />
    </Suspense>
  );
}
