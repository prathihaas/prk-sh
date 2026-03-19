"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrintDeliveryChallan } from "@/components/shared/print-delivery-challan";
import { generateDeliveryChallan } from "@/lib/queries/invoices";

interface DeliveryChallanSectionProps {
  invoice: {
    id: string;
    dms_invoice_number?: string | null;
    invoice_date: string;
    invoice_type: string;
    customer_name: string;
    customer_phone?: string | null;
    customer_address?: string | null;
    vehicle_model?: string | null;
    vehicle_variant?: string | null;
    vin_number?: string | null;
    engine_number?: string | null;
    tractor_model?: string | null;
    chassis_number?: string | null;
    grand_total: number;
    delivery_challan_number?: string | null;
    delivery_challan_date?: string | null;
    delivery_address?: string | null;
    is_cancelled?: boolean;
  };
  company: {
    name: string;
    gstin?: string | null;
    address?: string | null;
    logo_url?: string | null;
  } | null;
  branch: {
    name: string;
    address?: string | null;
    phone?: string | null;
  } | null;
  currentUserId: string;
  companyId: string;
  canIssue: boolean;
}

type Phase = "idle" | "address" | "generating";

export function DeliveryChallanSection({
  invoice,
  company,
  branch,
  currentUserId: _currentUserId,
  companyId: _companyId,
  canIssue,
}: DeliveryChallanSectionProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [deliveryAddress, setDeliveryAddress] = useState(
    invoice.customer_address || ""
  );
  const [localChallan, setLocalChallan] = useState<{
    challan_number: string;
    challan_date: string;
    delivery_address: string;
  } | null>(
    invoice.delivery_challan_number
      ? {
          challan_number: invoice.delivery_challan_number,
          challan_date:
            invoice.delivery_challan_date ||
            new Date().toISOString().split("T")[0],
          delivery_address: invoice.delivery_address || "",
        }
      : null
  );

  const invoiceForPrint = {
    ...invoice,
    delivery_challan_number:
      localChallan?.challan_number ?? invoice.delivery_challan_number,
    delivery_challan_date:
      localChallan?.challan_date ?? invoice.delivery_challan_date,
    delivery_address:
      localChallan?.delivery_address ?? invoice.delivery_address,
  };

  const handleGenerateChallan = async () => {
    setPhase("generating");
    const result = await generateDeliveryChallan(invoice.id, deliveryAddress);
    if (result.error) {
      toast.error(result.error);
      setPhase("idle");
      return;
    }
    setLocalChallan({
      challan_number: result.challan_number!,
      challan_date: new Date().toISOString().split("T")[0],
      delivery_address: deliveryAddress,
    });
    toast.success(`Gate Pass ${result.challan_number} issued`);
    router.refresh();
  };

  // Already issued — show gate pass summary + print button
  if (localChallan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            Gate Pass
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Gate Pass No.</p>
              <p className="font-mono font-semibold">
                {localChallan.challan_number}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Date</p>
              <p>
                {new Date(localChallan.challan_date).toLocaleDateString(
                  "en-IN"
                )}
              </p>
            </div>
            {localChallan.delivery_address && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Delivery Address</p>
                <p>{localChallan.delivery_address}</p>
              </div>
            )}
          </div>
          <PrintDeliveryChallan
            invoice={invoiceForPrint}
            company={company}
            branch={branch}
          />
        </CardContent>
      </Card>
    );
  }

  // Not yet issued
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gate Pass
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.is_cancelled ? (
            <p className="text-sm text-muted-foreground">
              Cannot issue a gate pass for a cancelled invoice.
            </p>
          ) : !canIssue ? (
            <p className="text-sm text-muted-foreground">
              You do not have permission to issue gate passes.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No gate pass issued yet. Issue a gate pass to authorise
                physical delivery of goods.
              </p>
              <Button
                onClick={() => setPhase("address")}
                disabled={phase === "generating"}
              >
                {phase === "generating" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Issue Gate Pass
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 1 — Delivery address */}
      <Dialog
        open={phase === "address"}
        onOpenChange={(o) => !o && setPhase("idle")}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Gate Pass</DialogTitle>
            <DialogDescription>
              Confirm the delivery address, then click Generate to issue the
              gate pass.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="delivery-address">Delivery Address</Label>
              <Textarea
                id="delivery-address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter delivery address…"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleGenerateChallan}
                disabled={phase === "generating"}
              >
                {phase === "generating" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Generate Gate Pass
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPhase("idle")}
                disabled={phase === "generating"}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
