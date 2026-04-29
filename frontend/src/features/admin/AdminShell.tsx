import { Activity, CalendarClock, CircleDollarSign, Database, FlaskConical, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const items = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Financeiro", url: "/admin/financeiro", icon: CircleDollarSign },
  { title: "Bases", url: "/admin/bases", icon: Database },
  { title: "Jobs", url: "/admin/jobs", icon: Activity },
  { title: "Testes", url: "/admin/testes", icon: FlaskConical },
  { title: "Operação", url: "/admin/operacao", icon: CalendarClock },
];

export const AdminShell = () => {
  const { admin, logoutAdmin } = useAdminAuth();
  const location = useLocation();
  const visibleItems = items.filter((item) => item.url !== "/admin/financeiro" || admin?.role === "finance" || admin?.role === "super_admin");

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <Link to="/admin" className="flex items-center gap-3 px-2 py-3">
            <div className="rounded-xl bg-brand-blue/15 p-2 text-brand-blue">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="font-semibold text-sidebar-foreground">100Radar Admin</div>
              <div className="text-xs text-sidebar-foreground/70">Operação protegida</div>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navegação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url} tooltip={item.title}>
                      <NavLink to={item.url} end={item.url === "/admin"}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Card className="m-2 border-sidebar-border bg-sidebar-accent/30 p-3 group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-medium">{admin?.full_name}</div>
            <div className="text-xs text-muted-foreground">{admin?.email}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{admin?.role}</div>
            <Separator className="my-3" />
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => void logoutAdmin()}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </Card>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <div className="text-sm font-semibold">Central operacional</div>
                <div className="text-xs text-muted-foreground">{location.pathname}</div>
              </div>
            </div>
            <div className="hidden text-right md:block">
              <div className="text-sm font-medium">Sessão protegida</div>
              <div className="text-xs text-muted-foreground">Cookie HttpOnly + backend auth</div>
            </div>
          </div>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
-e 
export default AdminShell;
