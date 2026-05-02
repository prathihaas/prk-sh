/**
 * Parse the stored cashier-cashbook assignment config into a uniform
 * `{ userId: cashbookId[] }` shape.
 *
 * The config_value in `company_configs` may be in one of two shapes:
 *   - legacy: `{ [userId]: cashbookId }` (single id per cashier)
 *   - current: `{ [userId]: cashbookId[] }` (multiple ids per cashier)
 *
 * Both are accepted on read so existing data keeps working.
 *
 * Lives in `lib/utils` (not `lib/queries`) because `lib/queries/*` files use
 * the `"use server"` directive — every export there must be an async function
 * that runs on the server. This helper is a synchronous pure function reused
 * across server components, server actions, and API routes.
 */
export function parseCashierCashbookAssignments(
  raw: unknown
): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [userId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[userId] = value.filter(
        (v): v is string => typeof v === "string" && v.length > 0
      );
    } else if (typeof value === "string" && value.length > 0) {
      out[userId] = [value];
    }
  }
  return out;
}
