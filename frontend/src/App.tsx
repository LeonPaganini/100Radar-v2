import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AdminAuthProvider } from "@/features/admin/AdminAuthContext";
import RequireAdminAuth from "@/features/admin/RequireAdminAuth";
import AdminShell from "@/features/admin/AdminShell";

import Home from "@/pages/Home";
import Verificar from "@/pages/Verificar";
import Analise from "@/pages/Analise";
import Pagamento from "@/pages/Pagamento";
import Resultado from "@/pages/Resultado";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminBases from "@/pages/AdminBases";
import AdminJobs from "@/pages/AdminJobs";
import AdminFinanceiro from "@/pages/AdminFinanceiro";
import AdminOperacao from "@/pages/AdminOperacao";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <BrowserRouter>
          <Routes>
            {/* ── Público ───────────────────────────────────── */}
            <Route path="/" element={<Home />} />
            <Route path="/verificar" element={<Verificar />} />
            <Route path="/analise/:queryId" element={<Analise />} />
            <Route path="/pagamento/:queryId" element={<Pagamento />} />
            <Route path="/resultado/:queryId" element={<Resultado />} />

            {/* ── Admin ─────────────────────────────────────── */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route element={<RequireAdminAuth />}>
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<AdminDashboard />} />
                <Route path="bases" element={<AdminBases />} />
                <Route path="jobs" element={<AdminJobs />} />
                <Route path="financeiro" element={<AdminFinanceiro />} />
                <Route path="operacao" element={<AdminOperacao />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}
