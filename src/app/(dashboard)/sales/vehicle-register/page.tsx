import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getVehicles } from "@/lib/queries/vehicle-register";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Car, Eye, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function daysSince(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default async function VehicleRegisterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.VEHICLE_REGISTER_VIEW)) redirect("/dashboard");

  const canManage = permissions.has(PERMISSIONS.VEHICLE_REGISTER_MANAGE);

  const cs = await cookies();
  const companyId = cs.get("scope_company_id")?.value || "";
  const branchId = cs.get("scope_branch_id")?.value || null;

  const vehicles = companyId ? await getVehicles(companyId, branchId) : [];

  const byStatus = {
    all: vehicles,
    arrived: vehicles.filter((v: Record<string, unknown>) => v.status === "arrived"),
    billed: vehicles.filter((v: Record<string, unknown>) => v.status === "billed"),
    challan_issued: vehicles.filter((v: Record<string, unknown>) => v.status === "challan_issued"),
    delivered: vehicles.filter((v: Record<string, unknown>) => v.status === "delivered"),
  };

  function VehicleTable({ items }: { items: Record<string, unknown>[] }) {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Car className="mx-auto h-12 w-12 mb-4 opacity-30" />
          <p>No vehicles in this category.</p>
        </div>
      );
    }

    return (
      <div className="divide-y">
        {items.map((v) => {
          const customer = v.customer as { full_name?: string; phone?: string } | null;
          const invoice = v.invoice as { dms_invoice_number?: string } | null;
          const days = daysSince(String(v.arrived_at));
          const isDelayed = Boolean(v.expected_delivery_date && new Date(String(v.expected_delivery_date)) < new Date() && v.status !== "delivered");

          return (
            <div key={String(v.id)} className="flex items-center justify-between py-3 px-1 gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Car className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {[v.make, v.model, v.variant].filter(Boolean).join(" ")}
                    {v.color ? <span className="text-muted-foreground"> • {String(v.color)}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {v.vin_number ? `VIN: ${v.vin_number}` : v.chassis_number ? `Chassis: ${v.chassis_number}` : "No VIN/Chassis"}
                    {customer?.full_name ? ` • ${customer.full_name}` : ""}
                  </p>
                  {invoice?.dms_invoice_number && (
                    <p className="text-xs text-blue-600">Invoice: {invoice.dms_invoice_number}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isDelayed && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <Clock className="h-3 w-3" />
                    Delayed
                  </Badge>
                )}
                <div className="text-right text-xs text-muted-foreground hidden sm:block">
                  <p>{days}d in showroom</p>
                  <p>{formatDistanceToNow(new Date(String(v.arrived_at)), { addSuffix: true })}</p>
                </div>
                <StatusBadge status={String(v.status)} />
                <Button variant="ghost" size="sm" asChild>
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Register"
        description="Track every vehicle in the showroom from arrival to delivery."
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Arrived (unbilled)", count: byStatus.arrived.length, color: "text-blue-600" },
          { label: "Billed (awaiting challan)", count: byStatus.billed.length, color: "text-orange-600" },
          { label: "Challan Issued", count: byStatus.challan_issued.length, color: "text-purple-600" },
          { label: "Delivered", count: byStatus.delivered.length, color: "text-green-600" },
        ].map(({ label, count, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div />
        {canManage && (
          <Button asChild>
            <Link href="/sales/vehicle-register/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({byStatus.all.length})</TabsTrigger>
              <TabsTrigger value="arrived">Arrived ({byStatus.arrived.length})</TabsTrigger>
              <TabsTrigger value="billed">Billed ({byStatus.billed.length})</TabsTrigger>
              <TabsTrigger value="challan_issued">Challan Issued ({byStatus.challan_issued.length})</TabsTrigger>
              <TabsTrigger value="delivered">Delivered ({byStatus.delivered.length})</TabsTrigger>
            </TabsList>
            {Object.entries(byStatus).map(([key, items]) => (
              <TabsContent key={key} value={key} className="mt-4">
                <VehicleTable items={items as Record<string, unknown>[]} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
