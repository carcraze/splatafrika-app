import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/constants";
import type { Payment } from "@/types";
import { Download, RefreshCw, Clock } from "lucide-react";

export default async function BillingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: payments } = await supabase
    .from("payments")
    .select("*, tour:tours(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<(Payment & { tour: { name: string } | null })[]>();

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-[#0D1B23]">Billing History</h1>

      {!payments || payments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8ED] p-8 text-center">
          <p className="text-sm text-[#4A6070]">No payments yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8ED] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8ED] bg-[#F8FAFB]">
                  <th className="text-left px-4 py-3 font-medium text-[#4A6070]">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-[#4A6070]">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-[#4A6070] hidden sm:table-cell">Provider</th>
                  <th className="text-left px-4 py-3 font-medium text-[#4A6070]">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-[#4A6070] hidden md:table-cell">Tour</th>
                  <th className="text-left px-4 py-3 font-medium text-[#4A6070]">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-[#E2E8ED] last:border-0">
                    <td className="px-4 py-3 text-[#1C2B36]">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#0D1B23]">
                      {formatCurrency(payment.amount / 100, payment.currency)}
                    </td>
                    <td className="px-4 py-3 text-[#4A6070] capitalize hidden sm:table-cell">
                      {payment.provider}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={payment.status} />
                    </td>
                    <td className="px-4 py-3 text-[#4A6070] hidden md:table-cell truncate max-w-[150px]">
                      {payment.tour?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceAction payment={payment} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    succeeded: { label: "Paid", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
    failed: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200" },
    refunded: { label: "Refunded", className: "bg-gray-50 text-gray-700 border-gray-200" },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${c.className}`}>
      {c.label}
    </span>
  );
}

function InvoiceAction({ payment }: { payment: Payment }) {
  if (payment.invoice_status === "generated" && payment.invoice_url) {
    return (
      <a href={payment.invoice_url} download className="inline-flex items-center gap-1 text-xs text-[#00D4AA] hover:text-[#003D30] font-medium">
        <Download className="w-3 h-3" /> Download
      </a>
    );
  }
  if (payment.invoice_status === "failed") {
    return (
      <button className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium">
        <RefreshCw className="w-3 h-3" /> Request resend
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[#8FA3B1]">
      <Clock className="w-3 h-3" /> Generating...
    </span>
  );
}
