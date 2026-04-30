import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveCompanyScope } from "@/lib/auth/helpers";
import { getEligibleExpenseApprovers } from "@/lib/queries/expense-approvers";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/components/shared/currency-display";
import { ArrowRight, Inbox } from "lucide-react";

interface PendingExpense {
  id: string;
  amount: number;
  description: string;
  expense_date: string;
  branch_id: string | null;
  category_name: string | null;
  submitter_name: string | null;
  branch_name: string | null;
}

/**
 * "Approvals" inbox — every submitted expense the current user is allowed
 * to approve, regardless of branch. Eligibility uses the same rules as the
 * server action and Telegram webhook (owner / finance / accountant company-wide;
 * branch_manager scoped to their branch).
 */
export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const companyId = await resolveCompanyScope(
    supabase,
    user.id,
    cookieStore.get("scope_company_id")?.value
  );

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Approvals"
          description="Select a company from the header"
        />
      </div>
    );
  }

  // Pull every submitted expense in this company, then filter to those the
  // current user is allowed to approve. We do the filter in app code rather
  // than SQL because eligibility depends on role-and-branch matching.
  const { data: expensesRaw } = await supabase
    .from("expenses")
    .select(`
      id, amount, description, expense_date, branch_id, submitted_by,
      category:expense_categories(name),
      submitter:user_profiles!expenses_submitted_by_fkey(full_name),
      branch:branches(name)
    `)
    .eq("company_id", companyId)
    .eq("approval_status", "submitted")
    .order("expense_date", { ascending: false });

  const allSubmitted = (expensesRaw || []) as unknown as Array<{
    id: string;
    amount: number;
    description: string;
    expense_date: string;
    branch_id: string | null;
    submitted_by: string;
    category: { name: string | null } | null;
    submitter: { full_name: string | null } | null;
    branch: { name: string | null } | null;
  }>;

  // Determine which branch_ids the current user can approve for, using the
  // shared eligibility rule. Cache by branch_id so we don't re-query for
  // every expense on the same branch.
  const branchIds = Array.from(new Set(allSubmitted.map((e) => e.branch_id ?? "_null")));
  const eligibleBranches = new Set<string>();

  for (const bid of branchIds) {
    const branchId = bid === "_null" ? null : bid;
    const approvers = await getEligibleExpenseApprovers(supabase, companyId, branchId);
    if (approvers.some((a) => a.user_id === user.id)) {
      eligibleBranches.add(bid);
    }
  }

  const pending: PendingExpense[] = allSubmitted
    // never show users their own submissions in the approval inbox
    .filter((e) => e.submitted_by !== user.id)
    .filter((e) => eligibleBranches.has(e.branch_id ?? "_null"))
    .map((e) => ({
      id: e.id,
      amount: e.amount,
      description: e.description,
      expense_date: e.expense_date,
      branch_id: e.branch_id,
      category_name: e.category?.name ?? null,
      submitter_name: e.submitter?.full_name ?? null,
      branch_name: e.branch?.name ?? null,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Expenses waiting for your approval. One approval is enough — the first owner, finance controller, accountant, or branch manager to act wins."
      />

      {pending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-40" />
            <p>Nothing waiting for your approval right now.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {pending.map((e) => (
            <Card key={e.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">
                      {e.category_name || "Expense"} —{" "}
                      <span className="tabular-nums">{formatINR(e.amount)}</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[
                        e.branch_name,
                        new Date(e.expense_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }),
                        e.submitter_name ? `by ${e.submitter_name}` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                  <Button size="sm" asChild className="gap-1.5">
                    <Link href={`/expenses/${e.id}/approve`}>
                      Review
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm">{e.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
