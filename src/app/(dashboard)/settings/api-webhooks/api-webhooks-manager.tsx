"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Eye, EyeOff, RefreshCw, Webhook, Key, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const WEBHOOK_EVENTS = [
  { value: "*", label: "All Events" },
  { value: "transaction.created", label: "Transaction Created" },
  { value: "receipt.created", label: "Receipt Created" },
  { value: "expense.created", label: "Expense Created" },
  { value: "expense.paid", label: "Expense Paid" },
  { value: "expense.paid_direct", label: "Expense Paid (Direct)" },
  { value: "expense.approved", label: "Expense Approved" },
];

interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
}

interface ApiWebhooksManagerProps {
  companyId: string;
  initialApiKeys: string[];
  initialWebhooks: WebhookConfig[];
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "prk_live_";
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export function ApiWebhooksManager({
  companyId,
  initialApiKeys,
  initialWebhooks,
}: ApiWebhooksManagerProps) {
  const [apiKeys, setApiKeys] = useState<string[]>(initialApiKeys);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(initialWebhooks);
  const [showKeys, setShowKeys] = useState<Record<number, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // New webhook form
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(["*"]);
  const [newWebhookSecret, setNewWebhookSecret] = useState("");

  function addApiKey() {
    const key = generateApiKey();
    setApiKeys((prev) => [...prev, key]);
    toast.success("API key generated. Click Save to persist it.");
  }

  function removeApiKey(index: number) {
    setApiKeys((prev) => prev.filter((_, i) => i !== index));
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  function addWebhook() {
    if (!newWebhookUrl.trim()) {
      toast.error("Webhook URL is required");
      return;
    }
    try {
      new URL(newWebhookUrl);
    } catch {
      toast.error("Invalid URL format");
      return;
    }
    setWebhooks((prev) => [
      ...prev,
      {
        url: newWebhookUrl.trim(),
        events: newWebhookEvents,
        secret: newWebhookSecret.trim() || undefined,
      },
    ]);
    setNewWebhookUrl("");
    setNewWebhookEvents(["*"]);
    setNewWebhookSecret("");
    toast.info("Webhook added. Click Save to persist.");
  }

  function removeWebhook(index: number) {
    setWebhooks((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveAll() {
    setIsSaving(true);
    try {
      // Save API keys
      const keysRes = await fetch(`/api/webhooks/outbound`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          webhook_configs: webhooks,
        }),
      });

      if (!keysRes.ok) {
        const err = await keysRes.json();
        throw new Error(err.error || "Failed to save webhooks");
      }

      // Save API keys separately via a direct server action call
      const apiKeysRes = await fetch(`/api/settings/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, api_keys: apiKeys }),
      });

      if (!apiKeysRes.ok) {
        const err = await apiKeysRes.json();
        throw new Error(err.error || "Failed to save API keys");
      }

      toast.success("API keys and webhooks saved successfully");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsSaving(false);
    }
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-8">
      {/* API Reference */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
            <CardTitle>REST API Reference</CardTitle>
          </div>
          <CardDescription>Base URL: <code className="font-mono text-sm bg-muted px-1 rounded">{baseUrl}/api/v1</code></CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Authenticate using: <code className="font-mono bg-muted px-1 rounded">Authorization: Bearer &lt;api_key&gt;</code></p>
          <div className="grid gap-2 text-sm">
            {[
              ["GET /api/v1/transactions", "List cashbook transactions"],
              ["GET /api/v1/receipts", "List receipts"],
              ["GET /api/v1/expenses", "List expenses"],
              ["GET /api/v1/audit", "List audit log entries"],
            ].map(([endpoint, desc]) => (
              <div key={endpoint} className="flex items-center justify-between rounded border bg-muted/30 px-3 py-2">
                <code className="font-mono text-xs">{endpoint}</code>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-muted-foreground" />
              <CardTitle>API Keys</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={addApiKey} className="gap-2">
              <Plus className="h-4 w-4" /> Generate Key
            </Button>
          </div>
          <CardDescription>
            API keys grant read access to your company data via the REST API. Keep them secret.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No API keys yet. Click Generate Key to create one.
            </p>
          ) : (
            apiKeys.map((key, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border p-3">
                <code className="flex-1 font-mono text-xs truncate">
                  {showKeys[i] ? key : key.substring(0, 12) + "••••••••••••••••••••••••"}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowKeys((prev) => ({ ...prev, [i]: !prev[i] }))}
                  title={showKeys[i] ? "Hide" : "Show"}
                >
                  {showKeys[i] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(key)}
                  title="Copy"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeApiKey(i)}
                  title="Revoke"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Outbound Webhooks</CardTitle>
          </div>
          <CardDescription>
            Receive real-time POST notifications when events occur in your ERP.
            We include an <code className="font-mono text-xs">X-Prk-Signature</code> header for verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Webhooks */}
          {webhooks.map((wh, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="font-mono text-sm truncate">{wh.url}</p>
                  <div className="flex flex-wrap gap-1">
                    {wh.events.map((ev) => (
                      <Badge key={ev} variant="secondary" className="text-xs">
                        {ev}
                      </Badge>
                    ))}
                  </div>
                  {wh.secret && (
                    <p className="text-xs text-muted-foreground">
                      Signed with secret: {wh.secret.substring(0, 4)}••••
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                  onClick={() => removeWebhook(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {/* Add New Webhook */}
          <div className="rounded-lg border border-dashed p-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Add New Webhook</p>
            <div className="space-y-2">
              <Label className="text-xs">Endpoint URL *</Label>
              <Input
                placeholder="https://your-server.com/webhook"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Events</Label>
              <Select
                value={newWebhookEvents[0]}
                onValueChange={(v) => setNewWebhookEvents([v])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEBHOOK_EVENTS.map((ev) => (
                    <SelectItem key={ev.value} value={ev.value}>
                      {ev.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Signing Secret (optional)</Label>
              <Input
                placeholder="Used to verify webhook authenticity"
                value={newWebhookSecret}
                onChange={(e) => setNewWebhookSecret(e.target.value)}
                type="password"
              />
            </div>
            <Button variant="outline" size="sm" onClick={addWebhook} className="gap-2">
              <Plus className="h-4 w-4" /> Add Webhook
            </Button>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Webhook Payload Format:</p>
            <pre className="font-mono text-xs overflow-x-auto">{`{
  "event": "expense.paid",
  "company_id": "uuid",
  "timestamp": "2025-04-01T10:30:00Z",
  "data": { /* event-specific data */ }
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveAll} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save API Keys & Webhooks"
          )}
        </Button>
      </div>
    </div>
  );
}
