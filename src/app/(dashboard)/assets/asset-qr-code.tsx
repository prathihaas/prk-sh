"use client";

import QRCode from "react-qr-code";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface AssetQrCodeProps {
  qrToken: string;
  assetCode: string;
  baseUrl: string;
}

export function AssetQrCode({ qrToken, assetCode, baseUrl }: AssetQrCodeProps) {
  const [downloading, setDownloading] = useState(false);
  const qrValue = `${baseUrl}/assets/qr/${qrToken}`;

  function downloadQr() {
    setDownloading(true);
    try {
      const svg = document.getElementById("asset-qr-svg");
      if (!svg) return;
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 300;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 256, 300);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 256, 256);
        ctx.fillStyle = "#000";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText(assetCode, 128, 282);
        const link = document.createElement("a");
        link.download = `qr_${assetCode}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        setDownloading(false);
      };
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    } catch {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-white rounded border">
        <QRCode id="asset-qr-svg" value={qrValue} size={180} />
      </div>
      <p className="text-xs text-muted-foreground font-mono">{assetCode}</p>
      <Button variant="outline" size="sm" onClick={downloadQr} disabled={downloading}>
        <Download className="h-3 w-3 mr-1" />
        Download QR
      </Button>
    </div>
  );
}
