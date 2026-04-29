import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy, LoaderCircle, QrCode, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getConsultaDetails, createOrGetPixPayment, getPaymentStatus, type PixResponse } from "@/lib/api";

const POLL_INTERVAL = 4000;
const MAX_POLLS = 60;

export default function Pagamento() {
  const { queryId } = useParams<{ queryId: string }>();
  const navigate = useNavigate();
  const [pix, setPix] = useState<PixResponse | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: query, isLoading: queryLoading } = useQuery({
    queryKey: ["consulta", queryId],
    queryFn: () => getConsultaDetails(queryId!),
    enabled: Boolean(queryId),
  });

  // Redireciona se já pago
  useEffect(() => {
    if ((query as Record<string, unknown>)?.paid) navigate(`/resultado/${queryId}`, { replace: true });
  }, [query, queryId, navigate]);

  // Polling de status
  const startPolling = useCallback((paymentId: string) => {
    pollRef.current = setInterval(async () => {
      setPollCount(c => {
        if (c >= MAX_POLLS) { clearInterval(pollRef.current!); return c; }
        return c + 1;
      });
      try {
        const status = await getPaymentStatus(queryId!, paymentId);
        setPix(status);
        if (status.paid) {
          clearInterval(pollRef.current!);
          navigate(`/resultado/${queryId}`, { replace: true });
        }
      } catch { /* ignora erros de polling */ }
    }, POLL_INTERVAL);
  }, [queryId, navigate]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleGerarPix = async () => {
    setPixLoading(true);
    try {
      const res = await createOrGetPixPayment(queryId!);
      setPix(res);
      if (res.paid) { navigate(`/resultado/${queryId}`, { replace: true }); return; }
      if (res.payment_id) startPolling(res.payment_id);
    } catch { /* handled by UI */ }
    finally { setPixLoading(false); }
  };

  const handleCopy = () => {
    if (pix?.pix_copy_paste) {
      navigator.clipboard.writeText(pix.pix_copy_paste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const q = query as Record<string, unknown> | undefined;

  if (queryLoading) return (
    <div className="flex min-h-screen items-center justify-center">
      <LoaderCircle className="h-10 w-10 animate-spin text-brand-blue" />
    </div>
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="mb-8 text-center">
        <QrCode className="mx-auto mb-3 h-10 w-10 text-brand-blue" />
        <h1 className="font-display text-3xl font-bold">Pagamento via PIX</h1>
        <p className="mt-2 text-muted-foreground">
          Desbloqueie o resultado completo por <strong>R$ {((q?.amount_brl_centavos as number ?? 500) / 100).toFixed(2)}</strong>
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Resultado rápido (situação) */}
          {q && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-center">
              Situação preliminar: <strong>{String(q.status_na_data ?? "INDETERMINADO")}</strong>
              <br /><span className="text-muted-foreground">Pague para ver o relatório completo</span>
            </div>
          )}

          {!pix && (
            <Button className="w-full" onClick={handleGerarPix} disabled={pixLoading}>
              {pixLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pixLoading ? "Gerando PIX…" : "Gerar código PIX"}
            </Button>
          )}

          {pix && pix.status !== "APPROVED" && (
            <div className="space-y-4">
              {pix.qr_code_base64 && (
                <div className="flex justify-center">
                  <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code PIX" className="h-48 w-48 rounded-lg border" />
                </div>
              )}
              {pix.pix_copy_paste && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Copia e cola</p>
                  <div className="flex gap-2">
                    <code className="flex-1 truncate rounded bg-muted px-3 py-2 text-xs">{pix.pix_copy_paste}</code>
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                      {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <LoaderCircle className="h-4 w-4 animate-spin shrink-0" />
                Aguardando confirmação do pagamento… ({pollCount}/{MAX_POLLS})
              </div>
              {pollCount >= MAX_POLLS && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Tempo de espera excedido. <Button variant="link" className="h-auto p-0 text-red-800" onClick={() => { setPollCount(0); if (pix.payment_id) startPolling(pix.payment_id); }}>Verificar novamente</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
