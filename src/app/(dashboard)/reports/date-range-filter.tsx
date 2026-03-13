"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CalendarRange, X } from "lucide-react";

interface DateRangeFilterProps {
  dateFrom?: string;
  dateTo?: string;
}

export function DateRangeFilter({ dateFrom, dateTo }: DateRangeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildUrl(from: string | null, to: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("date_from", from);
    else params.delete("date_from");
    if (to) params.set("date_to", to);
    else params.delete("date_to");
    return `${pathname}?${params.toString()}`;
  }

  function handleFrom(e: React.ChangeEvent<HTMLInputElement>) {
    router.push(buildUrl(e.target.value || null, dateTo || null));
  }

  function handleTo(e: React.ChangeEvent<HTMLInputElement>) {
    router.push(buildUrl(dateFrom || null, e.target.value || null));
  }

  function clearDates() {
    router.push(buildUrl(null, null));
  }

  const hasFilter = !!(dateFrom || dateTo);

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <CalendarRange className="h-4 w-4 text-muted-foreground mb-2 flex-shrink-0" />
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          type="date"
          value={dateFrom || ""}
          onChange={handleFrom}
          className="h-8 w-36 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          value={dateTo || ""}
          onChange={handleTo}
          className="h-8 w-36 text-sm"
        />
      </div>
      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground"
          onClick={clearDates}
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
