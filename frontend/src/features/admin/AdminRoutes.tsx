import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AdminAuthProvider } from "@/features/admin/AdminAuthContext";
import RequireAdminAuth from "@/features/admin/RequireAdminAuth";
import AdminShell from "@/features/admin/AdminShell";

const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminBases = lazy(() => import("@/pages/AdminBases"));
const AdminJobs = lazy(() => import("@/pages/AdminJobs"));
const AdminFinanceiro = lazy(() => import("@/pages/AdminFinanceiro"));
const AdminOperacao = lazy(() => import("@/pages/AdminOperacao"));

export default function AdminRoutes() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route element={<RequireAdminAuth />}>
          <Route element={<AdminShell />}>
            <Route index element={<AdminDashboard />} />
            <Route path="bases" element={<AdminBases />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="financeiro" element={<AdminFinanceiro />} />
            <Route path="operacao" element={<AdminOperacao />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminAuthProvider>
  );
}
