import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getVehiclesForReport } from "@/lib/queries/vehicle-register";
import { STATUS_LABELS, type VehicleStatus } from "@/lib/constants/vehicle-register";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Wrench,
  Paintbrush,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
} from "lucide-react";

// ─── duration helpers ──────────────────────────────────────────────────────────

function durHours(from: string | null | undefined, to?: string | null): number | null {
  if (!from) return null;
  const end = to ? new Date(to) : new Date();
  const h = (end.getTime() - new Date(from).getTime()) / (1000 * 60 * 60);
  return h >= 0 ? h : null;
}

function fmtDur(hours: number | null, opts?: { compact?: boolean }): string {
  if (hours === null) return "—";
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  if (opts?.compact) return `${days}d`;
  return h > 0 ? `${days}d ${h}h` : `${days}d`;
}

function avgHours(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null && isFinite(n));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function fmtDate(ts: string | null | undefined) {
  if (!ts) return null;
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ─── stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    arrived: "bg-slate-100 text-slate-700 border-slate-200",
    ro_opened: "bg-blue-100 text-blue-700 border-blue-200",
    waiting_for_parts: "bg-yellow-100 text-yellow-700 border-yellow-200",
    parts_received: "bg-cyan-100 text-cyan-700 border-cyan-200",
    insurance_approved: "bg-indigo-100 text-indigo-700 border-indigo-200",
    work_in_progress: "bg-orange-100 text-orange-700 border-orange-200",
    work_done: "bg-teal-100 text-teal-700 border-teal-200",
    ready_for_delivery: "bg-emerald-100 text-emerald-700 border-emerald-200",
    gate_pass_issued: "bg-purple-100 text-purple-700 border-purple-200",
    challan_issued: "bg-purple-100 text-purple-700 border-purple-200",
    delivered: "bg-green-100 text-green-700 border-green-200",
  };
  return (
    <Badge variant="outline" className={`text-xs whitespace-nowrap ${cfg[status] ?? "bg-muted text-muted-foreground"}`}>
      {STATUS_LABELS[status as VehicleStatus] ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────────

export default async function VehicleReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; shop?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.VEHICLE_REGISTER_VIEW)) redirect("/sales/vehicle-register");

  const cs = await cookies();
  const companyId = cs.get("scope_company_id")?.value || "";
  const branchId = cs.get("scope_branch_id")?.value || null;

  const { from, to, shop } = await searchParams;
  const shopFilter = shop === "workshop" || shop === "bodyshop" ? shop : null;

  const vehicles = companyId
    ? await getVehiclesForReport(companyId, {
        branchId,
        shopType: shopFilter,
        fromDate: from || null,
        toDate: to || null,
      })
    : [];

  // ── Compute per-shop stats ──────────────────────────────────────────────────
  function shopStats(st: "workshop" | "bodyshop") {
    const shopVehicles = vehicles.filter((v) => v.shop_type === st);
    const delivered = shopVehicles.filter((v) => v.status === "delivered");
    const active = shopVehicles.filter((v) => v.status !== "delivered");
    const overdue = active.filter((v) => {
      const h = durHours(v.arrived_at);
      return h !== null && h > 7 * 24;
    });

    const avgTAT = avgHours(delivered.map((v) => durHours(v.arrived_at, v.delivered_at)));
    const avgRoWait = avgHours(
      shopVehicles
        .filter((v) => v.ro_opened_at)
        .map((v) => durHours(v.arrived_at, v.ro_opened_at))
    );
    const avgWorkTime = avgHours(
      shopVehicles
        .filter((v) => v.work_started_at && v.work_done_at)
        .map((v) => durHours(v.work_started_at, v.work_done_at))
    );

    return { total: shopVehicles.length, delivered: delivered.length, active: active.length, overdue: overdue.length, avgTAT, avgRoWait, avgWorkTime };
  }

  const ws = shopStats("workshop");
  const bs = shopStats("bodyshop");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sales/vehicle-register">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Vehicle Register — Reports"
        description="Timing analytics: average service durations, turnaround times, and full vehicle history."
      />

      {/* ── Filters ── */}
      <Card>
        <CardContent className="pt-4">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Arrived From</label>
              <input
                type="date"
                name="from"
                defaultValue={from ?? ""}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Arrived To</label>
              <input
                type="date"
                name="to"
                defaultValue={to ?? ""}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Shop Type</label>
              <select
                name="shop"
                defaultValue={shop ?? ""}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All</option>
                <option value="workshop">Workshop</option>
                <option value="bodyshop">Bodyshop</option>
              </select>
            </div>
            <Button type="submit" size="sm">Apply</Button>
            {(from || to || shop) && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sales/vehicle-register/reports">Clear</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* ── Workshop Stats ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-blue-700">Workshop</h3>
          <span className="text-xs text-muted-foreground">{ws.total} total</span>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Active" value={String(ws.active)} icon={Wrench} color="text-blue-600" />
          <StatCard label="Delivered" value={String(ws.delivered)} icon={CheckCircle2} color="text-green-600" />
          <StatCard label="Overdue (>7d)" value={String(ws.overdue)} icon={AlertTriangle} color={ws.overdue > 0 ? "text-red-600" : "text-muted-foreground"} />
          <StatCard label="Avg Turnaround" value={fmtDur(ws.avgTAT)} sub="arrival → delivery" icon={Clock} color="text-blue-600" />
          <StatCard label="Avg R/O Wait" value={fmtDur(ws.avgRoWait)} sub="arrival → R/O opened" icon={TrendingDown} color="text-blue-600" />
          <StatCard label="Avg Work Time" value={fmtDur(ws.avgWorkTime)} sub="start → done" icon={Clock} color="text-blue-600" />
        </div>
      </div>

      {/* ── Bodyshop Stats ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Paintbrush className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-semibold text-purple-700">Bodyshop</h3>
          <span className="text-xs text-muted-foreground">{bs.total} total</span>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Active" value={String(bs.active)} icon={Paintbrush} color="text-purple-600" />
          <StatCard label="Delivered" value={String(bs.delivered)} icon={CheckCircle2} color="text-green-600" />
          <StatCard label="Overdue (>7d)" value={String(bs.overdue)} icon={AlertTriangle} color={bs.overdue > 0 ? "text-red-600" : "text-muted-foreground"} />
          <StatCard label="Avg Turnaround" value={fmtDur(bs.avgTAT)} sub="arrival → delivery" icon={Clock} color="text-purple-600" />
          <StatCard label="Avg R/O Wait" value={fmtDur(bs.avgRoWait)} sub="arrival → R/O opened" icon={TrendingDown} color="text-purple-600" />
          <StatCard label="Avg Work Time" value={fmtDur(bs.avgWorkTime)} sub="start → done" icon={Clock} color="text-purple-600" />
        </div>
      </div>

      {/* ── Full Timing Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Full Vehicle Log
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {vehicles.length} vehicles
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Vehicle</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Shop</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">R/O #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Arrived</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">R/O Wait</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Work Time</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Total Days</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Delivered</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground text-sm">
                      No vehicles found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  vehicles.map((v) => {
                    const roWaitHours = durHours(v.arrived_at, v.ro_opened_at);
                    const workHours = durHours(v.work_started_at, v.work_done_at);
                    const totalHours = durHours(v.arrived_at, v.delivered_at ?? undefined);
                    const isActive = v.status !== "delivered";
                    const activeHours = isActive ? durHours(v.arrived_at) : null;
                    const isOverdue = activeHours !== null && activeHours > 7 * 24;
                    const shopColor = v.shop_type === "bodyshop" ? "text-purple-600" : "text-blue-600";

                    return (
                      <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                        {/* Vehicle */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm">{String(v.model)}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {v.registration_number && (
                              <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {String(v.registration_number)}
                              </span>
                            )}
                          </div>
                          {v.customer_name && (
                            <p className="text-xs text-muted-foreground mt-0.5">{String(v.customer_name)}</p>
                          )}
                        </td>

                        {/* Shop */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-xs font-medium ${shopColor}`}>
                            {v.shop_type === "bodyshop" ? "Bodyshop" : "Workshop"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={String(v.status)} />
                        </td>

                        {/* R/O # */}
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {v.ro_number ? String(v.ro_number) : "—"}
                        </td>

                        {/* Arrived */}
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(v.arrived_at)}
                        </td>

                        {/* R/O Wait */}
                        <td className="px-4 py-3 text-right">
                          {roWaitHours !== null ? (
                            <span className={`text-xs font-mono ${roWaitHours > 48 ? "text-red-600" : roWaitHours > 24 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {fmtDur(roWaitHours)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Work Time */}
                        <td className="px-4 py-3 text-right">
                          {workHours !== null ? (
                            <span className="text-xs font-mono text-muted-foreground">{fmtDur(workHours)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Total Days */}
                        <td className="px-4 py-3 text-right">
                          {isActive ? (
                            <span className={`text-xs font-mono font-semibold ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
                              {fmtDur(activeHours, { compact: true })}
                              {isOverdue && " ⚠"}
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-green-700">{fmtDur(totalHours, { compact: true })}</span>
                          )}
                        </td>

                        {/* Delivered */}
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(v.delivered_at) ?? "—"}
                        </td>

                        {/* Link */}
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="sm" asChild className="text-xs h-7">
                            <Link href={`/sales/vehicle-register/${v.id}`}>View</Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
