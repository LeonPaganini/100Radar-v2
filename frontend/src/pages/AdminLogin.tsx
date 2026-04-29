import { FormEvent, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck } from "lucide-react";

import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ADMIN_LOGIN_UNAVAILABLE_MESSAGE =
  "O login administrativo está temporariamente indisponível por uma verificação de banco/schema. " +
  "Confirme se as tabelas admin_users, admin_sessions e admin_audit_logs estão acessíveis no banco de runtime e tente novamente em instantes.";

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, loginAdmin } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const destination = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from || "/admin";
  }, [location.state]);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.info("[admin-login-debug] submit_clicked", {
      destination,
      email: email.trim(),
      hasPassword: Boolean(password),
      currentUrl: window.location.href,
    });
    setSubmitting(true);
    setError(null);
    try {
      console.info("[admin-login-debug] login_request_dispatch", {
        email: email.trim(),
      });
      await loginAdmin({ email: email.trim(), password });
      console.info("[admin-login-debug] login_request_success", {
        destination,
      });
      navigate(destination, { replace: true });
    } catch (err) {
      console.error("[admin-login-debug] login_request_error", err);
      if (err instanceof ApiError) {
        if (err.status === 401) setError("E-mail ou senha inválidos.");
        else if (err.status === 403) setError("Seu usuário admin está inativo.");
        else if (err.status === 503) setError(ADMIN_LOGIN_UNAVAILABLE_MESSAGE);
        else setError(err.message);
      } else {
        setError("Não foi possível autenticar agora. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue text-white shadow-lg shadow-brand-blue/30">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-display font-bold">Admin 100Radar</h1>
          <p className="mt-2 text-sm text-slate-300">Acesso restrito para operadores autorizados.</p>
        </div>

        <Card className="border-white/10 bg-slate-900/90 shadow-2xl shadow-black/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <LockKeyhole className="h-5 w-5 text-brand-blue" />
              Entrar
            </CardTitle>
            <CardDescription className="text-slate-300">
              Use seu e-mail corporativo e sua senha segura para acessar o painel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-slate-200">E-mail</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@100radar.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-white/10 bg-slate-950/50 text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-slate-200">Senha</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-white/10 bg-slate-950/50 text-white"
                  required
                />
              </div>

              {error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full hero-accent-gradient" disabled={submitting}>
                {submitting ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
