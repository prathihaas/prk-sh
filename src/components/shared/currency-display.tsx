import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number | string | null | undefined;
  className?: string;
  showSign?: boolean;
}

/**
 * Formats a number as Indian Rupee currency (e.g., ₹1,23,456.78)
 */
export function formatINR(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "₹0.00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "₹0.00";

  const isNegative = num < 0;
  const abs = Math.abs(num);
  const [intPart, decPart] = abs.toFixed(2).split(".");

  // Indian number formatting: last 3 digits, then groups of 2
  let formatted = "";
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    formatted = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    while (remaining.length > 2) {
      formatted = remaining.slice(-2) + "," + formatted;
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) {
      formatted = remaining + "," + formatted;
    }
  }

  return `${isNegative ? "-" : ""}₹${formatted}.${decPart}`;
}

export function CurrencyDisplay({
  amount,
  className,
  showSign = false,
}: CurrencyDisplayProps) {
  const num =
    typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  const isPositive = num > 0;
  const isNegative = num < 0;

  return (
    <span
      className={cn(
        "tabular-nums",
        showSign && isPositive && "text-green-600 dark:text-green-400",
        showSign && isNegative && "text-red-600 dark:text-red-400",
        className
      )}
    >
      {formatINR(amount)}
    </span>
  );
}
