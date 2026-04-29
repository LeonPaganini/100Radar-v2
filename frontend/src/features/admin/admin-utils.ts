export const adminStatusTone = (status: string) => {
  if (["success", "unchanged", "healthy", "ok"].includes(status)) return "default";
  if (["failed", "danger", "error"].includes(status)) return "destructive";
  if (["running", "pending", "warning", "attention"].includes(status)) return "secondary";
  return "outline";
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
};

export const formatDuration = (value?: number | null) => {
  if (value == null) return "—";
  if (value < 60) return `${value.toFixed(0)}s`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}m ${seconds}s`;
};

export const formatCurrencyBRL = (value?: number | null) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
};

export const formatPercentage = (value?: number | null) => {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
};
