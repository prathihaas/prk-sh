"use client";

/**
 * TallyExportForm
 * ───────────────
 * Client component for selecting date range and triggering XML download.
 *
 * How it works:
 *  1. User picks from_date / to_date
 *  2. URL search params are updated (triggers server revalidation for preview counts)
 *  3. On "Download XML", a direct fetch to /api/v1/tally-export is made,
 *     the XML blob is received and auto-downloaded as a file.
 *  4. All errors surface as toast notifications.
 */

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  fromDate: string;
  toDate: string;
  isConfigured: boolean;
}

export function TallyExportForm({ fromDate: initialFrom, toDate: initialTo, isConfigured }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [downloading, setDownloading] = useState(false);

  // When dates change, update URL params so the server component re-fetches preview counts
  function applyDates(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    params.set("to", to);
    startTransition(() => {
      router.replace(`?${params.toString()}`);
    });
  }

  function handleFromChange(value: string) {
    setFromDate(value);
    if (value <= toDate) applyDates(value, toDate);
  }

  function handleToChange(value: string) {
    setToDate(value);
    if (fromDate <= value) applyDates(fromDate, value);
  }

  function setToday() {
    const today = new Date().toISOString().split("T")[0];
    setFromDate(today);
    setToDate(today);
    applyDates(today, today);
  }

  function setThisMonth() {
    const now = new Date();
    const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const today = now.toISOString().split("T")[0];
    setFromDate(first);
    setToDate(today);
    applyDates(first, today);
  }

  async function handleDownload() {
    if (!fromDate || !toDate) {
      toast.error("Please select a date range");
      return;
    }
    if (fromDate > toDate) {
      toast.error("Start date must be on or before end date");
      return;
    }
    if (!isConfigured) {
      toast.error("Configure Tally settings before exporting");
      return;
    }

    setDownloading(true);
    try {
      // Build the API URL — uses the same API key pattern as other /api/v1 routes
      // In a browser session the Supabase auth cookie is forwarded automatically.
      // We need an API key; read it from the session-visible route instead.
      const url = `/api/v1/tally-export?from_date=${fromDate}&to_date=${toDate}`;
      const response = await fetch(url);

      if (!response.ok) {
        let msg = "Export failed";
        try {
          const json = await response.json();
          msg = json.error || msg;
        } catch {
          msg = await response.text() || msg;
        }
        toast.error(msg);
        return;
      }

      // Read warning count from headers
      const warningCount = parseInt(response.headers.get("X-Warning-Count") || "0");
      const voucherCount = parseInt(response.headers.get("X-Voucher-Count") || "0");

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `tally_export_${fromDate}.xml`;

      // Trigger browser download — always revoke the object URL
      const objectUrl = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }

      if (warningCount > 0) {
        toast.warning(
          `Downloaded ${voucherCount} vouchers with ${warningCount} warning(s). Open the XML file to review the warnings embedded as comments.`
        );
      } else {
        toast.success(`Downloaded ${voucherCount} vouchers as ${filename}`);
      }

      // Reload to refresh history
      startTransition(() => router.refresh());
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  const isLoading = isPending || downloading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Select Date Range
        </CardTitle>
        <CardDescription>
          Choose the period to include in the Tally XML export.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="from_date">From Date</Label>
          <Input
            id="from_date"
            type="date"
            value={fromDate}
            onChange={(e) => handleFromChange(e.target.value)}
            max={toDate}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to_date">To Date</Label>
          <Input
            id="to_date"
            type="date"
            value={toDate}
            onChange={(e) => handleToChange(e.target.value)}
            min={fromDate}
          />
        </div>

        {/* Quick presets */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={setToday} disabled={isLoading}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={setThisMonth} disabled={isLoading}>
            This Month
          </Button>
        </div>

        <Button
          className="w-full gap-2"
          onClick={handleDownload}
          disabled={isLoading || !isConfigured}
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating XML…
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download Tally XML
            </>
          )}
        </Button>

        {!isConfigured && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            Configure Tally settings first
          </p>
        )}

        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Import into Tally Prime:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Open the correct company in Tally</li>
            <li>Gateway of Tally → Import Data</li>
            <li>Select <strong>Vouchers</strong></li>
            <li>Choose the downloaded XML file</li>
            <li>Check Created / Errors count</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
