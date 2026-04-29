const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.DEV ? "http://localhost:8000" : "");

if (!BASE_URL) {
  throw new Error("[100Radar] VITE_API_BASE_URL é obrigatório.");
}

// ── Error class ──────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Core request ─────────────────────────────────────────
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      body?.error?.message ?? body?.detail ?? `Erro HTTP ${res.status}`;
    const code = body?.error?.code;
    throw new ApiError(msg, res.status, code);
  }
  return res.json() as Promise<T>;
}

// ── Admin auth header (Supabase JWT) ─────────────────────
async function adminHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import("./supabase");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new ApiError("Sessão expirada. Faça login novamente.", 401, "session_expired");
  }
  return { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
}

const adminReq = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = await adminHeaders();
  return request<T>(path, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
};

// ═══════════════════════════════════════════════════════════
// CONSULTA
// ═══════════════════════════════════════════════════════════
export interface PrecheckPayload {
  uf: string;
  numero_inmetro?: string | null;
  numero_serie?: string | null;
  data_infracao: string;
  identifier_type?: string;
  municipio?: string | null;
  local_text?: string | null;
}

export interface PrecheckResponse {
  query_id: string;
  status: "REGULAR" | "VENCIDO" | "INDETERMINADO";
  found: boolean;
  amount_brl: number;
}

export const createConsultaPrecheck = (payload: PrecheckPayload) =>
  request<PrecheckResponse>("/v1/consulta/precheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const getConsultaDetails = (queryId: string) =>
  request<Record<string, unknown>>(`/v1/consulta/${queryId}`);

export const getPdfDownloadUrl = (queryId: string): string =>
  `${BASE_URL}/v1/consulta/${queryId}/pdf`;

export const getFontesAtualizacoes = () =>
  request<{ fontes: unknown[] }>("/v1/consulta/fontes/atualizacoes");

// ═══════════════════════════════════════════════════════════
// PAGAMENTO PIX
// ═══════════════════════════════════════════════════════════
export interface PixResponse {
  query_id: string;
  payment_id: string;
  provider_payment_id: string | null;
  status: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  pix_copy_paste: string | null;
  ticket_url: string | null;
  amount_brl: number;
  paid: boolean;
  provider: string;
}

export const createOrGetPixPayment = (queryId: string) =>
  request<PixResponse>("/v1/pagamento/mercadopago/pix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query_id: queryId }),
  });

export const getPaymentStatus = (queryId: string, paymentId?: string): Promise<PixResponse> => {
  const params = new URLSearchParams({ query_id: queryId });
  if (paymentId) params.set("payment_id", paymentId);
  return request<PixResponse>(`/v1/pagamento/mercadopago/status?${params}`);
};

// ═══════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════
export interface AdminUser {
  id: string;
  email: string;
  role: string;
  full_name: string;
}

export const getCurrentAdmin = () =>
  adminReq<{ user: AdminUser }>("/v1/admin/me");

type AdminApiRecord = Record<string, any>;

const asArray = <T>(value: T[] | { [key: string]: T[] } | null | undefined, key: string): T[] => {
  if (Array.isArray(value)) return value;
  const maybeRows = value?.[key];
  return Array.isArray(maybeRows) ? maybeRows : [];
};

const toNumber = (value: any): number => Number(value ?? 0);
const toAmountBrl = (value: any): number => Number(value ?? 0) / (Number(value ?? 0) > 1000 ? 100 : 1);

const mapBaseRow = (row: AdminApiRecord): AdminBaseRow => ({
  ...row,
  uf: String(row.uf ?? ""),
  status: row.status ?? "never_synced",
  lastSyncAt: row.lastSyncAt ?? row.last_synced_at ?? row.updated_at ?? null,
  currentHash: row.currentHash ?? row.last_hash ?? null,
  totalSites: toNumber(row.totalSites ?? row.record_count),
  totalLanes: toNumber(row.totalLanes),
  totalVerifications: toNumber(row.totalVerifications),
  lastMessage: row.lastMessage ?? row.error_message ?? null,
});

