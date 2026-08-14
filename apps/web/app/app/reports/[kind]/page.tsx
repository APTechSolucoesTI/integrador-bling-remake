import { DashboardReportClient } from "../../../../components/dashboard/dashboard-report-client";
import { Suspense } from "react";

export default async function DashboardReportPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  return (
    <Suspense fallback={<main>Carregando relatório...</main>}>
      <DashboardReportClient kind={(await params).kind} />
    </Suspense>
  );
}
