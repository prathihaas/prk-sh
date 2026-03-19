"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { CashbookDayCloseForm } from "@/components/forms/cashbook-day-close-form";
import { CashbookDayReopenForm } from "@/components/forms/cashbook-day-reopen-form";
import { TelegramOtpDialog } from "@/components/shared/telegram-otp-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DayActionsProps {
  dayId: string;
  dayStatus: string;
  systemClosing: number | null;
  currentUserId: string;
  canClose: boolean;
  canReopen: boolean;
  /** Manager must approve via Telegram OTP before close form is shown */
  requireManagerOtp?: boolean;
  managerId?: string;
  managerName?: string;
  companyId?: string;
  /** Show denomination count table on day close */
  showDenomination?: boolean;
}

export function DayActions({
  dayId,
  dayStatus,
  systemClosing,
  currentUserId,
  canClose,
  canReopen,
  requireManagerOtp = false,
  managerId,
  managerName,
  companyId = "",
  showDenomination = false,
}: DayActionsProps) {
  const [managerOtpVerified, setManagerOtpVerified] = useState(false);
  const [showOtpDialog, setShowOtpDialog] = useState(false);

  if (!canClose && !canReopen) return null;

  const needsOtpGate = canClose && requireManagerOtp && managerId && !managerOtpVerified;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canClose && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Close Day</CardTitle>
              <CardDescription>
                Enter the physical cash count to close this day
              </CardDescription>
            </CardHeader>
            <CardContent>
              {needsOtpGate ? (
                <div className="space-y-3">
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    <p className="font-medium flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4" />
                      Manager Approval Required
                    </p>
                    <p className="text-xs mt-1">
                      Day closing requires manager approval via Telegram OTP before you can enter the physical count.
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowOtpDialog(true)}
                    variant="outline"
                    className="w-full"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Request Manager Approval
                  </Button>
                </div>
              ) : (
                <CashbookDayCloseForm
                  dayId={dayId}
                  systemClosing={systemClosing}
                  currentUserId={currentUserId}
                  showDenomination={showDenomination}
                />
              )}
            </CardContent>
          </Card>
        )}

        {canReopen && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reopen Day</CardTitle>
              <CardDescription>
                Reopen a closed day to make corrections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CashbookDayReopenForm
                dayId={dayId}
                currentUserId={currentUserId}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {showOtpDialog && managerId && (
        <TelegramOtpDialog
          open={showOtpDialog}
          step="manager"
          entityType="day_close"
          entityId={dayId}
          targetUserId={managerId}
          targetUserName={managerName}
          companyId={companyId}
          onVerified={() => {
            setManagerOtpVerified(true);
            setShowOtpDialog(false);
          }}
          onClose={() => setShowOtpDialog(false)}
        />
      )}
    </>
  );
}
