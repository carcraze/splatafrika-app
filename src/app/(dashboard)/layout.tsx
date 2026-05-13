import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Dashboard layout — Layer 2 auth check (defense in depth).
 * Even if middleware redirect fails or is bypassed, this server-side
 * check independently blocks access to all dashboard routes.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8ED]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/dashboard" className="text-lg font-bold text-[#0D1B23]">
            Splat<span className="text-[#00D4AA]">Afrika</span>
          </a>
          <div className="flex items-center gap-4">
            <a
              href="/dashboard/billing"
              className="text-sm text-[#4A6070] hover:text-[#1C2B36] transition-colors"
            >
              Billing
            </a>
            <span className="text-sm text-[#8FA3B1]">{user.email}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
