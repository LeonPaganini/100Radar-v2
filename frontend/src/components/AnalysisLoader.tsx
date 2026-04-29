import { LoaderCircle } from "lucide-react";
export default function AnalysisLoader({ message = "Analisando…" }: { message?: string }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
      <LoaderCircle className="h-10 w-10 animate-spin text-brand-blue" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
