"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Loader2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TelegramOtpDialogProps {
  open: boolean;
  step: "cashier" | "executive" | "manager" | "issuer";
  entityType: "receipt" | "day_close" | "delivery_challan";
  entityId: string;
  targetUserId: string;
  targetUserName?: string;
  companyId: string;
  onVerified: () => void;
  onClose: () => void;
}

const STEP_LABELS: Record<string, string> = {
  cashier: "Cashier",
  executive: "Executive",
  manager: "Manager",
  issuer: "Issuer",
};

const OTP_EXPIRY_SECONDS = 300; // 5 minutes

export function TelegramOtpDialog({
  open,
  step,
  entityType,
  entityId,
  targetUserId,
  targetUserName,
  companyId,
  onVerified,
  onClose,
}: TelegramOtpDialogProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [otpSent, setOtpSent] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const sendOtp = useCallback(async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/telegram/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          step,
          target_user_id: targetUserId,
          company_id: companyId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send OTP");
        return;
      }

      setSessionId(data.session_id);
      setSecondsLeft(OTP_EXPIRY_SECONDS);
      setOtpSent(true);
      setOtp("");
      toast.success(`OTP sent to ${data.sent_to}'s Telegram`);
    } catch {
      toast.error("Network error. Could not send OTP.");
    } finally {
      setIsSending(false);
    }
  }, [entityType, entityId, step, targetUserId, companyId]);

  const verifyOtp = async () => {
    if (!sessionId) return;
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch("/api/telegram/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "OTP verification failed");
        return;
      }

      if (data.verified) {
        toast.success(`${STEP_LABELS[step]} approved successfully`);
        onVerified();
      } else {
        toast.error("Incorrect OTP. Please try again.");
      }
    } catch {
      toast.error("Network error. Could not verify OTP.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setOtp("");
    setSessionId(null);
    setOtpSent(false);
    setSecondsLeft(0);
    onClose();
  };

  const entityLabel =
    entityType === "receipt" ? "Receipt" :
    entityType === "delivery_challan" ? "Delivery Challan" :
    "Day Closing";
  const recipientLabel = targetUserName || STEP_LABELS[step];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            {STEP_LABELS[step]} Approval Required
          </DialogTitle>
          <DialogDescription>
            {entityLabel} requires {STEP_LABELS[step].toLowerCase()} approval via Telegram OTP.
            An OTP will be sent to <strong>{recipientLabel}</strong>&apos;s Telegram.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Send OTP */}
          {!otpSent ? (
            <Button onClick={sendOtp} disabled={isSending} className="w-full" variant="outline">
              {isSending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending OTP…</>
              ) : (
                <><MessageCircle className="mr-2 h-4 w-4" />Send OTP to {recipientLabel}&apos;s Telegram</>
              )}
            </Button>
          ) : (
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                OTP sent to {recipientLabel}&apos;s Telegram
              </span>
              {secondsLeft > 0 ? (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(secondsLeft)}
                </span>
              ) : (
                <Button variant="ghost" size="sm" onClick={sendOtp} disabled={isSending}>
                  Resend
                </Button>
              )}
            </div>
          )}

          {/* OTP Input */}
          {otpSent && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Enter the 6-digit OTP from Telegram:
              </label>
              <div className="flex gap-2">
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").substring(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="font-mono text-xl tracking-widest text-center"
                  onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                />
                <Button
                  onClick={verifyOtp}
                  disabled={isVerifying || otp.length !== 6 || secondsLeft === 0}
                >
                  {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                </Button>
              </div>
              {secondsLeft === 0 && (
                <p className="text-xs text-destructive">OTP expired. Please resend.</p>
              )}
            </div>
          )}

          <Button variant="ghost" className="w-full" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
