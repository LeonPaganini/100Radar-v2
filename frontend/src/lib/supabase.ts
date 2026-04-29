import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error("[100Radar] VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios.");
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export interface AdminUser {
  id: string;
  email: string;
  role: "super_admin" | "operator" | "finance";
  full_name: string;
}

type RawSession = {
  user: {
    id: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  };
};

export function extractAdminUser(session: RawSession): AdminUser {
  const u = session.user;
  return {
    id: u.id,
    email: u.email ?? "",
    role: (u.app_metadata?.role as AdminUser["role"]) ?? "operator",
    full_name: (u.user_metadata?.full_name as string) ?? u.email ?? "",
  };
}
