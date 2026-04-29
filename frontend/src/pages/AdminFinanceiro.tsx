import { useMemo, useState, type ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, DollarSign, Download, Filter, RefreshCcw, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import { AdminPageAlert, AdminRetryAction } from "@/features/admin/AdminQueryState";
import { adminStatusTone, formatCurrencyBRL, formatDateTime, formatPercentage } from "@/features/admin/admin-utils";
import {
  getAdminFinanceByUf,
  getAdminFinanceCharts,
  getAdminFinanceConversion,
  getAdminFinancePayments,
  getAdminFinanceSummary,
  type FinanceByUfRow,
  type FinancePaymentRow,
  type FinancePreset,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0f766e"];

const defaultDateRange = () => ({
  startDate: format(addDays(new Date(), -6), "yyyy-MM-dd"),
  endDate: format(new Date(), "yyyy-MM-dd"),
});

const PRESET_LABELS: Record<FinancePreset, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  month: "Mês atual",
  custom: "Customizado",
};

const PROVIDERS = ["all", "mercadopago"];
const STATUSES = ["all", "APPROVED", "PENDING", "CREATED", "EXPIRED", "FAILED", "REJECTED", "CANCELLED"];
const UFS = ["all", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

const paymentStatusBadge = (status: string) => {
  if (status === "APPROVED") return "default";
  if (["PENDING", "CREATED"].includes(status)) return "secondary";
  if (status === "EXPIRED") return "outline";
  return "destructive";
};

const DatePopoverField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
}) => (
  <div className="space-y-2">
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span>{value ? format(parseISO(value), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}</span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value ? parseISO(value) : undefined}
          onSelect={(selected) => {
            if (selected) onChange(format(selected, "yyyy-MM-dd"));
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  </div>
);

const FinanceTable = ({
  title,
  description,
  columns,
  children,
}: {
  title: string;
  description: string;
  columns: string[];
  children: ReactNode;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
);

const renderPaymentRows = (rows: FinancePaymentRow[]) => {
  if (!rows.length) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="text-center text-muted-foreground">
          Nenhum registro encontrado para os filtros selecionados.
        </TableCell>
      </TableRow>
    );
  }

  return rows.map((row) => (
    <TableRow key={row.id}>
      <TableCell>{formatDateTime(row.createdAt)}</TableCell>
      <TableCell className="font-mono text-xs">{row.queryId.slice(0, 8)}…</TableCell>
      <TableCell>{row.provider}</TableCell>
      <TableCell className="font-mono text-xs">{row.providerPaymentId ?? "—"}</TableCell>
      <TableCell>{formatCurrencyBRL(row.amountBrl)}</TableCell>
      <TableCell><Badge variant={paymentStatusBadge(row.status)}>{row.status}</Badge></TableCell>
      <TableCell>{formatDateTime(row.paidAt)}</TableCell>
    </TableRow>
  ));
};

const AdminFinanceiro = () => {
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const [draftFilters, setDraftFilters] = useState({
    preset: "7d" as FinancePreset,
    ...defaultDateRange(),
    uf: "all",
    provider: "all",
    status: "all",
  });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);

  const canAccessFinance = admin?.role === "finance" || admin?.role === "super_admin";

  const requestFilters = useMemo(
    () => ({
      preset: appliedFilters.preset,
      startDate: appliedFilters.preset === "custom" ? appliedFilters.startDate : undefined,
      endDate: appliedFilters.preset === "custom" ? appliedFilters.endDate : undefined,
      uf: appliedFilters.uf !== "all" ? appliedFilters.uf : undefined,
      provider: appliedFilters.provider !== "all" ? appliedFilters.provider : undefined,
      status: appliedFilters.status !== "all" ? appliedFilters.status : undefined,
    }),
    [appliedFilters],
  );

  const [summaryQuery, chartsQuery, conversionQuery, paymentsQuery, byUfQuery] = useQueries({
    queries: [
      { queryKey: ["admin-finance-summary", requestFilters], queryFn: () => getAdminFinanceSummary(requestFilters), enabled: canAccessFinance },
      { queryKey: ["admin-finance-charts", requestFilters], queryFn: () => getAdminFinanceCharts(requestFilters), enabled: canAccessFinance },
      { queryKey: ["admin-finance-conversion", requestFilters], queryFn: () => getAdminFinanceConversion(requestFilters), enabled: canAccessFinance },
      { queryKey: ["admin-finance-payments", requestFilters], queryFn: () => getAdminFinancePayments(requestFilters), enabled: canAccessFinance },
      { queryKey: ["admin-finance-by-uf", requestFilters], queryFn: () => getAdminFinanceByUf(requestFilters), enabled: canAccessFinance },
    ],
  });

  const financeQueries = [summaryQuery, chartsQuery, conversionQuery, paymentsQuery, byUfQuery];
  const isLoading = financeQueries.some((query) => query.isLoading);
  const isFetching = financeQueries.some((query) => query.isFetching);
  const hasQueryError = financeQueries.some((query) => query.isError);

  if (!canAccessFinance) {
    return (
      <Card className="border-amber-200 bg-amber-50/70">
        <CardHeader>
          <CardTitle>Acesso financeiro restrito</CardTitle>
          <CardDescription>
            Esta área está disponível apenas para perfis <strong>finance</strong> ou <strong>super_admin</strong>.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const summaryCards = summaryQuery.data?.cards ?? [];
  const topUfRows = (paymentsQuery.data?.topUfsByRevenue ?? byUfQuery.data?.items ?? []) as FinanceByUfRow[];
  const businessRules = summaryQuery.data?.businessRules ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Financeiro Admin</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Painel financeiro</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Acompanhe faturamento, pagamentos, conversão, relatórios emitidos e monetização do produto a partir das tabelas de consultas, pagamentos e auditoria de PDFs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Wallet className="h-4 w-4" />
                Regras de cálculo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Regras financeiras adotadas</DialogTitle>
                <DialogDescription>
                  Definições usadas para compor cards, gráficos e relatórios do painel.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {Object.entries(businessRules).map(([key, value]) => (
                  <div key={key} className="rounded-xl border p-3">
                    <div className="font-medium capitalize">{key.replaceAll("_", " ")}</div>
                    <div className="mt-1 text-muted-foreground">{value}</div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              const reset = { preset: "7d" as FinancePreset, ...defaultDateRange(), uf: "all", provider: "all", status: "all" };
              setDraftFilters(reset);
              setAppliedFilters(reset);
              toast({ title: "Filtros resetados", description: "Painel voltou para os últimos 7 dias." });
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            Resetar filtros
          </Button>
        </div>
      </div>

      {hasQueryError ? (
        <AdminPageAlert
          tone="danger"
          title="Falha ao consolidar os dados financeiros"
          description="Pelo menos um dos endpoints financeiros retornou erro. Revise queries, payments, audit_logs e o contrato JSON do backend."
          action={<AdminRetryAction onRetry={() => financeQueries.forEach((query) => { void query.refetch(); })} />}
        />
      ) : null}

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" /> Filtros operacionais</CardTitle>
          <CardDescription>
            Filtre por período, UF, provider e status. O período customizado usa datas UTC do backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Período</div>
              <Select
                value={draftFilters.preset}
                onValueChange={(value: FinancePreset) => {
                  const next = value === "today"
                    ? { startDate: format(new Date(), "yyyy-MM-dd"), endDate: format(new Date(), "yyyy-MM-dd") }
                    : value === "7d"
                      ? defaultDateRange()
                      : value === "30d"
                        ? { startDate: format(addDays(new Date(), -29), "yyyy-MM-dd"), endDate: format(new Date(), "yyyy-MM-dd") }
                        : value === "month"
                          ? { startDate: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"), endDate: format(new Date(), "yyyy-MM-dd") }
                          : { startDate: draftFilters.startDate, endDate: draftFilters.endDate };
                  setDraftFilters((current) => ({ ...current, preset: value, ...next }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRESET_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DatePopoverField label="Início" value={draftFilters.startDate} onChange={(value) => setDraftFilters((current) => ({ ...current, preset: "custom", startDate: value }))} />
            <DatePopoverField label="Fim" value={draftFilters.endDate} onChange={(value) => setDraftFilters((current) => ({ ...current, preset: "custom", endDate: value }))} />

            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">UF</div>
              <Select value={draftFilters.uf} onValueChange={(value) => setDraftFilters((current) => ({ ...current, uf: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf === "all" ? "Todas as UFs" : uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Provider</div>
              <Select value={draftFilters.provider} onValueChange={(value) => setDraftFilters((current) => ({ ...current, provider: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((provider) => <SelectItem key={provider} value={provider}>{provider === "all" ? "Todos os providers" : provider}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</div>
              <Select value={draftFilters.status} onValueChange={(value) => setDraftFilters((current) => ({ ...current, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => <SelectItem key={status} value={status}>{status === "all" ? "Todos os status" : status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <Button
                className="gap-2"
                onClick={() => {
                  setAppliedFilters(draftFilters);
                  toast({
                    title: "Filtros aplicados",
                    description: `Período ${PRESET_LABELS[draftFilters.preset]}${draftFilters.uf !== "all" ? ` • UF ${draftFilters.uf}` : ""}`,
                  });
                }}
              >
                <DollarSign className="h-4 w-4" />
                Aplicar filtros
              </Button>
              <div className="text-xs text-muted-foreground">
                Visualizando {PRESET_LABELS[appliedFilters.preset]} • {appliedFilters.startDate} → {appliedFilters.endDate}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {(summaryCards.length ? summaryCards : Array.from({ length: 10 })).map((card, index) => (
          <Card key={card?.key ?? index} className={cn("transition-opacity", isFetching && "opacity-80")}>
            <CardHeader className="pb-3">
              <CardDescription>{card?.label ?? "Carregando"}</CardDescription>
              <CardTitle className="text-2xl">{isLoading ? "…" : card?.formattedValue ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{card?.helper ?? "Calculando indicadores financeiros."}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="resumo" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 md:w-fit">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="conversao">Conversão</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Receita por dia</CardTitle>
                <CardDescription>Evolução da receita aprovada dentro do período selecionado.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  className="h-[300px] w-full"
                  config={{ revenue: { label: "Receita", color: "#2563eb" } }}
                >
                  <LineChart data={chartsQuery.data?.receitaPorDia ?? []}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => `R$${value}`} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => <span>{formatCurrencyBRL(Number(value))}</span>} />} />
                    <Line type="monotone" dataKey="revenueBrl" stroke="var(--color-revenue)" strokeWidth={3} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pagamentos por status</CardTitle>
                <CardDescription>Distribuição operacional por status recebido do fluxo financeiro.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  className="h-[300px] w-full"
                  config={{
                    value: { label: "Quantidade", color: "#16a34a" },
                  }}
                >
                  <BarChart data={chartsQuery.data?.pagamentosPorStatus ?? []}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pagamentos por provider</CardTitle>
                <CardDescription>Volume de pagamentos por provedor usado no período filtrado.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  className="h-[300px] w-full"
                  config={{ value: { label: "Pagamentos", color: "#0f766e" } }}
                >
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                    <Pie data={chartsQuery.data?.pagamentosPorProvider ?? []} dataKey="value" nameKey="label" innerRadius={70} outerRadius={110}>
                      {(chartsQuery.data?.pagamentosPorProvider ?? []).map((entry, index) => (
                        <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="label" />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Receita por UF</CardTitle>
                <CardDescription>Receita monetizada derivada da UF da consulta associada.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer className="h-[300px] w-full" config={{ revenue: { label: "Receita", color: "#7c3aed" } }}>
                  <BarChart data={chartsQuery.data?.receitaPorUf ?? []} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                    <YAxis type="category" dataKey="uf" tickLine={false} axisLine={false} width={36} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => <span>{formatCurrencyBRL(Number(value))}</span>} />} />
                    <Bar dataKey="revenueBrl" fill="var(--color-revenue)" radius={8} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <FinanceTable
              title="Últimos pagamentos"
              description="Visão rápida das últimas transações registradas."
              columns={["Data", "Query ID", "Provider", "Provider Payment ID", "Valor", "Status", "Paid at"]}
            >
              {renderPaymentRows(paymentsQuery.data?.latestPayments ?? [])}
            </FinanceTable>

            <FinanceTable
              title="Pagamentos pendentes"
              description="Cobranças em aberto para acompanhamento operacional."
              columns={["Data", "Query ID", "Provider", "Provider Payment ID", "Valor", "Status", "Paid at"]}
            >
              {renderPaymentRows(paymentsQuery.data?.pendingPayments ?? [])}
            </FinanceTable>
          </div>

          <FinanceTable
            title="Falhas de pagamento"
            description="Pagamentos expirados, rejeitados, cancelados ou falhados."
            columns={["Data", "Query ID", "Provider", "Provider Payment ID", "Valor", "Status", "Paid at"]}
          >
            {renderPaymentRows(paymentsQuery.data?.failedPayments ?? [])}
          </FinanceTable>
        </TabsContent>

        <TabsContent value="conversao" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Consultas iniciadas", value: conversionQuery.data?.startedQueries, helper: "Base da conversão" },
              { label: "Consultas monetizadas", value: conversionQuery.data?.monetizedQueries, helper: "Queries distintas com pagamento aprovado" },
              { label: "Conversão", value: formatPercentage(conversionQuery.data?.conversionRate), helper: "Consultas monetizadas / iniciadas" },
              { label: "Ticket médio", value: formatCurrencyBRL(conversionQuery.data?.averageTicketBrl), helper: "Receita aprovada / pagamentos aprovados" },
            ].map((item) => (
              <Card key={item.label}>
                <CardHeader className="pb-3">
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle>{item.value ?? "—"}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">{item.helper}</p></CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Conversão por dia</CardTitle>
                <CardDescription>Relação diária entre consultas iniciadas e monetizadas.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  className="h-[300px] w-full"
                  config={{
                    started: { label: "Iniciadas", color: "#2563eb" },
                    monetized: { label: "Monetizadas", color: "#16a34a" },
                  }}
                >
                  <LineChart data={chartsQuery.data?.conversaoPorDia ?? []}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="startedQueries" stroke="var(--color-started)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="monetizedQueries" stroke="var(--color-monetized)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Consultas vs pagamentos</CardTitle>
                <CardDescription>Volume operacional diário de consultas iniciadas e pagamentos aprovados.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  className="h-[300px] w-full"
                  config={{
                    started: { label: "Consultas", color: "#2563eb" },
                    approved: { label: "Pagamentos", color: "#f59e0b" },
                  }}
                >
                  <BarChart data={chartsQuery.data?.consultasVsPagamentos ?? []}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="startedQueries" fill="var(--color-started)" radius={6} />
                    <Bar dataKey="approvedPayments" fill="var(--color-approved)" radius={6} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios emitidos por dia</CardTitle>
                <CardDescription>Auditoria dos PDFs gerados para consultas desbloqueadas.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer className="h-[300px] w-full" config={{ reports: { label: "Relatórios", color: "#dc2626" } }}>
                  <BarChart data={chartsQuery.data?.relatoriosPorDia ?? []}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="reportsGenerated" fill="var(--color-reports)" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <FinanceTable
              title="Consultas monetizadas"
              description="Consultas que tiveram pagamento aprovado dentro do período."
              columns={["Criada em", "Query ID", "UF", "Identificador", "Valor", "Provider", "Status", "Pago em"]}
            >
              {(paymentsQuery.data?.monetizedQueries ?? []).length ? paymentsQuery.data!.monetizedQueries.map((item) => (
                <TableRow key={`${item.queryId}-${item.paidAt}`}>
                  <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{item.queryId.slice(0, 8)}…</TableCell>
                  <TableCell>{item.uf}</TableCell>
                  <TableCell>{item.identifier}</TableCell>
                  <TableCell>{formatCurrencyBRL(item.amountBrl)}</TableCell>
                  <TableCell>{item.provider}</TableCell>
                  <TableCell><Badge variant={paymentStatusBadge(item.status)}>{item.status}</Badge></TableCell>
                  <TableCell>{formatDateTime(item.paidAt)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma consulta monetizada encontrada.</TableCell>
                </TableRow>
              )}
            </FinanceTable>
          </div>

          <FinanceTable
            title="Top UFs por receita"
            description="Ranking operacional por receita aprovada."
            columns={["UF", "Receita", "Pagamentos aprovados", "Consultas monetizadas", "Ticket médio"]}
          >
            {topUfRows.length ? topUfRows.map((item) => (
              <TableRow key={item.uf}>
                <TableCell className="font-medium">{item.uf}</TableCell>
                <TableCell>{formatCurrencyBRL(item.revenueBrl)}</TableCell>
                <TableCell>{item.approvedPayments}</TableCell>
                <TableCell>{item.monetizedQueries}</TableCell>
                <TableCell>{formatCurrencyBRL(item.averageTicketBrl)}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma UF com receita no período.</TableCell>
              </TableRow>
            )}
          </FinanceTable>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> Observações operacionais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div>Preset aplicado: <strong>{PRESET_LABELS[appliedFilters.preset]}</strong>.</div>
          <div>Filtros ativos: <strong>{appliedFilters.uf === "all" ? "Todas as UFs" : appliedFilters.uf}</strong> / <strong>{appliedFilters.provider === "all" ? "Todos os providers" : appliedFilters.provider}</strong>.</div>
          <div>Estados do dashboard: <Badge variant={adminStatusTone(isFetching ? "running" : "success")}>{isFetching ? "Atualizando" : "Sincronizado"}</Badge></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFinanceiro;
