import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAdminAuth } from "./AdminAuthContext";

export const RequireAdminAuth = () => {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-brand-blue/20 border-t-brand-blue animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Validando sessão administrativa…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export default RequireAdminAuth;
