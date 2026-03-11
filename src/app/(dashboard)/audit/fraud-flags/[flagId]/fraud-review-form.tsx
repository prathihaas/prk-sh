"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { resolveFraudFlag } from "@/lib/queries/fraud-flags";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fraudReviewSchema = z.object({
  resolution_status: z.enum(["resolved", "false_positive"], {
    error: "Select a resolution status",
  }),
  resolution_notes: z
    .string({ error: "Resolution notes are required" })
    .min(10, { error: "Notes must be at least 10 characters" }),
});

type FraudReviewFormValues = z.infer<typeof fraudReviewSchema>;

interface FraudReviewFormProps {
  flagId: string;
}

export function FraudReviewForm({ flagId }: FraudReviewFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FraudReviewFormValues>({
    resolver: zodResolver(fraudReviewSchema),
    defaultValues: {
      resolution_status: undefined,
      resolution_notes: "",
    },
  });

  async function onSubmit(values: FraudReviewFormValues) {
    setIsLoading(true);
    try {
      const result = await resolveFraudFlag(
        flagId,
        values.resolution_status,
        values.resolution_notes
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Fraud flag has been resolved");
        router.refresh();
      }
    } catch {
      toast.error("Failed to resolve fraud flag");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Resolve</CardTitle>
        <CardDescription>
          Review this flag and provide a resolution
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="resolution_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select resolution" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="false_positive">
                        False Positive
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="resolution_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the investigation findings and resolution details (min 10 characters)..."
                      rows={4}
                      {...field}
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
              Submit Resolution
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
