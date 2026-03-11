/**
 * Outbound webhook dispatcher.
 * Webhook endpoints are stored in company_configs as:
 *   config_key: "webhook_urls"
 *   config_value: JSON array of { url, events, secret? }
 *
 * Supported events:
 *   transaction.created   — new cashbook transaction
 *   receipt.created       — new receipt
 *   expense.created       — new expense
 *   expense.paid          — expense marked as paid
 *   expense.paid_direct   — expense paid without approval
 *   expense.approved      — expense status changed to approved
 */

import crypto from "crypto";

export type WebhookEvent =
  | "transaction.created"
  | "receipt.created"
  | "expense.created"
  | "expense.paid"
  | "expense.paid_direct"
  | "expense.approved";

interface WebhookConfig {
  url: string;
  events: string[]; // WebhookEvent values or "*" for all events
  secret?: string; // HMAC-SHA256 signing secret
}

export interface WebhookPayload {
  event: WebhookEvent;
  company_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Sign a webhook payload using HMAC-SHA256.
 * Returns the signature as hex string.
 * Receivers should verify: HMAC-SHA256(secret, JSON.stringify(payload))
 */
function signPayload(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Dispatch a webhook event to all registered endpoints for the company.
 * Fire-and-forget: errors are logged but don't fail the caller.
 */
export async function dispatchWebhook(
  companyId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  // Load webhook configs from company_configs
  // Use direct fetch to Supabase REST API to avoid importing server-only modules
  // This runs in API routes (Edge or Node runtime)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return;

  let webhookConfigs: WebhookConfig[] = [];

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/company_configs?select=config_value&config_key=eq.webhook_urls&company_id=eq.${companyId}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (res.ok) {
      const rows: Array<{ config_value: unknown }> = await res.json();
      if (rows[0]?.config_value) {
        const val = rows[0].config_value;
        webhookConfigs = Array.isArray(val) ? val : JSON.parse(String(val));
      }
    }
  } catch {
    // No webhook configs found, skip
    return;
  }

  if (!webhookConfigs.length) return;

  const payload: WebhookPayload = {
    event,
    company_id: companyId,
    timestamp: new Date().toISOString(),
    data,
  };
  const payloadStr = JSON.stringify(payload);

  // Dispatch to all matching endpoints (parallel, no-await)
  const dispatches = webhookConfigs
    .filter(
      (cfg) =>
        cfg.url &&
        (cfg.events.includes("*") || cfg.events.includes(event))
    )
    .map(async (cfg) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Prk-Event": event,
        "X-Prk-Timestamp": payload.timestamp,
      };

      if (cfg.secret) {
        headers["X-Prk-Signature"] = `sha256=${signPayload(cfg.secret, payloadStr)}`;
      }

      try {
        const res = await fetch(cfg.url, {
          method: "POST",
          headers,
          body: payloadStr,
          signal: AbortSignal.timeout(10_000), // 10s timeout
        });

        if (!res.ok) {
          console.warn(`[webhook] ${event} → ${cfg.url}: HTTP ${res.status}`);
        } else {
          console.log(`[webhook] ${event} → ${cfg.url}: OK`);
        }
      } catch (err) {
        console.warn(`[webhook] ${event} → ${cfg.url}: ${String(err)}`);
      }
    });

  await Promise.allSettled(dispatches);
}