const mapJobRow = (row: AdminApiRecord): AdminJobRow => ({
  ...row,
  id: String(row.id ?? crypto.randomUUID()),
  uf: row.uf ?? null,
  jobType: row.jobType ?? row.job_type ?? row.triggered_by ?? "sync",
  executionMode: row.executionMode ?? row.execution_mode ?? "manual",
  status: row.status ?? "pending",
  resultStatus: row.resultStatus ?? row.result_status ?? row.status ?? "pending",
  startedAt: row.startedAt ?? row.started_at ?? row.created_at ?? null,
  finishedAt: row.finishedAt ?? row.finished_at ?? null,
  durationSeconds: toNumber(row.durationSeconds ?? row.duration_seconds),
  errorMessage: row.errorMessage ?? row.error_message ?? null,
  createdByAdminEmail: row.createdByAdminEmail ?? row.created_by_admin_email ?? null,
});

const mapPaymentRow = (row: AdminApiRecord): FinancePaymentRow => ({
  ...row,
  id: String(row.id ?? crypto.randomUUID()),
  queryId: String(row.queryId ?? row.query_id ?? ""),
  provider: String(row.provider ?? ""),
  providerPaymentId: row.providerPaymentId ?? row.provider_payment_id ?? null,
  amountBrl: toAmountBrl(row.amountBrl ?? row.amount_brl ?? row.amount_brl_centavos),
  status: String(row.status ?? ""),
  createdAt: row.createdAt ?? row.created_at ?? null,
  paidAt: row.paidAt ?? row.paid_at ?? null,
});

// Bases
export const getAdminBases = async (): Promise<AdminBaseRow[]> => {
  const data = await adminReq<AdminBaseRow[] | { bases: AdminApiRecord[] }>("/v1/admin/bases");
  return asArray<AdminApiRecord>(data, "bases").map(mapBaseRow);
};

export const syncAdminBase = (uf: string) =>
  adminReq<AdminApiRecord>(`/v1/admin/bases/${uf}/sync`, { method: "POST" });

// Jobs
export const getAdminJobs = async (): Promise<AdminJobRow[]> => {
  const data = await adminReq<AdminJobRow[] | { jobs: AdminApiRecord[] }>("/v1/admin/jobs");
  return asArray<AdminApiRecord>(data, "jobs").map(mapJobRow);
};

export const triggerAdminSync = (uf: string) =>
  adminReq<AdminJobRow>("/v1/admin/jobs/sync", {
    method: "POST",
    body: JSON.stringify({ uf }),
  });

// Dashboard
export const getAdminDashboardOverview = async (): Promise<AdminDashboardOverview> => {
  const data = await adminReq<AdminApiRecord>("/v1/admin/dashboard/overview");
  const latestRuns = asArray<AdminApiRecord>(data.latestRuns ?? data.latest_runs ?? data.recent_jobs, "items").map(mapJobRow);
  const latestFailures = latestRuns.filter((run) => ["failed", "error"].includes(String(run.status).toLowerCase()));
  return {
    ...data,
    metrics: data.metrics ?? [
      { label: "Consultas", value: data.total_queries ?? 0, tone: "default", helper: "Total de consultas registradas." },
      { label: "Consultas pagas", value: data.paid_queries ?? 0, tone: "success", helper: "Consultas desbloqueadas." },
      { label: "Receita", value: `R$ ${Number(data.revenue_brl ?? 0).toFixed(2)}`, tone: "success", helper: "Pagamentos aprovados." },
      { label: "Conversao", value: `${Number((data.conversion_rate ?? 0) * 100).toFixed(1)}%`, tone: "default", helper: "Pagas / iniciadas." },
    ],
    latestRuns,
    latestFailures,
    latestUpdatedUfs: data.latestUpdatedUfs ?? data.latest_updated_ufs ?? [],
  };
};

