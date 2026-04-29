import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import { AdminPageAlert, AdminRetryAction } from "@/features/admin/AdminQueryState";
import { adminStatusTone, formatDateTime } from "@/features/admin/admin-utils";
import { getAdminHealth, listAdminBases, listAdminLogs, listAdminSchedules, updateAdminSchedule } from "@/lib/api";

const AdminOperacao = () => {
  const [scheduleTime, setScheduleTime] = useState("03:00");
  const [activeUfs, setActiveUfs] = useState("RJ,SP,MG");
  const [enabled, setEnabled] = useState(true);
  const { isAuthenticated } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const basesQuery = useQuery({ queryKey: ["admin-bases"], queryFn: listAdminBases, enabled: isAuthenticated });
  const healthQuery = useQuery({ queryKey: ["admin-health"], queryFn: getAdminHealth, enabled: isAuthenticated });
  const logsQuery = useQuery({ queryKey: ["admin-logs"], queryFn: listAdminLogs, enabled: isAuthenticated });
  const schedulesQuery = useQuery({ queryKey: ["admin-schedules"], queryFn: listAdminSchedules, enabled: isAuthenticated });
  const scheduleMutation = useMutation({
    mutationFn: updateAdminSchedule,
    onSuccess: () => {
      toast({ title: "Agendamento atualizado", description: "Configuração administrativa salva com sucesso." });
      void queryClient.invalidateQueries({ queryKey: ["admin-schedules"] });
    },
    onError: () => {
      toast({ title: "Falha ao salvar agendamento", description: "O backend não persistiu admin_schedules como esperado.", variant: "destructive" });
    },
  });

  useEffect(() => {
    const currentSchedule = schedulesQuery.data?.find((item) => item.jobType === "daily_sync");
    if (!currentSchedule) return;
    setEnabled(currentSchedule.enabled);
    setScheduleTime(currentSchedule.scheduleTime ?? "03:00");
    const payloadActiveUfs = currentSchedule.payloadJson["active_ufs"];
    const scheduleUfs = Array.isArray(payloadActiveUfs)
      ? payloadActiveUfs.map(String).join(",")
      : null;
    if (scheduleUfs) setActiveUfs(scheduleUfs);
  }, [schedulesQuery.data]);

  const staleBases = basesQuery.data?.filter((base) => !base.lastSyncAt || healthQuery.data?.staleBases.includes(base.uf));
  const failedBases = basesQuery.data?.filter((base) => base.status === "failed");
  const hasTopLevelError = basesQuery.isError || healthQuery.isError || logsQuery.isError || schedulesQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel operacional</h1>
        <p className="text-sm text-muted-foreground">Acompanhe sincronização, integridade, logs e configurações administrativas do pipeline.</p>
      </div>

      {hasTopLevelError ? (
        <AdminPageAlert
          tone="danger"
          title="Falha ao consolidar a operação"
          description="Pelo menos um dos endpoints /v1/admin/health, /v1/admin/bases, /v1/admin/logs ou /v1/admin/schedules falhou."
          action={<AdminRetryAction onRetry={() => {
            void basesQuery.refetch();
            void healthQuery.refetch();
            void logsQuery.refetch();
            void schedulesQuery.refetch();
          }} />}
        />
      ) : null}

      <Tabs defaultValue="sync" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
          <TabsTrigger value="integrity">Integridade</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card><CardHeader><CardDescription>Pipeline</CardDescription><CardTitle>{healthQuery.data?.pipelineStatus ?? "—"}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Jobs travados/falhos</CardDescription><CardTitle>{healthQuery.data?.jobsStuck ?? 0}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Timeouts recentes</CardDescription><CardTitle>{healthQuery.data?.recentTimeouts ?? 0}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Bases sem atualização</CardDescription><CardTitle>{healthQuery.data?.staleBases.length ?? 0}</CardTitle></CardHeader></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Última execução por UF</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>UF</TableHead><TableHead>Última execução</TableHead><TableHead>Status</TableHead><TableHead>Hash</TableHead></TableRow></TableHeader>
                <TableBody>
                  {basesQuery.data?.length ? basesQuery.data.map((base) => (
                    <TableRow key={base.uf}>
                      <TableCell>{base.uf}</TableCell>
                      <TableCell>{formatDateTime(base.lastSyncAt)}</TableCell>
                      <TableCell><Badge variant={adminStatusTone(base.status)}>{base.status}</Badge></TableCell>
                      <TableCell className="max-w-40 truncate">{base.currentHash ?? "—"}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum resumo de base disponível.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrity" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Bases sem atualização</CardTitle><CardDescription>UFs que exigem nova sincronização.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {staleBases?.length ? staleBases.map((base) => <div key={base.uf} className="rounded border p-3">{base.uf} · {formatDateTime(base.lastSyncAt)}</div>) : <div className="text-sm text-muted-foreground">Nenhuma UF atrasada no momento.</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Inconsistências detectadas</CardTitle><CardDescription>Falhas recentes, timeouts e jobs travados.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {failedBases?.length ? failedBases.map((base) => <div key={base.uf} className="rounded border p-3">{base.uf} · {base.lastMessage ?? "falha operacional"}</div>) : <div className="text-sm text-muted-foreground">Nenhuma inconsistência crítica.</div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Logs e auditoria</CardTitle><CardDescription>Toda ação importante do admin fica registrada.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Ação</TableHead><TableHead>Recurso</TableHead><TableHead>Status</TableHead><TableHead>Admin</TableHead><TableHead>Quando</TableHead></TableRow></TableHeader>
                <TableBody>
                  {logsQuery.data?.length ? logsQuery.data.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>{log.resource}</TableCell>
                      <TableCell><Badge variant={adminStatusTone(log.resultStatus)}>{log.resultStatus}</Badge></TableCell>
                      <TableCell>{log.adminEmail ?? "—"}</TableCell>
                      <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum log em admin_audit_logs.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Agendamentos administrativos</CardTitle><CardDescription>Defina horário da sincronização diária, UFs ativas e habilite/desabilite jobs.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="schedule">Horário da sincronização diária</Label><Input id="schedule" type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="ufs">UFs ativas</Label><Input id="ufs" value={activeUfs} onChange={(event) => setActiveUfs(event.target.value)} /></div>
              <div className="flex items-center gap-3"><Switch checked={enabled} onCheckedChange={setEnabled} /><span className="text-sm">Habilitar job diário</span></div>
              <div className="flex items-center justify-end"><Button disabled={scheduleMutation.isPending} onClick={() => void scheduleMutation.mutateAsync({ job_type: "daily_sync", enabled, schedule_time: scheduleTime, payload_json: { active_ufs: activeUfs.split(",").map((item) => item.trim()).filter(Boolean) } })}>Salvar agendamento</Button></div>
            </CardContent>
          </Card>
          <Sheet>
            <SheetTrigger asChild><Button variant="outline">Ver últimas execuções e próxima execução estimada</Button></SheetTrigger>
            <SheetContent className="w-[540px] sm:max-w-[540px]">
              <SheetHeader>
                <SheetTitle>Configurações atuais</SheetTitle>
                <SheetDescription>Última execução, próxima execução estimada e payload do scheduler administrativo.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {schedulesQuery.data?.length ? schedulesQuery.data.map((schedule) => (
                  <Card key={schedule.id}>
                    <CardHeader><CardTitle>{schedule.jobType}</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>Habilitado: {String(schedule.enabled)}</div>
                      <div>Horário: {schedule.scheduleTime ?? "—"}</div>
                      <div>Última execução: {formatDateTime(schedule.lastRunAt)}</div>
                      <div>Próxima execução estimada: {formatDateTime(schedule.nextRunEstimate)}</div>
                    </CardContent>
                  </Card>
                )) : <div className="text-sm text-muted-foreground">Nenhum agendamento administrativo cadastrado.</div>}
              </div>
            </SheetContent>
          </Sheet>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOperacao;
