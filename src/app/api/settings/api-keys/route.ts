/**
 * POST /api/settings/api-keys
 * Save API keys for a company (session auth only).
 * Body: { company_id: string, api_keys: string[] }
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { company_id, api_keys } = body;

  if (!company_id) {
    return Response.json({ error: "company_id required" }, { status: 400 });
  }
  if (!Array.isArray(api_keys)) {
    return Response.json({ error: "api_keys must be an array" }, { status: 400 });
  }

  // Validate key format (must start with prk_live_ and be 41 chars)
  for (const key of api_keys) {
    if (typeof key !== "string" || key.length < 16) {
      return Response.json(
        { error: `Invalid API key format: ${key.substring(0, 12)}...` },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from("company_configs")
    .upsert(
      {
        company_id,
        config_key: "api_keys",
        config_value: api_keys,
      },
      { onConflict: "company_id,config_key" }
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    message: `Saved ${api_keys.length} API key(s)`,
  });
}
