import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase, extractAdminUser, type AdminUser } from "@/lib/supabase";

interface AdminAuthCtxValue {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAdmin: (payload: { email: string; password: string }) => Promise<AdminUser>;
  logoutAdmin: () => Promise<void>;
}

const AdminAuthCtx = createContext<AdminAuthCtxValue | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Restaura sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setAdmin(session ? extractAdminUser(session) : null);
      setIsLoading(false);
    });

    // Escuta mudanças (refresh, logout em outra aba)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAdmin(session ? extractAdminUser(session) : null);
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginAdmin = useCallback(
    async (payload: { email: string; password: string }): Promise<AdminUser> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: payload.email.trim(),
        password: payload.password,
      });

      if (error || !data.session) {
        const msg =
          error?.message?.toLowerCase().includes("invalid")
            ? "E-mail ou senha inválidos."
            : (error?.message ?? "Não foi possível autenticar. Tente novamente.");
        throw new Error(msg);
      }

      const user = extractAdminUser(data.session);
      setAdmin(user);
      return user;
    },
    [],
  );

  const logoutAdmin = useCallback(async () => {
    await supabase.auth.signOut();
    setAdmin(null);
  }, []);

  const value = useMemo<AdminAuthCtxValue>(
    () => ({ admin, isAuthenticated: Boolean(admin), isLoading, loginAdmin, logoutAdmin }),
    [admin, isLoading, loginAdmin, logoutAdmin],
  );

  return <AdminAuthCtx.Provider value={value}>{children}</AdminAuthCtx.Provider>;
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthCtx);
  if (!ctx) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return ctx;
};

export type { AdminUser };
