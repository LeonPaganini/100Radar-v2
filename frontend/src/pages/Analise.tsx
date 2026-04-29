import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getConsultaDetails } from "@/lib/api";

export default function Analise() {
  const { queryId } = useParams<{ queryId: string }>();
  const navigate = useNavigate();

  const { data, isError, isLoading } = useQuery({
    queryKey: ["consulta", queryId],
    queryFn: () => getConsultaDetails(queryId!),
    enabled: Boolean(queryId),
    retry: 2,
  });

  // Redireciona para pagamento assim que a consulta carrega
  useEffect(() => {
    if (data && queryId) {
      navigate(`/pagamento/${queryId}`, { replace: true });
    }
  }, [data, queryId, navigate]);

  if (isLoading) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <LoaderCircle className="h-12 w-12 animate-spin text-brand-blue" />
      <p className="text-lg font-medium">Analisando o equipamento…</p>
      <p className="text-sm text-muted-foreground">Consultando base de dados oficial do RBMLQ</p>
    </div>
  );

  if (isError) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <p className="text-lg font-medium">Não foi possível carregar a análise</p>
      <p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
      <Button onClick={() => navigate("/verificar")}>Fazer nova consulta</Button>
    </div>
  );

  return null;
}
