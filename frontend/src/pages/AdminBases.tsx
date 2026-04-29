import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, RefreshCcw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import { AdminPageAlert, AdminRetryAction } from "@/features/admin/AdminQueryState";
import { adminStatusTone, formatDateTime } from "@/features/admin/admin-utils";
import { getAdminBaseDetail, listAdminBases, syncAllAdminBases, triggerAdminBaseAction, type AdminBaseDetail, type AdminBaseRow } from "@/lib/api";

const AdminBases = () => {
  const [query, setQuery] = useState("");
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const basesQuery = useQuery({ queryKey: ["admin-bases"], queryFn: listAdminBases, enabled: isAuthenticated });
  const detailQuery = useQuery({
    queryKey: ["admin-base-detail", selectedUf],
    queryFn: () => getAdminBaseDetail(selectedUf!),
    enabled: isAuthenticated && Boolean(selectedUf),
  });

  const filtered = useMemo(
    () => (basesQuery.data ?? []).filter((item) => item.uf.toLowerCase().includes(query.toLowerCase())),
    [basesQuery.data, query],
  );

  const actionMutation = useMutation({
    mutationFn: async ({ uf, action }: { uf: string; action: "sync" | "reprocess" | "validate" }) => triggerAdminBaseAction(uf, action),
    onSuccess: (job) => {
      toast({ title: "Ação executada", description: `Job ${job.jobType} finalizado com status ${job.status}.` });
      void queryClient.invalidateQueries({ queryKey: ["admin-bases"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      if (selectedUf) void queryClient.invalidateQueries({ queryKey: ["admin-base-detail", selectedUf] });
    },
    onError: () => {
      toast({ title: "Falha na ação manual", description: "O backend não conseguiu concluir a rotina da UF selecionada.", variant: "destructive" });
      void queryClient.invalidateQueries({ queryKey: ["admin-bases"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      if (selectedUf) void queryClient.invalidateQueries({ queryKey: ["admin-base-detail", selectedUf] });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: syncAllAdminBases,
    onSuccess: (job) => {
      toast({ title: "Sincronização global concluída", description: `Job ${job.jobType} com status ${job.status}.` });
      void queryClient.invalidateQueries({ queryKey: ["admin-bases"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: () => {
      toast({ title: "Falha ao sincronizar todas as UFs", description: "A rotina global não retornou sucesso no backend.", variant: "destructive" });
      void queryClient.invalidateQueries({ queryKey: ["admin-bases"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  const renderDetail = (detail?: AdminBaseDetail) => {
    if (!detail) return null;
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Status", detail.item.status],
            ["Última sincronização", formatDateTime(detail.item.lastSyncAt)],
            ["Sites", detail.item.totalSites],
            ["Faixas", detail.item.totalLanes],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle>{value}</CardTitle></CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader><CardTitle>Últimas cargas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {detail.recentRuns.length ? detail.recentRuns.map((run) => (
              <div key={run.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{run.uf}</span>
                  <Badge variant={adminStatusTone(run.status)}>{run.status}</Badge>
                </div>
                <div className="mt-2 text-muted-foreground">{formatDateTime(run.finishedAt)} · hash {run.rawHash || "—"}</div>
                {run.errorMessage && <div className="mt-1 text-xs text-red-600">{run.errorMessage}</div>}
              </div>
            )) : <p className="text-sm text-muted-foreground">Nenhuma execução encontrada para esta UF.</p>}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bases por UF</h1>
          <p className="text-sm text-muted-foreground">Uma linha por UF com ações manuais, estado da base e resumo operacional.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={syncAllMutation.isPending} variant="outline" onClick={() => void syncAllMutation.mutateAsync()}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Sincronizar todas
          </Button>
          <Button variant="secondary" onClick={() => toast({ title: "Validação geral", description: "Use a tela Jobs para executar a validação completa." })}>Validar integridade geral</Button>
          <Button variant="secondary" onClick={() => toast({ title: "Cache temporário", description: "Use a central de jobs para limpar o cache temporário." })}>Limpar cache temporário</Button>
        </div>
      </div>

      {basesQuery.isError ? (
        <AdminPageAlert
          tone="danger"
          title="Falha ao listar as bases"
          description="O endpoint /v1/admin/bases falhou. Verifique dataset_runs, radar_sites, radar_lanes e site_verifications."
          action={<AdminRetryAction onRetry={() => void basesQuery.refetch()} />}
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Status das bases</CardTitle>
            <CardDescription>Total de sites, faixas e verificações já persistidas por UF.</CardDescription>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Filtrar UF" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UF</TableHead>
                <TableHead>Última sincronização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Hash atual</TableHead>
                <TableHead>Sites</TableHead>
                <TableHead>Faixas</TableHead>
                <TableHead>Verificações</TableHead>
                <TableHead>Última mensagem</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length ? filtered.map((item: AdminBaseRow) => (
                <TableRow key={item.uf}>
                  <TableCell className="font-medium">{item.uf}</TableCell>
                  <TableCell>{formatDateTime(item.lastSyncAt)}</TableCell>
                  <TableCell><Badge variant={adminStatusTone(item.status)}>{item.status}</Badge></TableCell>
                  <TableCell className="max-w-32 truncate">{item.currentHash ?? "—"}</TableCell>
                  <TableCell>{item.totalSites}</TableCell>
                  <TableCell>{item.totalLanes}</TableCell>
                  <TableCell>{item.totalVerifications}</TableCell>
                  <TableCell className="max-w-44 truncate">{item.lastMessage ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedUf(item.uf)}><Eye className="h-4 w-4" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline">Ações</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => void actionMutation.mutateAsync({ uf: item.uf, action: "sync" })}>Sincronizar UF</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void actionMutation.mutateAsync({ uf: item.uf, action: "reprocess" })}>Reprocessar UF</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void actionMutation.mutateAsync({ uf: item.uf, action: "validate" })}>Validar UF</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSelectedUf(item.uf)}>Ver logs da UF</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSelectedUf(item.uf)}>Ver resumo da carga</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {basesQuery.isLoading ? "Carregando bases por UF…" : "Nenhuma UF encontrada para os filtros selecionados."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedUf)} onOpenChange={(open) => !open && setSelectedUf(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalhes da base {selectedUf}</DialogTitle>
          </DialogHeader>
          {detailQuery.isError ? (
            <AdminPageAlert
              tone="danger"
              title="Falha ao carregar o detalhe da UF"
              description="O endpoint /v1/admin/bases/{uf} não devolveu o resumo esperado da carga."
              action={<AdminRetryAction onRetry={() => void detailQuery.refetch()} />}
            />
          ) : renderDetail(detailQuery.data)}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBases;
