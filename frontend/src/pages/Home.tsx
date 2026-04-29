import { useNavigate } from "react-router-dom";
import { Shield, Search, FileText, CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center px-4 py-24 text-center"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
          <Shield className="h-9 w-9 text-white" />
        </div>
        <h1 className="font-display text-4xl font-bold text-white md:text-5xl">
          Radar<span className="text-blue-300">Check</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/80">
          Descubra se o radar que te multou estava com certificação válida na
          data da infração. Resultado oficial baseado em dados do RBMLQ.
        </p>
        <Button
          size="lg"
          className="mt-8 bg-white text-brand-navy hover:bg-white/90"
          onClick={() => navigate("/verificar")}
        >
          <Search className="mr-2 h-5 w-5" />
          Consultar Radar
        </Button>
        <p className="mt-3 text-sm text-white/50">
          Resultado em segundos · Relatório em PDF · R$ 5,00
        </p>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-4xl px-4 py-20">
        <h2 className="mb-12 text-center font-display text-3xl font-bold text-foreground">
          Como funciona
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Search,
              step: "1",
              title: "Consulte",
              desc: "Informe o número Inmetro ou de série do equipamento e a data da infração.",
            },
            {
              icon: Shield,
              step: "2",
              title: "Analise",
              desc: "Verificamos nos dados oficiais do RBMLQ se o equipamento estava regular.",
            },
            {
              icon: FileText,
              step: "3",
              title: "Relatório",
              desc: "Pague via PIX e baixe o relatório PDF para usar na sua defesa.",
            },
          ].map(({ icon: Icon, step, title, desc }) => (
            <Card key={step} className="text-center">
              <CardContent className="pt-8 pb-6">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue/10">
                  <Icon className="h-6 w-6 text-brand-blue" />
                </div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Passo {step}
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Resultados possíveis */}
      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="mb-8 text-center font-display text-2xl font-bold">
            O que o resultado significa
          </h2>
          <div className="space-y-4">
            {[
              {
                icon: CheckCircle,
                color: "text-status-regular",
                bg: "bg-status-regular-bg",
                label: "Regular",
                desc: "O equipamento estava com certificação válida na data da infração.",
              },
              {
                icon: AlertTriangle,
                color: "text-status-vencido",
                bg: "bg-status-vencido-bg",
                label: "Vencido",
                desc: "A certificação do equipamento estava vencida. Forte argumento para defesa.",
              },
              {
                icon: HelpCircle,
                color: "text-status-indeterminado",
                bg: "bg-status-indeterminado-bg",
                label: "Indeterminado",
                desc: "Não encontramos dados suficientes para determinar a situação com certeza.",
              },
            ].map(({ icon: Icon, color, bg, label, desc }) => (
              <div key={label} className={`flex items-start gap-4 rounded-xl p-4 ${bg}`}>
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
                <div>
                  <span className={`font-semibold ${color}`}>{label}</span>
                  <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 text-center">
        <h2 className="font-display text-2xl font-bold">Pronto para consultar?</h2>
        <p className="mt-2 text-muted-foreground">
          Resultado imediato. Pague apenas se quiser o PDF.
        </p>
        <Button
          size="lg"
          className="mt-6"
          onClick={() => navigate("/verificar")}
        >
          Consultar agora
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} RadarCheck · Dados: RBMLQ · Não somos advogados.</p>
      </footer>
    </div>
  );
}