// Health
export const getAdminHealth = async (): Promise<AdminHealth> => {
  const data = await adminReq<AdminApiRecord>("/v1/admin/health");
  const datasetSources = asArray<AdminApiRecord>(data.dataset_sources, "items").map(mapBaseRow);
  const failedJobs = asArray<AdminApiRecord>(data.recent_jobs, "items").filter((job) => job.status === "failed").length;
  return {
    ...data,
    pipelineStatus: data.pipelineStatus ?? data.database ?? "unknown",
    jobsStuck: data.jobsStuck ?? failedJobs,
    recentTimeouts: data.recentTimeouts ?? 0,
    staleBases: data.staleBases ?? [],
    datasetSources,
  };
};

// Finance
export interface FinanceFilters {
  date_from?: string;
  date_to?: string;
  startDate?: string;
  endDate?: string;
  preset?: string;
  provider?: string;
  uf?: string;
  status?: string;
}

const makeFinanceParams = (filters?: FinanceFilters & { limit?: number }) => {
  const normalized = {
    ...filters,
    date_from: filters?.date_from ?? filters?.startDate,
    date_to: filters?.date_to ?? filters?.endDate,
  };
  delete normalized.startDate;
  delete normalized.endDate;
  delete normalized.preset;
  delete normalized.provider;
  delete normalized.uf;

  return new URLSearchParams(
    Object.fromEntries(
      Object.entries(normalized)
        .filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== "all")
        .map(([k, v]) => [k, String(v)]),
    ),
  );
};

export const getAdminFinanceSummary = (filters?: FinanceFilters): Promise<AdminApiRecord> => {
  const params = makeFinanceParams(filters);
  return adminReq<AdminApiRecord>(`/v1/admin/finance/summary?${params}`).then((data): AdminApiRecord => ({
    ...data,
    cards: data.cards ?? [
      { key: "total_brl", label: "Receita aprovada", formattedValue: `R$ ${Number(data.total_brl ?? 0).toFixed(2)}`, helper: "Pagamentos aprovados." },
      { key: "approved", label: "Pagamentos aprovados", formattedValue: data.total_approved ?? 0, helper: "Status APPROVED." },
      { key: "pending", label: "Pagamentos pendentes", formattedValue: data.total_pending ?? 0, helper: "Status PENDING." },
      { key: "conversion", label: "Conversao", formattedValue: `${Number((data.conversion_rate ?? 0) * 100).toFixed(1)}%`, helper: "Aprovados / total." },
    ],
    businessRules: data.businessRules ?? {},
  }));
};

export const getAdminFinancePayments = (filters?: FinanceFilters & { limit?: number }): Promise<AdminApiRecord> => {
  const params = makeFinanceParams(filters);
  return adminReq<{ payments: AdminApiRecord[]; count: number }>(`/v1/admin/finance/payments?${params}`).then((data) => {
    const payments = data.payments.map(mapPaymentRow);
    return {
      ...data,
      payments,
      latestPayments: payments,
      pendingPayments: payments.filter((row) => ["PENDING", "CREATED"].includes(row.status)),
      failedPayments: payments.filter((row) => ["EXPIRED", "FAILED", "REJECTED", "CANCELLED"].includes(row.status)),
      monetizedQueries: payments.filter((row) => row.status === "APPROVED"),
      topUfsByRevenue: [],
    };
  });
};

export const getAdminFinanceByUf = (_filters?: FinanceFilters): Promise<{ items: FinanceByUfRow[]; by_uf: FinanceByUfRow[] }> =>
  adminReq<{ by_uf: AdminApiRecord[] }>("/v1/admin/finance/by-uf").then((data) => {
    const items = (data.by_uf ?? []).map((row) => ({
      ...row,
      uf: String(row.uf ?? ""),
      revenueBrl: toNumber(row.revenueBrl),
      approvedPayments: toNumber(row.approvedPayments ?? row.paid),
      monetizedQueries: toNumber(row.monetizedQueries ?? row.paid),
      averageTicketBrl: toNumber(row.averageTicketBrl),
    }));
    return { ...data, items, by_uf: items };
  });

