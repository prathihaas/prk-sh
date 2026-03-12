import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { getCustomer } from "@/lib/queries/customers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Pencil, Phone, Mail, MapPin, FileText, ArrowLeft } from "lucide-react";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.CUSTOMER_READ)) redirect("/dashboard");

  let customer;
  try {
    customer = await getCustomer(customerId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/sales/customers">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Customers
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title={customer.full_name}
          description={`Customer ID: ${customer.customer_code}`}
        />
        {permissions.has(PERMISSIONS.CUSTOMER_UPDATE) && (
          <Button asChild>
            <Link href={`/sales/customers/${customerId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Customer
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Customer ID</span>
              <span className="font-mono font-bold text-primary">
                {customer.customer_code}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <Badge variant="outline" className="capitalize">
                {customer.customer_type}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {customer.is_active ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm">
                {new Date(customer.created_at).toLocaleDateString("en-IN", {
                  dateStyle: "medium",
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.phone ? (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{customer.phone}</span>
              </div>
            ) : null}
            {customer.email ? (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{customer.email}</span>
              </div>
            ) : null}
            {(customer.address || customer.city || customer.state) ? (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>
                  {[customer.address, customer.city, customer.state, customer.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            ) : null}
            {!customer.phone && !customer.email && !customer.address && (
              <p className="text-sm text-muted-foreground">No contact details on record</p>
            )}
          </CardContent>
        </Card>

        {/* Tax Info */}
        {(customer.gstin || customer.pan) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tax & Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.gstin && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">GSTIN</span>
                  <span className="font-mono text-sm">{customer.gstin}</span>
                </div>
              )}
              {customer.pan && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">PAN</span>
                  <span className="font-mono text-sm">{customer.pan}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {customer.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {customer.notes}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick link to invoices for this customer (future) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Invoice history for this customer will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
