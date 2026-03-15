"use client";

import { useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createCustomer } from "@/lib/queries/customers";

export interface CustomerOption {
  id: string;
  full_name: string;
  customer_code: string;
  phone: string | null;
  gstin: string | null;
}

interface CustomerPickerWithCreateProps {
  customers: CustomerOption[];
  companyId: string;
  currentUserId: string;
  value?: string; // selected customer_id
  onSelect: (customer: CustomerOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CustomerPickerWithCreate({
  customers: initialCustomers,
  companyId,
  currentUserId,
  value,
  onSelect,
  placeholder = "Search or select customer...",
  disabled = false,
}: CustomerPickerWithCreateProps) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localCustomers, setLocalCustomers] =
    useState<CustomerOption[]>(initialCustomers);
  const [isPending, startTransition] = useTransition();

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newType, setNewType] = useState<"individual" | "business">(
    "individual"
  );

  const selected = localCustomers.find((c) => c.id === value) ?? null;

  function openCreateDialog() {
    setOpen(false);
    setDialogOpen(true);
  }

  function handleCreateCustomer() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await createCustomer({
        full_name: newName.trim(),
        phone: newPhone.trim() || undefined,
        customer_type: newType,
        is_active: true,
        company_id: companyId,
        created_by: currentUserId,
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      const newCustomer: CustomerOption = {
        id: result.id!,
        full_name: newName.trim(),
        customer_code: result.customer_code!,
        phone: newPhone.trim() || null,
        gstin: null,
      };

      setLocalCustomers((prev) => [...prev, newCustomer]);
      onSelect(newCustomer);
      setDialogOpen(false);
      setNewName("");
      setNewPhone("");
      setNewType("individual");
      toast.success(`Customer ${newCustomer.customer_code} created and selected`);
    });
  }

  return (
    <>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="flex-1 justify-between font-normal h-9 px-3"
            >
              {selected ? (
                <span className="flex items-center gap-2 overflow-hidden">
                  <span className="font-medium truncate">{selected.full_name}</span>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {selected.customer_code}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[380px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search by name, code, or phone..." />
              <CommandList>
                <CommandEmpty>
                  <div className="py-3 text-center text-sm text-muted-foreground">
                    No customer found.{" "}
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2"
                      onClick={openCreateDialog}
                    >
                      Create new
                    </button>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {localCustomers.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.full_name} ${c.customer_code} ${c.phone ?? ""}`}
                      onSelect={() => {
                        onSelect(c);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          value === c.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="overflow-hidden">
                        <p className="font-medium truncate">{c.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.customer_code}
                          {c.phone ? ` · ${c.phone}` : ""}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <div className="border-t p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={openCreateDialog}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Customer
                  </Button>
                </div>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9"
            onClick={() => onSelect(null)}
            title="Clear customer"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Quick-create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="new-cust-name">Full Name *</Label>
              <Input
                id="new-cust-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Customer full name"
                onKeyDown={(e) => e.key === "Enter" && handleCreateCustomer()}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-cust-phone">Phone</Label>
              <Input
                id="new-cust-phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="10-digit mobile"
                maxLength={10}
              />
            </div>
            <div className="space-y-1">
              <Label>Customer Type</Label>
              <Select
                value={newType}
                onValueChange={(v) =>
                  setNewType(v as "individual" | "business")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!newName.trim() || isPending}
              onClick={handleCreateCustomer}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create & Select"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
