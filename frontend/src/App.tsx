import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import Verificar from "@/pages/Verificar";
import Analise from "@/pages/Analise";
import Pagamento from "@/pages/Pagamento";
import Resultado from "@/pages/Resultado";

const AdminRoutes = lazy(() => import("@/features/admin/AdminRoutes"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const routeFallback = (
  <div className="min-h-screen flex items-center justify-center bg-background px-6">
    <div className="h-10 w-10 rounded-full border-4 border-brand-blue/20 border-t-brand-blue animate-spin" />
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={routeFallback}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/verificar" element={<Verificar />} />
            <Route path="/analise/:queryId" element={<Analise />} />
            <Route path="/pagamento/:queryId" element={<Pagamento />} />
            <Route path="/resultado/:queryId" element={<Resultado />} />
            <Route path="/admin/*" element={<AdminRoutes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
