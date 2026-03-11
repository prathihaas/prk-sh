"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CompanyLogoUploadProps {
  companyId: string;
  currentLogoUrl?: string | null;
  companyName: string;
}

export function CompanyLogoUpload({
  companyId,
  currentLogoUrl,
  companyName,
}: CompanyLogoUploadProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Auto-upload
    uploadFile(file);
  }

  async function uploadFile(file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("company_id", companyId);

      const res = await fetch("/api/settings/company-logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setLogoUrl(data.logo_url);
      setPreviewUrl(null);
      toast.success("Company logo updated successfully");
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/settings/company-logo?company_id=${companyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove logo");
      }
      setLogoUrl(null);
      setPreviewUrl(null);
      toast.success("Company logo removed");
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsRemoving(false);
    }
  }

  const displayUrl = previewUrl || logoUrl;

  return (
    <div className="space-y-3">
      <Label>Company Logo</Label>
      <div className="flex items-start gap-4 flex-wrap">
        {/* Logo preview */}
        <div className="flex-shrink-0 w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30 overflow-hidden relative">
          {displayUrl ? (
            <Image
              src={displayUrl}
              alt={`${companyName} logo`}
              fill
              className="object-contain p-1"
              unoptimized={!!previewUrl} // blob URLs don't need optimization
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
              <span className="text-xs">No logo</span>
            </div>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 justify-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {logoUrl ? "Replace Logo" : "Upload Logo"}
          </Button>

          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={removeLogo}
              disabled={isRemoving || isUploading}
            >
              {isRemoving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remove
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP or SVG · Max 2MB
          </p>
          <p className="text-xs text-muted-foreground">
            Shown on receipts and expense vouchers
          </p>
        </div>
      </div>
    </div>
  );
}
