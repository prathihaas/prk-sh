"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  payrollProcessSchema,
  type PayrollProcessFormValues,
  payrollReopenSchema,
  type PayrollReopenFormValues,
} from "@/lib/validators/payroll";
import {
  processPayroll,
  lockPayrollRun,
  reopenPayrollRun,
} from "@/lib/queries/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface RunActionsProps {
  runId: string;
  status: string;
  canProcess: boolean;
  canLock: boolean;
  canReopen: boolean;
}

export function RunActions({
  runId,
  status,
  canProcess,
  canLock,
  canReopen,
}: RunActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showReopen, setShowReopen] = useState(false);

  const processForm = useForm<PayrollProcessFormValues>({
    resolver: zodResolver(payrollProcessSchema),
    defaultValues: { total_working_days: 26 },
  });
  const reopenForm = useForm<PayrollReopenFormValues>({
    resolver: zodResolver(payrollReopenSchema),
    defaultValues: { reopen_reason: "" },
  });

  async function handleProcess(values: PayrollProcessFormValues) {
    setIsLoading(true);
    try {
      const r = await processPayroll(runId, values.total_working_days);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Payroll processed");
        router.refresh();
      }
    } catch {
      toast.error("Failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLock() {
    setIsLoading(true);
    try {
      const r = await lockPayrollRun(runId);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Locked");
        router.refresh();
      }
    } catch {
      toast.error("Failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReopen(values: PayrollReopenFormValues) {
    setIsLoading(true);
    try {
      const r = await reopenPayrollRun(runId, values.reopen_reason);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Reopened");
        router.refresh();
      }
    } catch {
      toast.error("Failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(status === "draft" || status === "processed") && canProcess && (
          <Form {...processForm}>
            <form
              onSubmit={processForm.handleSubmit(handleProcess)}
              className="flex items-end gap-4"
            >
              <FormField
                control={processForm.control}
                name="total_working_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Working Days</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        className="w-24"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {status === "draft" ? "Process" : "Re-process"}
              </Button>
            </form>
          </Form>
        )}

        <div className="flex gap-3">
          {status === "processed" && canLock && (
            <Button onClick={handleLock} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Lock
            </Button>
          )}
          {status === "locked" && canReopen && (
            <Button
              variant="destructive"
              onClick={() => setShowReopen(!showReopen)}
              disabled={isLoading}
            >
              Reopen
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push("/hr/payroll")}>
            Back
          </Button>
        </div>

        {showReopen && (
          <Form {...reopenForm}>
            <form
              onSubmit={reopenForm.handleSubmit(handleReopen)}
              className="space-y-3 pt-2"
            >
              <FormField
                control={reopenForm.control}
                name="reopen_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                variant="destructive"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Confirm Reopen
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
