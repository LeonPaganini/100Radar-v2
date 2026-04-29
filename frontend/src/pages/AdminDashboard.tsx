import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Database, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageAlert, AdminRetryAction } from "@/features/admin/AdminQueryState";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import { adminStatusTone, formatDateTime, formatDuration } from "@/features/admin/admin-utils";
import { ApiError, getAdminDashboardOverview } from "@/lib/api";

const AdminDashboard = () => {
  const { isAuthenticated } = useAdminAuth();
  const dashboardQuery = useQuery({ queryKey: ["admin-dashboard"], queryFn: getAdminDashboardOverview, enabled: isAuthenticated });
  const data = dashboardQuery.data;
  const isUnauthorized = dashboardQuery.error instanceof ApiError && dashboardQuery.error.status === 401;
  const hasNoMetrics = !dashboardQuery.isLoading && !dashboardQuery.isError && (data?.metrics.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard operacional</h1>
        <p className="text-sm text-muted-foreground">
          Visão resumida das sincronizações, falhas, consultas e estado geral do pipeline administrativo.
        </p>
      </div>

      {dashboardQuery.isError ? (
        <AdminPageAlert
          tone="danger"
          title="Falha ao carregar o dashboard"
          description={
            isUnauthorized
              ? "Sua sessão administrativa não foi enviada ou expirou (401). Faça login novamente para carregar o dashboard."
              : "O endpoint /v1/admin/dashboard/overview retornou erro operacional."
          }
          action={<AdminRetryAction onRetry={() => void dashboardQuery.refetch()} />}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(data?.metrics.length
          ? data.metrics
          : Array.from({ length: 8 }, (_, index) => ({
              label: "Carregando mÃ©trica",
              value: undefined,
              tone: "default",
              helper: "Aguardando dados operacionais.",
              key: index,
            }))
        ).map((metric, index) => (
          <Card key={metric?.label ?? index}>
            <CardHeader className="pb-3">
              <CardDescription>{metric?.label ?? "Carregando métrica"}</CardDescription>
              <CardTitle className="text-3xl">{dashboardQuery.isLoading ? "…" : metric?.value ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={adminStatusTone(metric?.tone ?? "default")}>{metric?.tone ?? "default"}</Badge>
              <p className="mt-2 text-xs text-muted-foreground">{metric?.helper ?? "Aguardando dados operacionais."}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasNoMetrics ? (
        <AdminPageAlert
          title="Sem dados operacionais suficientes"
          description="O dashboard abriu, mas as tabelas que alimentam as métricas ainda estão vazias ou sem eventos recentes."
          tone="warning"
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Últimas execuções</CardTitle>
            <CardDescription>Histórico recente das sincronizações e reprocessamentos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.latestRuns.length ? data.latestRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.uf}</TableCell>
                    <TableCell><Badge variant={adminStatusTone(run.status)}>{run.status}</Badge></TableCell>
                    <TableCell>{formatDateTime(run.startedAt)}</TableCell>
                    <TableCell>{formatDateTime(run.finishedAt)}</TableCell>
                    <TableCell>{formatDuration(run.durationSeconds)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma execução registrada em dataset_runs até o momento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Últimas falhas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.latestFailures.length ? data.latestFailures.map((run) => (
                <div key={run.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{run.uf}</span>
                    <Badge variant="destructive">{run.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{run.errorMessage ?? "Sem mensagem de erro."}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">Nenhuma falha recente registrada.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4" /> Últimas UFs atualizadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.latestUpdatedUfs.length ? data.latestUpdatedUfs.map((item) => (
                <div key={`${item.uf}-${item.last_sync_at}`} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{item.uf}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(item.last_sync_at)}</div>
                  </div>
                  <Badge variant={adminStatusTone(item.status)}>{item.status}</Badge>
                </div>
              )) : <p className="text-sm text-muted-foreground">Sem atualizações recentes.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><RefreshCcw className="h-4 w-4" /> Resumo operacional</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Use as telas de Bases, Jobs, Testes e Operação para executar sincronizações manuais, validar integridade, rodar diagnósticos e acompanhar agendamentos sem precisar de terminal.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
