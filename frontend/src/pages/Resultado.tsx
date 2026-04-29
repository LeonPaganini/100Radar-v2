import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, AlertTriangle, HelpCircle, Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getConsultaDetails, getPdfDownloadUrl } from "@/lib/api";

const STATUS_CONFIG = {
  REGULAR:       { icon: CheckCircle, color: "text-status-regular", bg: "bg-status-regular-bg", label: "Regular — Certificação válida" },
  VENCIDO:       { icon: AlertTriangle, color: "text-status-vencido", bg: "bg-status-vencido-bg", label: "Vencido — Certificação expirada" },
  INDETERMINADO: { icon: HelpCircle, color: "text-status-indeterminado", bg: "bg-status-indeterminado-bg", label: "Indeterminado" },
} as const;

export default function Resultado() {
  const { queryId } = useParams<{ queryId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["consulta", queryId],
    queryFn: () => getConsultaDetails(queryId!),
    enabled: Boolean(queryId),
  });

  const q = data as Record<string, unknown> | undefined;

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center">
      <LoaderCircle className="h-10 w-10 animate-spin text-brand-blue" />
    </div>
  );

  if (isError || !q) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <p className="font-medium">Não foi possível carregar o resultado</p>
      <Button onClick={() => navigate("/verificar")}>Nova consulta</Button>
    </div>
  );

  if (!q.paid) {
    navigate(`/pagamento/${queryId}`, { replace: true });
    return null;
  }

  const rawStatus = String(q.status_na_data ?? "INDETERMINADO") as keyof typeof STATUS_CONFIG;
  const cfg = STATUS_CONFIG[rawStatus] ?? STATUS_CONFIG.INDETERMINADO;
  const Icon = cfg.icon;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="mb-8 text-center">
        <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-600" />
        <h1 className="font-display text-3xl font-bold">Resultado</h1>
        <p className="mt-1 text-muted-foreground">Consulta #{String(q.id ?? "").slice(0, 8).toUpperCase()}</p>
      </div>

      {/* Status destaque */}
      <div className={`mb-6 flex items-center gap-3 rounded-xl border p-5 ${cfg.bg}`}>
        <Icon className={`h-8 w-8 shrink-0 ${cfg.color}`} />
        <div>
          <p className={`font-display text-xl font-bold ${cfg.color}`}>{cfg.label}</p>
          <p className="text-sm text-muted-foreground">na data de {String(q.data_infracao ?? "—")}</p>
        </div>
      </div>

      {/* Detalhes */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Dados da consulta</CardTitle></CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            {[
              ["UF", q.uf],
              ["Nº Inmetro", q.numero_inmetro || "—"],
              ["Nº Série", q.numero_serie || "—"],
              ["Data da Infração", q.data_infracao],
              ["Equipamento localizado", q.site_id ? "Sim" : "Não"],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4">
                <dt className="font-medium text-muted-foreground">{String(k)}</dt>
                <dd className="text-right">{String(v ?? "—")}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Download PDF */}
      <a href={getPdfDownloadUrl(queryId!)} target="_blank" rel="noopener noreferrer" download>
        <Button className="w-full" size="lg">
          <Download className="mr-2 h-5 w-5" />
          Baixar Relatório PDF
        </Button>
      </a>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Este relatório pode ser usado como evidência em defesa de autuação.
      </p>

      <Button variant="ghost" className="mt-4 w-full" onClick={() => navigate("/verificar")}>
        Fazer nova consulta
      </Button>
    </div>
  );
}
