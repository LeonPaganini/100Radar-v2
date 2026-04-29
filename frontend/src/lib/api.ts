const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

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

// Bases
export const getAdminBases = () =>
  adminReq<{ bases: unknown[] }>("/v1/admin/bases");

export const syncAdminBase = (uf: string) =>
  adminReq<unknown>(`/v1/admin/bases/${uf}/sync`, { method: "POST" });

// Jobs
export const getAdminJobs = () =>
  adminReq<{ jobs: unknown[] }>("/v1/admin/jobs");

export const triggerAdminSync = (uf: string) =>
  adminReq<unknown>("/v1/admin/jobs/sync", {
    method: "POST",
    body: JSON.stringify({ uf }),
  });

// Dashboard
export const getAdminDashboardOverview = () =>
  adminReq<Record<string, unknown>>("/v1/admin/dashboard/overview");

// Health
export const getAdminHealth = () =>
  adminReq<Record<string, unknown>>("/v1/admin/health");

// Finance
export interface FinanceFilters {
  date_from?: string;
  date_to?: string;
  status?: string;
}

export const getAdminFinanceSummary = (filters?: FinanceFilters) => {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filters ?? {}).filter(([, v]) => Boolean(v))) as Record<string, string>,
  );
  return adminReq<Record<string, unknown>>(`/v1/admin/finance/summary?${params}`);
};

export const getAdminFinancePayments = (filters?: FinanceFilters & { limit?: number }) => {
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(filters ?? {})
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, String(v)]),
    ),
  );
  return adminReq<{ payments: unknown[]; count: number }>(`/v1/admin/finance/payments?${params}`);
};

export const getAdminFinanceByUf = () =>
  adminReq<{ by_uf: unknown[] }>("/v1/admin/finance/by-uf");

// ── Compat aliases (pages do repo original) ───────────────
export const listAdminBases = getAdminBases;
export const listAdminJobs = getAdminJobs;
export const getAdminBaseDetail = (uf: string) => adminReq<unknown>(`/v1/admin/bases/${uf}`);
export const syncAllAdminBases = () => adminReq<unknown>("/v1/admin/bases/sync-all", { method: "POST" });
export const triggerAdminBaseAction = (uf: string, action: string) =>
  adminReq<unknown>(`/v1/admin/bases/${uf}/${action}`, { method: "POST" });
export const triggerAdminJob = (payload: unknown) =>
  adminReq<unknown>("/v1/admin/jobs/sync", { method: "POST", body: JSON.stringify(payload) });
export const listAdminLogs = () => adminReq<unknown>("/v1/admin/health");
export const listAdminSchedules = () => adminReq<{ schedules: unknown[] }>("/v1/admin/health");
export const updateAdminSchedule = (_s: unknown) => Promise.resolve();
export const getAdminFinanceCharts = getAdminFinanceSummary;
export const getAdminFinanceConversion = getAdminFinanceSummary;
export const downloadConsultaPdf = getPdfDownloadUrl;
export const mapPrecheckErrorMessage = (err: unknown) => String(err);
export const runTesteBaseGov = (_p: unknown) => Promise.resolve({});

// Types compat
export type AdminBaseDetail = Record<string, unknown>;
export type AdminBaseRow = Record<string, unknown>;
export type FinanceByUfRow = Record<string, unknown>;
export type FinancePaymentRow = Record<string, unknown>;
export type FinancePreset = string;
export type PixPayment = PixResponse;
export type TesteBaseGovResult = Record<string, unknown>;
