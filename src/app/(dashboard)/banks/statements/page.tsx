import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, resolveCompanyScope } from "@/lib/auth/helpers";
import { getCashbooks } from "@/lib/queries/cashbooks";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import Link from "next/link";
import { formatINR } from "@/components/shared/currency-display";
import { Landmark, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function BankStatementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CASHBOOK_READ)) redirect("/dashboard");

  const cookieStore = await cookies();
  // branchId intentionally ignored — bank accounts are company-wide
  const companyId = await resolveCompanyScope(
    supabase,
    user.id,
    cookieStore.get("scope_company_id")?.value
  );

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Bank Statements"
          description="Select a company from the header to view bank statements"
        />
      </div>
    );
  }

  // Bank accounts are COMPANY-WIDE — no branch filter
  const bankAccounts = await getCashbooks(companyId, null, "bank");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Statements"
        description="Company-wide bank statements — shared across all branches. Switch branches to see branch-specific cashbooks instead."
      />

      {bankAccounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Landmark className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No bank accounts found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a cashbook with type &apos;Bank&apos; to get started.
          </p>
          <Link href="/cash/cashbooks/new" className="mt-4">
            <Button variant="outline">Add Bank Account</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bankAccounts.map((account: { id: string; name: string; opening_balance: number; is_active: boolean }) => (
            <div
              key={account.id}
              className="rounded-lg border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">{account.name}</h3>
                </div>
                <Badge variant={account.is_active ? "default" : "secondary"}>
                  {account.is_active ? "Open" : "Closed"}
                </Badge>
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">Opening Balance</p>
                <p className="text-xl font-bold tabular-nums">
                  {formatINR(account.opening_balance)}
                </p>
              </div>
              <div className="mt-4">
                <Link href={`/cash/cashbooks/${account.id}/days`}>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <CalendarDays className="h-4 w-4" />
                    View Statement
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
