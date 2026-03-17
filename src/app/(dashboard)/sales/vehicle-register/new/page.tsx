import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { VehicleForm } from "./vehicle-form";

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ gate?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.VEHICLE_REGISTER_MANAGE)) redirect("/sales/vehicle-register");

  const cs = await cookies();
  const companyId = cs.get("scope_company_id")?.value || "";
  const branchId = cs.get("scope_branch_id")?.value || "";
  const fyId = cs.get("scope_financial_year_id")?.value || "";

  const { gate } = await searchParams;
  const isGateMode = gate === "true";

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={isGateMode ? "Gate Entry — Vehicle Register" : "Add Vehicle to Register"}
        description={
          isGateMode
            ? "Security gate mode — register vehicles as they arrive. Form resets after each entry."
            : "Record a vehicle arriving for workshop or bodyshop."
        }
      />
      <VehicleForm
        userId={user.id}
        companyId={companyId}
        branchId={branchId}
        financialYearId={fyId}
      />
    </div>
  );
}
