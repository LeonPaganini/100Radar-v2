import type { ReactNode } from "react";
import { AlertTriangle, DatabaseZap, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const AdminPageAlert = ({ title, description, tone = "default", action, className }: {
  title: string; description: string; tone?: "default" | "warning" | "danger"; action?: ReactNode; className?: string;
}) => {
  const toneClasses = { default: "border-slate-200 bg-white", warning: "border-amber-200 bg-amber-50/70", danger: "border-red-200 bg-red-50/80" } as const;
  return (
    <Card className={cn(toneClasses[tone], className)} role="alert" aria-live="polite">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {tone === "danger" ? <AlertTriangle className="h-4 w-4" /> : <DatabaseZap className="h-4 w-4" />}{title}
        </CardTitle>
        <CardDescription data-testid="admin-page-alert-description">{description}</CardDescription>
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
};
export const AdminPageLoading = ({ label = "Carregando…" }: { label?: string }) => (
  <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed bg-background px-6 text-center">
    <div className="space-y-3"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-brand-blue" /><p className="text-sm text-muted-foreground">{label}</p></div>
  </div>
);
export const AdminRetryAction = ({ onRetry, label = "Tentar novamente" }: { onRetry: () => void; label?: string }) => (
  <Button variant="outline" onClick={onRetry}>{label}</Button>
);
