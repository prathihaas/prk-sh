/**
 * API key authentication helper for REST API routes.
 * API keys are stored in company_configs table as "api_keys" JSON array.
 * Format: Bearer <api_key>
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export interface ApiAuthResult {
  valid: boolean;
  companyId?: string;
  branchId?: string;
  error?: string;
}

export async function authenticateApiKey(req: NextRequest): Promise<ApiAuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header. Use: Bearer <api_key>" };
  }

  const apiKey = authHeader.substring(7).trim();
  if (!apiKey || apiKey.length < 16) {
    return { valid: false, error: "Invalid API key format" };
  }

  const supabase = await createClient();

  // Look up the API key in company_configs
  const { data: configs, error } = await supabase
    .from("company_configs")
    .select("company_id, config_value")
    .eq("config_key", "api_keys");

  if (error) {
    return { valid: false, error: "Failed to validate API key" };
  }

  for (const config of configs || []) {
    let keys: string[] = [];
    try {
      keys = Array.isArray(config.config_value)
        ? config.config_value
        : JSON.parse(String(config.config_value));
    } catch {
      continue;
    }
    if (keys.includes(apiKey)) {
      return { valid: true, companyId: config.company_id };
    }
  }

  return { valid: false, error: "Invalid API key" };
}

export function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function apiSuccess(data: unknown, status = 200) {
  return Response.json({ data, success: true }, { status });
}
