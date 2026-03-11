/**
 * GET /api/v1
 * Returns API information and available endpoints.
 * This endpoint does not require authentication.
 */

export async function GET() {
  return Response.json({
    api: "Prk.sh ERP REST API",
    version: "1.0.0",
    authentication: "Bearer token via Authorization header. Get API keys from Configuration > API & Webhooks.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/transactions",
        description: "List cashbook transactions",
        params: ["cashbook_id", "from_date", "to_date", "txn_type", "limit", "offset"],
      },
      {
        method: "GET",
        path: "/api/v1/receipts",
        description: "List receipts",
        params: ["cashbook_id", "from_date", "to_date", "payment_mode", "limit", "offset"],
      },
      {
        method: "GET",
        path: "/api/v1/expenses",
        description: "List expenses",
        params: ["status", "from_date", "to_date", "limit", "offset"],
      },
      {
        method: "GET",
        path: "/api/v1/audit",
        description: "List audit log entries",
        params: ["table_name", "action", "from_date", "to_date", "record_id", "limit", "offset"],
      },
    ],
    webhook_events: [
      "transaction.created",
      "receipt.created",
      "expense.created",
      "expense.paid",
      "expense.paid_direct",
      "expense.approved",
    ],
  });
}
