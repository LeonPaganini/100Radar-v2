import { cn } from "@/lib/utils";
type Status = "REGULAR" | "VENCIDO" | "INDETERMINADO" | "VALIDO";
const config: Record<Status, { label: string; className: string }> = {
  REGULAR:       { label: "Regular",       className: "bg-status-regular-bg text-status-regular-foreground border-status-regular" },
  VALIDO:        { label: "Válido",         className: "bg-status-regular-bg text-status-regular-foreground border-status-regular" },
  VENCIDO:       { label: "Vencido",        className: "bg-status-vencido-bg text-status-vencido-foreground border-status-vencido" },
  INDETERMINADO: { label: "Indeterminado",  className: "bg-status-indeterminado-bg text-status-indeterminado-foreground border-status-indeterminado" },
};
export default function StatusSeal({ status, className }: { status: Status; className?: string }) {
  const c = config[status] ?? config.INDETERMINADO;
  return <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold", c.className, className)}>{c.label}</span>;
}
