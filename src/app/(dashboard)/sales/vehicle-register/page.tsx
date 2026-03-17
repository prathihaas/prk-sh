import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getVehicles } from "@/lib/queries/vehicle-register";
import {
  STATUS_LABELS,
  type VehicleStatus,
  type ShopType,
} from "@/lib/constants/vehicle-register";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Car, Eye, Clock, Wrench, Paintbrush, ShieldCheck } from "lucide-react";
import { VehicleQuickAction, type VehicleForAction } from "./vehicle-quick-action";

function VehicleStatusBadge({ status }: { status: string }) {
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
    billed: "bg-orange-100 text-orange-700 border-orange-200",
  };
  const cls = cfg[status] || "bg-muted text-muted-foreground";
  const label =
    STATUS_LABELS[status as VehicleStatus] || status.replace(/_/g, " ");
  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {label}
    </Badge>
  );
}

function daysSince(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function VehicleList({
  items,
  canManage,
}: {
  items: Record<string, unknown>[];
  canManage: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Car className="mx-auto h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No vehicles in this category.</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {items.map((v) => {
        const days = daysSince(String(v.arrived_at));
        const isActive = !["delivered"].includes(String(v.status));

        return (
          <div
            key={String(v.id)}
            className="flex items-center justify-between py-3 px-1 gap-3 hover:bg-muted/30 rounded transition-colors"
          >
            {/* Left: vehicle identity */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Car className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                  {String(v.model)}
                  {v.registration_number ? (
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {String(v.registration_number)}
                    </span>
                  ) : null}
                  {v.is_insurance_claim ? (
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  ) : null}
                </p>
                {v.customer_name ? (
                  <p className="text-xs text-muted-foreground truncate">
                    {String(v.customer_name)}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Right: days overdue + status + quick action + view */}
            <div className="flex items-center gap-2 shrink-0">
              {days > 7 && isActive && (
                <Badge variant="destructive" className="text-xs gap-1 hidden md:flex">
                  <Clock className="h-3 w-3" />
                  {days}d
                </Badge>
              )}
              {/* Status badge — hidden on small screens to save space for the action button */}
              <span className="hidden sm:block">
                <VehicleStatusBadge status={String(v.status)} />
              </span>

              {/* Inline quick-action — most important UX element */}
              {canManage && (
                <VehicleQuickAction
                  vehicle={{
                    id: String(v.id),
                    status: String(v.status),
                    shop_type: v.shop_type as string | null,
                  } as VehicleForAction}
                />
              )}

              {/* Always-visible view link */}
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
                <Link href={`/sales/vehicle-register/${v.id}`}>
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const WORKSHOP_GROUPS: Array<{
  key: string;
  label: string;
  statuses: VehicleStatus[];
}> = [
  {
    key: "active",
    label: "Active",
    statuses: [
      "arrived",
      "ro_opened",
      "waiting_for_parts",
      "parts_received",
      "work_in_progress",
      "work_done",
      "ready_for_delivery",
    ],
  },
  { key: "arrived", label: "Arrived", statuses: ["arrived"] },
  { key: "ro_opened", label: "R/O Opened", statuses: ["ro_opened"] },
  {
    key: "parts",
    label: "Parts",
    statuses: ["waiting_for_parts", "parts_received"],
  },
  {
    key: "working",
    label: "Working",
    statuses: ["work_in_progress", "work_done", "ready_for_delivery"],
  },
  {
    key: "gate_pass",
    label: "Gate Pass",
    statuses: ["gate_pass_issued", "challan_issued"],
  },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
];

const BODYSHOP_GROUPS: Array<{
  key: string;
  label: string;
  statuses: VehicleStatus[];
}> = [
  {
    key: "active",
    label: "Active",
    statuses: [
      "arrived",
      "ro_opened",
      "waiting_for_parts",
      "parts_received",
      "insurance_approved",
      "work_in_progress",
      "work_done",
      "ready_for_delivery",
    ],
  },
  { key: "arrived", label: "Arrived", statuses: ["arrived"] },
  { key: "ro_opened", label: "R/O Opened", statuses: ["ro_opened"] },
  {
    key: "insurance",
    label: "Insurance",
    statuses: ["insurance_approved"],
  },
  {
    key: "parts",
    label: "Parts",
    statuses: ["waiting_for_parts", "parts_received"],
  },
  {
    key: "working",
    label: "Working",
    statuses: ["work_in_progress", "work_done", "ready_for_delivery"],
  },
  {
    key: "gate_pass",
    label: "Gate Pass",
    statuses: ["gate_pass_issued", "challan_issued"],
  },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
];

function ShopView({
  vehicles,
  shopType,
  canManage,
}: {
  vehicles: Record<string, unknown>[];
  shopType: ShopType;
  canManage: boolean;
}) {
  const groups = shopType === "workshop" ? WORKSHOP_GROUPS : BODYSHOP_GROUPS;
  const grouped = groups.map((g) => ({
    ...g,
    items: vehicles.filter((v) =>
      g.statuses.includes(v.status as VehicleStatus)
    ),
  }));

  const activeCount = vehicles.filter(
    (v) => !["delivered"].includes(String(v.status))
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {vehicles.length} total &bull; {activeCount} active
        </p>
        {canManage && (
          <Button size="sm" asChild>
            <Link href="/sales/vehicle-register/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Vehicle
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="active">
        <TabsList className="flex-wrap h-auto">
          {grouped.map((g) => (
            <TabsTrigger key={g.key} value={g.key} className="text-xs">
              {g.label}
              {g.items.length > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {g.items.length}
                </span>
              )}
            </TabsTrigger>
          ))}
          <TabsTrigger value="all" className="text-xs">
            All ({vehicles.length})
          </TabsTrigger>
        </TabsList>

        {grouped.map((g) => (
          <TabsContent key={g.key} value={g.key} className="mt-4">
            <VehicleList items={g.items} canManage={canManage} />
          </TabsContent>
        ))}
        <TabsContent value="all" className="mt-4">
          <VehicleList items={vehicles} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default async function VehicleRegisterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.VEHICLE_REGISTER_VIEW)) redirect("/dashboard");

  const canManage = permissions.has(PERMISSIONS.VEHICLE_REGISTER_MANAGE);

  const cs = await cookies();
  const companyId = cs.get("scope_company_id")?.value || "";
  const branchId = cs.get("scope_branch_id")?.value || null;

  const vehicles = companyId ? await getVehicles(companyId, branchId) : [];

  const workshopVehicles = (vehicles as Record<string, unknown>[]).filter(
    (v) => v.shop_type === "workshop"
  );
  const bodyshopVehicles = (vehicles as Record<string, unknown>[]).filter(
    (v) => v.shop_type === "bodyshop"
  );

  const activeWorkshop = workshopVehicles.filter(
    (v) => !["delivered"].includes(String(v.status))
  ).length;
  const activeBodyshop = bodyshopVehicles.filter(
    (v) => !["delivered"].includes(String(v.status))
  ).length;
  const readyCount = (vehicles as Record<string, unknown>[]).filter(
    (v) => v.status === "ready_for_delivery"
  ).length;
  const deliveredTotal = (vehicles as Record<string, unknown>[]).filter(
    (v) => v.status === "delivered"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Register"
        description="Workshop and bodyshop job card tracking — from arrival to delivery."
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Workshop Active",
            count: activeWorkshop,
            Icon: Wrench,
            color: "text-blue-600",
          },
          {
            label: "Bodyshop Active",
            count: activeBodyshop,
            Icon: Paintbrush,
            color: "text-purple-600",
          },
          {
            label: "Ready for Delivery",
            count: readyCount,
            Icon: Car,
            color: "text-emerald-600",
          },
          {
            label: "Delivered (all time)",
            count: deliveredTotal,
            Icon: Car,
            color: "text-green-600",
          },
        ].map(({ label, count, Icon, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workshop / Bodyshop tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="workshop">
            <TabsList>
              <TabsTrigger value="workshop" className="gap-1.5">
                <Wrench className="h-4 w-4" />
                Workshop
                {activeWorkshop > 0 && (
                  <span className="ml-1.5 rounded-full bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5">
                    {activeWorkshop}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="bodyshop" className="gap-1.5">
                <Paintbrush className="h-4 w-4" />
                Bodyshop
                {activeBodyshop > 0 && (
                  <span className="ml-1.5 rounded-full bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5">
                    {activeBodyshop}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="workshop" className="mt-6">
              <ShopView
                vehicles={workshopVehicles}
                shopType="workshop"
                canManage={canManage}
              />
            </TabsContent>
            <TabsContent value="bodyshop" className="mt-6">
              <ShopView
                vehicles={bodyshopVehicles}
                shopType="bodyshop"
                canManage={canManage}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
