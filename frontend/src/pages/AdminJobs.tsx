import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { AdminPageAlert, AdminRetryAction } from "@/features/admin/AdminQueryState";
import { adminStatusTone, formatDateTime, formatDuration } from "@/features/admin/admin-utils";
import { ApiError, listAdminJobs, triggerAdminJob } from "@/lib/api";

const AdminJobs = () => {
  const [reprocessUf, setReprocessUf] = useState("MG");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const jobsQuery = useQuery({ queryKey: ["admin-jobs"], queryFn: listAdminJobs });
  const mutation = useMutation({
    mutationFn: ({ path, payload }: { path: string; payload?: Record<string, unknown> }) => triggerAdminJob(path, payload),
    onSuccess: (job) => {
      const title = job.resultStatus === "warning"
        ? "Job concluído com alerta"
        : job.resultStatus === "failed"
          ? "Job falhou"
          : "Job concluído";
      const description = job.resultStatus === "warning"
        ? `Job ${job.jobType} foi registrado como placeholder (sem executor material).`
        : job.resultStatus === "failed"
          ? (job.errorMessage || `Job ${job.jobType} retornou falha. Verifique o detalhe na tabela de jobs.`)
          : `Job ${job.jobType} finalizado com status ${job.status}.`;
      toast({ title, description });
      void queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-bases"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-health"] });
    },
    onError: (error) => {
      const description = error instanceof ApiError
        ? `${error.message} (code: ${error.code}, status: ${error.status})`
        : "O backend não confirmou a execução manual solicitada.";
      toast({ title: "Falha ao executar job", description, variant: "destructive" });
      void queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-bases"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-health"] });
    },
  });

  const run = (path: string, payload?: Record<string, unknown>) => void mutation.mutateAsync({ path, payload });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Central de jobs</h1>
        <p className="text-sm text-muted-foreground">Execução manual de sincronizações, reprocessamentos e rotinas administrativas.</p>
      </div>

      {jobsQuery.isError ? (
        <AdminPageAlert
          tone="danger"
          title="Falha ao carregar os jobs"
          description="A listagem de /v1/admin/jobs falhou. Valide admin_jobs, admin_users e o contrato do endpoint."
          action={<AdminRetryAction onRetry={() => void jobsQuery.refetch()} />}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ações manuais</CardTitle>
          <CardDescription>Dispare os jobs operacionais diretamente pela interface protegida.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button disabled={mutation.isPending} onClick={() => run("/v1/admin/jobs/sync", { uf: "RJ" })}>Sincronizar RJ</Button>
          <Button disabled={mutation.isPending} onClick={() => run("/v1/admin/jobs/sync", { uf: "SP" })}>Sincronizar SP</Button>
          <Button disabled={mutation.isPending} variant="outline" onClick={() => run("/v1/admin/jobs/sync", {})}>Sincronizar todas</Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button disabled={mutation.isPending} variant="secondary">Reprocessar uma UF</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Reprocessar UF</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="uf-reprocess">UF</Label>
                  <Input id="uf-reprocess" value={reprocessUf} onChange={(event) => setReprocessUf(event.target.value.toUpperCase())} maxLength={2} />
                </div>
                <Button disabled={mutation.isPending || reprocessUf.trim().length !== 2} onClick={() => run("/v1/admin/jobs/reprocess", { uf: reprocessUf })}>Executar reprocessamento</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button disabled={mutation.isPending} variant="secondary" onClick={() => run("/v1/admin/jobs/clear-cache")}>Limpar cache temporário</Button>
          <Button disabled={mutation.isPending} variant="secondary" onClick={() => run("/v1/admin/jobs/recalculate-statistics")}>Recalcular estatísticas</Button>
          <Button disabled={mutation.isPending} variant="secondary" onClick={() => run("/v1/admin/jobs/validate", {})}>Rodar validação geral</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jobs registrados</CardTitle>
          <CardDescription>Inclui tipo, UF, status, duração, erro e admin executor.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Execução</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Iniciado em</TableHead>
                <TableHead>Finalizado em</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead>Usuário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobsQuery.data?.length ? jobsQuery.data.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="max-w-28 truncate">{job.id}</TableCell>
                  <TableCell>{job.jobType}</TableCell>
                  <TableCell>
                    <Badge variant={job.executionMode === "placeholder" ? "secondary" : "outline"}>
                      {job.executionMode}
                    </Badge>
                  </TableCell>
                  <TableCell>{job.uf ?? "—"}</TableCell>
                  <TableCell><Badge variant={adminStatusTone(job.resultStatus)}>{job.resultStatus}</Badge></TableCell>
                  <TableCell>{formatDateTime(job.startedAt)}</TableCell>
                  <TableCell>{formatDateTime(job.finishedAt)}</TableCell>
                  <TableCell>{formatDuration(job.durationSeconds)}</TableCell>
                  <TableCell className="max-w-48 truncate">{job.errorMessage ?? "—"}</TableCell>
                  <TableCell>{job.createdByAdminEmail ?? "—"}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    {jobsQuery.isLoading ? "Carregando histórico de jobs…" : "Nenhum job administrativo foi registrado em admin_jobs."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminJobs;
