import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Bell,
  UserCircle,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin, useProfile } from "@/hooks/use-profile";
import { ensureMemberAccount } from "@/lib/account.functions";
import { Toaster } from "sonner";
import cicLogo from "@/assets/cic-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assignments", label: "Assignments", icon: FileText },
  { to: "/documents", label: "Documents", icon: FolderOpen },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: UserCircle },
] as const;

function AuthedLayout() {
  const { user } = useAuth();
  const ensureAccount = useServerFn(ensureMemberAccount);
  const { data: profile } = useProfile(user?.id);
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user?.id) return;
    ensureAccount({}).catch(() => undefined);
  }, [ensureAccount, user?.id]);

  async function handleLogout() {
    await supabase.auth.stopAutoRefresh();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <Toaster richColors position="top-right" />

      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-navy-deep text-white sticky top-0 h-screen">
        <SidebarContent
          isAdmin={!!isAdmin}
          adminLoading={adminLoading}
          pathname={pathname}
          onLogout={handleLogout}
          name={profile?.full_name || user?.email || ""}
          studentId={profile?.student_id}
        />
      </aside>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-navy-deep text-white h-14 flex items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-white p-1">
            <img src={cicLogo.url} alt="CIC" className="h-full w-full object-contain" />
          </div>
          <span className="font-display font-semibold">CIC</span>
        </Link>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="h-9 w-9 grid place-items-center rounded-md hover:bg-white/10"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-navy-deep text-white pt-14">
          <SidebarContent
            isAdmin={!!isAdmin}
            adminLoading={adminLoading}
            pathname={pathname}
            onLogout={handleLogout}
            name={profile?.full_name || user?.email || ""}
            studentId={profile?.student_id}
          />
        </div>
      )}

      <main className="flex-1 min-w-0 lg:ml-0 pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}

function SidebarContent({
  isAdmin,
  adminLoading,
  pathname,
  onLogout,
  name,
  studentId,
}: {
  isAdmin: boolean;
  adminLoading: boolean;
  pathname: string;
  onLogout: () => void;
  name: string;
  studentId?: string | null;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-7 flex items-center gap-3 border-b border-white/10">
        <div className="h-10 w-10 rounded-full bg-white p-1.5 ring-1 ring-gold/40">
          <img src={cicLogo.url} alt="CIC" className="h-full w-full object-contain" />
        </div>
        <div className="leading-tight">
          <p className="font-display font-semibold">CIC Portal</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold-soft">MNNIT</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active
                  ? "bg-gold text-navy-deep shadow-gold"
                  : "text-white/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          );
        })}
        {(adminLoading || isAdmin) && (
          <>
            <div className="mt-6 mb-2 px-3 text-[10px] uppercase tracking-[0.2em] text-gold-soft/60">
              Admin
            </div>
            {adminLoading ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/45">
                <Shield size={17} /> Checking access…
              </div>
            ) : (
              <Link
                to="/admin"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  pathname.startsWith("/admin")
                    ? "bg-gold text-navy-deep shadow-gold"
                    : "text-white/80 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Shield size={17} />
                Admin Console
              </Link>
            )}
          </>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-white/10 space-y-3">
        <div className="px-2">
          <p className="text-sm font-medium text-white truncate">{name || "Member"}</p>
          {studentId && (
            <p className="text-xs text-white/50 truncate">ID: {studentId}</p>
          )}
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5 hover:text-white transition"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
