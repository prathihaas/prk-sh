import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getFraudFlag } from "@/lib/queries/fraud-flags";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { FraudReviewForm } from "./fraud-review-form";

export default async function FraudFlagDetailPage({
  params,
}: {
  params: Promise<{ flagId: string }>;
}) {
  const { flagId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_VIEW_FRAUD_FLAGS)) redirect("/dashboard");

  let flag;
  try {
    flag = await getFraudFlag(flagId);
  } catch {
    notFound();
  }

  const isResolvable =
    flag.resolution_status === "open" ||
    flag.resolution_status === "investigating";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/audit/fraud-flags">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Fraud Flag Details" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Flag Information</CardTitle>
            <CardDescription>Details about this fraud flag</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Type
                </p>
                <p className="text-sm font-semibold">
                  {flag.flag_type
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Severity
                </p>
                <StatusBadge status={flag.severity} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <StatusBadge status={flag.resolution_status} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Flagged At
                </p>
                <p className="text-sm">
                  {new Date(flag.flagged_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Description
              </p>
              <p className="text-sm mt-1">{flag.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Table
                </p>
                <p className="text-sm font-mono">{flag.table_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Record ID
                </p>
                <p className="text-sm font-mono" title={flag.record_id}>
                  {flag.record_id.substring(0, 8)}...
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Flagged By
              </p>
              <p className="text-sm">
                {flag.flagged_by_user?.full_name || "System"}
              </p>
            </div>
          </CardContent>
        </Card>

        {isResolvable ? (
          <FraudReviewForm flagId={flagId} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Resolution</CardTitle>
              <CardDescription>
                This flag has been{" "}
                {flag.resolution_status === "resolved"
                  ? "resolved"
                  : "marked as false positive"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Resolved By
                </p>
                <p className="text-sm">
                  {flag.resolved_by_user?.full_name || "\u2014"}
                </p>
              </div>
              {flag.resolved_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Resolved At
                  </p>
                  <p className="text-sm">
                    {new Date(flag.resolved_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              )}
              {flag.resolution_notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Resolution Notes
                  </p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">
                    {flag.resolution_notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
