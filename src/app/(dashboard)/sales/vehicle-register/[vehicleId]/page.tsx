import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { getVehicle } from "@/lib/queries/vehicle-register";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Car, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { VehicleActions } from "./vehicle-actions";

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{String(value)}</p>
    </div>
  );
}

const STAGES = [
  { key: "arrived", label: "Arrived", tsKey: "arrived_at", desc: "Vehicle entered the showroom" },
  { key: "billed", label: "Billed", tsKey: "billed_at", desc: "Invoice created & payment recorded" },
  { key: "challan_issued", label: "Challan Issued", tsKey: "challan_issued_at", desc: "Delivery challan generated" },
  { key: "delivered", label: "Delivered", tsKey: "delivered_at", desc: "Vehicle handed over to customer" },
];

const STATUS_ORDER = ["arrived", "billed", "challan_issued", "delivered"];

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.VEHICLE_REGISTER_VIEW)) redirect("/dashboard");

  let vehicle: Record<string, unknown>;
  try {
    vehicle = await getVehicle(vehicleId);
  } catch {
    notFound();
  }

  const canManage = permissions.has(PERMISSIONS.VEHICLE_REGISTER_MANAGE);
  const currentStatusIdx = STATUS_ORDER.indexOf(String(vehicle.status));

  const invoice = vehicle.invoice as Record<string, unknown> | null;
  const customer = vehicle.customer as Record<string, unknown> | null;

  const dateStr = (ts: unknown) =>
    ts
      ? new Date(String(ts)).toLocaleString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : null;

  const isOverdue =
    vehicle.expected_delivery_date &&
    new Date(String(vehicle.expected_delivery_date)) < new Date() &&
    vehicle.status !== "delivered";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sales/vehicle-register">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <PageHeader
        title={[vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ")}
        description={`${String(vehicle.vehicle_type)} • Added to register`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Status Timeline */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status Timeline</CardTitle>
              {isOverdue && (
                <CardDescription className="text-red-600 font-medium">
                  ⚠️ Overdue — expected delivery was {new Date(String(vehicle.expected_delivery_date)).toLocaleDateString("en-IN")}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {STAGES.map((stage, idx) => {
                const done = idx <= currentStatusIdx;
                const current = idx === currentStatusIdx;
                const ts = dateStr(vehicle[stage.tsKey]);
                return (
                  <div key={stage.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {done ? (
                        <CheckCircle2 className={`h-5 w-5 ${current ? "text-primary" : "text-green-600"}`} />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                      {idx < STAGES.length - 1 && (
                        <div className={`w-px flex-1 mt-1 ${done ? "bg-green-600" : "bg-border"}`} style={{ minHeight: 20 }} />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className={`text-sm font-medium ${done ? "" : "text-muted-foreground"}`}>{stage.label}</p>
                      <p className="text-xs text-muted-foreground">{stage.desc}</p>
                      {ts && <p className="text-xs text-muted-foreground mt-0.5">{ts}</p>}
                    </div>
                  </div>
                );
              })}

              <StatusBadge status={String(vehicle.status)} />
            </CardContent>
          </Card>

          {/* Actions */}
          {canManage && (
            <div className="mt-4">
              <VehicleActions vehicle={vehicle} userId={user.id} />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Car className="h-4 w-4" /> Vehicle Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Vehicle Type" value={String(vehicle.vehicle_type)} />
                <Field label="Make" value={String(vehicle.make || "")} />
                <Field label="Model" value={String(vehicle.model)} />
                <Field label="Variant" value={String(vehicle.variant || "")} />
                <Field label="Color" value={String(vehicle.color || "")} />
                <Field label="Year" value={vehicle.year_of_manufacture as number} />
                <Field label="VIN Number" value={String(vehicle.vin_number || "")} />
                <Field label="Chassis Number" value={String(vehicle.chassis_number || "")} />
                <Field label="Engine Number" value={String(vehicle.engine_number || "")} />
                <Field label="Registration No." value={String(vehicle.registration_number || "")} />
              </div>
            </CardContent>
          </Card>

          {customer && (
            <Card>
              <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Name" value={customer.full_name as string} />
                  <Field label="Phone" value={customer.phone as string} />
                  <Field label="Address" value={[customer.address, customer.city, customer.state].filter(Boolean).join(", ")} />
                </div>
              </CardContent>
            </Card>
          )}

          {!customer && vehicle.customer_name && (
            <Card>
              <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
              <CardContent>
                <Field label="Name" value={String(vehicle.customer_name)} />
              </CardContent>
            </Card>
          )}

          {invoice && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Linked Invoice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{String(invoice.dms_invoice_number || "Invoice")}</p>
                    <StatusBadge status={String(invoice.approval_status)} />
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/invoices/${invoice.id}`}>
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      View Invoice
                    </Link>
                  </Button>
                </div>
                {invoice.delivery_challan_number && (
                  <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3 text-sm">
                    <p className="font-medium text-green-800 dark:text-green-200">✓ Delivery Challan Issued</p>
                    <p className="text-green-700 dark:text-green-300 text-xs">No: {String(invoice.delivery_challan_number)} • {String(invoice.delivery_challan_date || "")}</p>
                  </div>
                )}
                {!invoice.delivery_challan_number && vehicle.status === "billed" && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3 text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Delivery Challan Pending</p>
                    <p className="text-xs">Issue the delivery challan from the invoice page before the vehicle can be delivered.</p>
                    <Button variant="outline" size="sm" className="mt-2" asChild>
                      <Link href={`/invoices/${invoice.id}`}>Go to Invoice → Issue Challan</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {vehicle.notes && (
            <Card>
              <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{String(vehicle.notes)}</p>
                {vehicle.delay_reason && (
                  <div className="mt-2 rounded border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-2 text-xs text-red-700 dark:text-red-300">
                    <span className="font-medium">Delay Reason: </span>{String(vehicle.delay_reason)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
