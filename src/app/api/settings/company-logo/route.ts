/**
 * POST /api/settings/company-logo
 * Upload a company logo. Accepts multipart/form-data with fields:
 *   - file: the image file
 *   - company_id: target company UUID
 *
 * Stores in Supabase Storage bucket "company-logos" and updates companies.logo_url.
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/auth/helpers";
import { PERMISSIONS } from "@/lib/constants/permissions";

const BUCKET = "company-logos";
const MAX_SIZE_MB = 2;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_COMPANIES)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const companyId = formData.get("company_id") as string | null;
  const file = formData.get("file") as File | null;

  if (!companyId) {
    return Response.json({ error: "company_id is required" }, { status: 400 });
  }
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: `Invalid file type. Allowed: JPEG, PNG, WebP, SVG` },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return Response.json(
      { error: `File too large. Maximum size is ${MAX_SIZE_MB}MB` },
      { status: 400 }
    );
  }

  // Verify the company belongs to the user's group
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, logo_url")
    .eq("id", companyId)
    .single();

  if (companyError || !company) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  // Build storage path: company-logos/{company_id}/logo.{ext}
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const storagePath = `${companyId}/logo.${ext}`;

  // Convert File to ArrayBuffer for Supabase storage upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Upload to Supabase Storage (upsert = replace existing)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const logoUrl = urlData.publicUrl;

  // Update companies.logo_url
  const { error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: logoUrl })
    .eq("id", companyId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ success: true, logo_url: logoUrl });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await getUserPermissions(supabase, user.id);
  if (!permissions.has(PERMISSIONS.ADMIN_MANAGE_COMPANIES)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("company_id");

  if (!companyId) {
    return Response.json({ error: "company_id required" }, { status: 400 });
  }

  // Clear logo_url in DB
  const { error } = await supabase
    .from("companies")
    .update({ logo_url: null })
    .eq("id", companyId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
