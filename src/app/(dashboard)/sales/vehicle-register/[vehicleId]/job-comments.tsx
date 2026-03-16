"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addVehicleComment } from "@/lib/queries/vehicle-register";

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  author?: { full_name?: string } | null;
}

interface JobCommentsProps {
  vehicleId: string;
  userId: string;
  comments: Comment[];
}

export function JobComments({ vehicleId, userId, comments }: JobCommentsProps) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!text.trim()) return;
    startTransition(async () => {
      const result = await addVehicleComment(vehicleId, text.trim(), userId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Comment added.");
        setText("");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Add comment */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Add a work update, observation, or note for today..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          size="sm"
          className="self-end"
          onClick={handleAdd}
          disabled={isPending || !text.trim()}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Ctrl+Enter to submit quickly
      </p>

      {/* Comment list */}
      {comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <MessageSquare className="h-8 w-8 opacity-30" />
          <p className="text-sm">No comments yet — add your first update.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const date = new Date(c.created_at);
            const dateStr = date.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
            const timeStr = date.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const authorName = c.author?.full_name || "Staff";

            return (
              <div
                key={c.id}
                className="rounded-lg border bg-muted/30 p-3 space-y-1"
              >
                <p className="text-sm leading-relaxed">{c.comment}</p>
                <p className="text-xs text-muted-foreground">
                  {authorName} &bull; {dateStr} {timeStr}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
