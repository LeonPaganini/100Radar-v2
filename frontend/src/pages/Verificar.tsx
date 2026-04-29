import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createConsultaPrecheck } from "@/lib/api";

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export default function Verificar() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"inmetro" | "serie">("inmetro");
  const [uf, setUf] = useState("");
  const [inmetro, setInmetro] = useState("");
  const [serie, setSerie] = useState("");
  const [dataInfracao, setDataInfracao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!uf) return setError("Selecione a UF.");
    if (!dataInfracao) return setError("Informe a data da infração.");
    if (mode === "inmetro" && !inmetro.trim()) return setError("Informe o número Inmetro.");
    if (mode === "serie" && !serie.trim()) return setError("Informe o número de série.");

    setLoading(true);
    try {
      const res = await createConsultaPrecheck({
        uf,
        numero_inmetro: mode === "inmetro" ? inmetro.trim() : null,
        numero_serie: mode === "serie" ? serie.trim() : null,
        data_infracao: dataInfracao,
        identifier_type: mode,
      });
      navigate(`/analise/${res.query_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="mb-8 text-center">
        <Search className="mx-auto mb-3 h-10 w-10 text-brand-blue" />
        <h1 className="font-display text-3xl font-bold">Consultar Radar</h1>
        <p className="mt-2 text-muted-foreground">Verifique a situação do equipamento na data da infração</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados do equipamento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* UF */}
          <div>
            <Label>UF *</Label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
              <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Modo */}
          <div>
            <Label>Identificar por</Label>
            <div className="mt-1 flex gap-2">
              <Button size="sm" variant={mode === "inmetro" ? "default" : "outline"} onClick={() => setMode("inmetro")}>Nº Inmetro</Button>
              <Button size="sm" variant={mode === "serie" ? "default" : "outline"} onClick={() => setMode("serie")}>Nº Série</Button>
            </div>
          </div>

          {mode === "inmetro" && (
            <div>
              <Label>Número Inmetro *</Label>
              <Input placeholder="Ex: 123456" value={inmetro} onChange={e => setInmetro(e.target.value)} />
            </div>
          )}
          {mode === "serie" && (
            <div>
              <Label>Número de Série *</Label>
              <Input placeholder="Ex: SN-9876" value={serie} onChange={e => setSerie(e.target.value)} />
            </div>
          )}

          {/* Data */}
          <div>
            <Label>Data da Infração *</Label>
            <Input type="date" value={dataInfracao} onChange={e => setDataInfracao(e.target.value)} max={new Date().toISOString().split("T")[0]} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? "Consultando…" : <><span>Consultar</span><ArrowRight className="ml-2 h-4 w-4" /></>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