// ── Compat aliases (pages do repo original) ───────────────
export const listAdminBases = getAdminBases;
export const listAdminJobs = getAdminJobs;
export const getAdminBaseDetail = async (uf: string): Promise<AdminBaseDetail> => {
  const data = await adminReq<AdminApiRecord>(`/v1/admin/bases/${uf}`);
  return data.item ? (data as AdminBaseDetail) : { item: mapBaseRow(data), recentRuns: [] };
};
export const syncAllAdminBases = async () => {
  const bases = await getAdminBases();
  const results = await Promise.all(bases.map((base) => syncAdminBase(base.uf)));
  return { jobType: "sync-all", status: "completed", results };
};
export const triggerAdminBaseAction = (uf: string, action: string) =>
  adminReq<AdminJobRow>(action === "sync" ? `/v1/admin/bases/${uf}/sync` : "/v1/admin/jobs/sync", {
    method: "POST",
    body: JSON.stringify({ uf, action }),
  }).then(mapJobRow);
export const triggerAdminJob = (path: string, payload?: unknown) =>
  adminReq<AdminJobRow>(path, { method: "POST", body: JSON.stringify(payload ?? {}) }).then(mapJobRow);
export const listAdminLogs = async (): Promise<AdminApiRecord[]> => [];
export const listAdminSchedules = async (): Promise<AdminApiRecord[]> => [];
export const updateAdminSchedule = (_s: unknown): Promise<void> => Promise.resolve();
export const getAdminFinanceCharts = async (_filters?: FinanceFilters): Promise<AdminApiRecord> => ({
  receitaPorDia: [],
  pagamentosPorStatus: [],
  pagamentosPorProvider: [],
  receitaPorUf: [],
  conversaoPorDia: [],
  consultasVsPagamentos: [],
  relatoriosPorDia: [],
});
export const getAdminFinanceConversion = async (filters?: FinanceFilters): Promise<AdminApiRecord> => {
  const summary = await getAdminFinanceSummary(filters);
  return {
    startedQueries: summary.total_payments ?? 0,
    monetizedQueries: summary.total_approved ?? 0,
    conversionRate: summary.conversion_rate ?? 0,
    averageTicketBrl: summary.total_approved ? summary.total_brl / summary.total_approved : 0,
  };
};
export const downloadConsultaPdf = getPdfDownloadUrl;
export const mapPrecheckErrorMessage = (err: unknown) => String(err);
export const runTesteBaseGov = (_p: unknown) => Promise.resolve({});

// Types compat
export type AdminBaseRow = AdminApiRecord & { uf: string; status: string; lastSyncAt?: string | null; currentHash?: string | null };
export type AdminBaseDetail = AdminApiRecord & { item: AdminBaseRow; recentRuns: AdminJobRow[] };
export type AdminJobRow = AdminApiRecord & { id: string; status: string; resultStatus: string; jobType: string; uf?: string | null };
export type AdminDashboardOverview = AdminApiRecord & { metrics: AdminApiRecord[]; latestRuns: AdminJobRow[]; latestFailures: AdminJobRow[]; latestUpdatedUfs: AdminApiRecord[] };
export type AdminHealth = AdminApiRecord & { pipelineStatus: string; jobsStuck: number; recentTimeouts: number; staleBases: string[]; datasetSources: AdminBaseRow[] };
export type FinanceByUfRow = AdminApiRecord & { uf: string; revenueBrl: number; approvedPayments: number; monetizedQueries: number; averageTicketBrl: number };
export type FinancePaymentRow = AdminApiRecord & { id: string; queryId: string; provider: string; providerPaymentId?: string | null; amountBrl: number; status: string; createdAt?: string | null; paidAt?: string | null };
export type FinancePreset = string;
export type PixPayment = PixResponse;
export type TesteBaseGovResult = Record<string, unknown>;
