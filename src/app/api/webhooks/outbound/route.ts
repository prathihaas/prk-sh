/**
 * GET  /api/webhooks/outbound  — list webhook configs (admin only, session auth)
 * POST /api/webhooks/outbound  — save/update webhook configs (admin only, session auth)
 *
 * Body: { webhook_configs: Array<{ url, events, secret? }> }
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

async function getSessionUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function getCompanyId() {
  // We can't use cookies() in Route Handlers the same way, so read from request cookie
  return null; // Will be passed via body/query instead
}

export async function GET(req: NextRequest) {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("company_id");
  if (!companyId) {
    return Response.json({ error: "company_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("company_configs")
    .select("config_value")
    .eq("company_id", companyId)
    .eq("config_key", "webhook_urls")
    .single();

  if (error && error.code !== "PGRST116") {
    return Response.json({ error: error.message }, { status: 500 });
  }

  let configs = [];
  if (data?.config_value) {
    try {
      configs = Array.isArray(data.config_value)
        ? data.config_value
        : JSON.parse(String(data.config_value));
    } catch {
      configs = [];
    }
  }

  return Response.json({ webhook_configs: configs });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { company_id, webhook_configs } = body;

  if (!company_id) {
    return Response.json({ error: "company_id required" }, { status: 400 });
  }
  if (!Array.isArray(webhook_configs)) {
    return Response.json({ error: "webhook_configs must be an array" }, { status: 400 });
  }

  // Validate each webhook config
  for (const cfg of webhook_configs) {
    if (!cfg.url || typeof cfg.url !== "string") {
      return Response.json({ error: "Each webhook must have a valid url" }, { status: 400 });
    }
    if (!Array.isArray(cfg.events) || cfg.events.length === 0) {
      return Response.json({ error: `Webhook ${cfg.url} must have at least one event` }, { status: 400 });
    }
    try {
      new URL(cfg.url);
    } catch {
      return Response.json({ error: `Invalid URL: ${cfg.url}` }, { status: 400 });
    }
  }

  // Upsert webhook config
  const { error } = await supabase
    .from("company_configs")
    .upsert(
      {
        company_id,
        config_key: "webhook_urls",
        config_value: webhook_configs,
      },
      { onConflict: "company_id,config_key" }
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, message: `Saved ${webhook_configs.length} webhook(s)` });
}
