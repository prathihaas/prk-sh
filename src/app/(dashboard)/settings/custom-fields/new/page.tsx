import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { CustomFieldForm } from "@/components/forms/custom-field-form";

export default async function NewCustomFieldPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_CUSTOM_FIELDS))
    redirect("/dashboard");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("scope_company_id")?.value;
  if (!companyId) redirect("/settings/custom-fields");

  return (
    <div className="space-y-6">
      <CustomFieldForm companyId={companyId} />
    </div>
  );
}
