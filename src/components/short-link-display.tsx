import { useState } from "react";
import { Copy, Check, QrCode, ExternalLink } from "lucide-react";

// ============================================================
// Types
// ============================================================

export interface ShortLinkDisplayProps {
  shortUrl: string; // e.g., "drop.how/abc123"
  fullUrl?: string; // e.g., "https://drop.how/abc123"
  showQR?: boolean;
  onCopy?: () => void;
  onShowQR?: () => void;
}

// ============================================================
// Main Component
// ============================================================

export function ShortLinkDisplay({
  shortUrl,
  fullUrl,
  showQR = true,
  onCopy,
  onShowQR,
}: ShortLinkDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl || `https://${shortUrl}`);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
      <p className="text-xs font-medium text-[#525252]">공유 링크</p>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-[#FAFAFA] px-3 py-2">
          <ExternalLink className="h-4 w-4 shrink-0 text-[#A3A3A3]" />
          <span className="flex-1 truncate text-sm font-medium text-[#0A0A0A]">
            {shortUrl}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all ${
            copied
              ? "bg-[#ECFDF5] text-[#10B981]"
              : "bg-[#F5F5F5] text-[#525252] hover:bg-[#E5E5E5]"
          }`}
          aria-label={copied ? "복사됨" : "링크 복사"}
        >
          {copied ? (
            <Check className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>

        {showQR && (
          <button
            onClick={onShowQR}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5] text-[#525252] transition-colors hover:bg-[#E5E5E5]"
            aria-label="QR 코드 보기"
          >
            <QrCode className="h-4 w-4" />
          </button>
        )}
      </div>

      {copied && (
        <p className="mt-2 text-xs text-[#10B981] animate-fade-in">
          링크가 복사되었습니다
        </p>
      )}
    </div>
  );
}

// ============================================================
// Compact Variant
// ============================================================

export function ShortLinkDisplayCompact({
  shortUrl,
  fullUrl,
  onCopy,
}: Omit<ShortLinkDisplayProps, "showQR" | "onShowQR">) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl || `https://${shortUrl}`);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex max-w-full items-center gap-2 rounded-lg bg-[#FAFAFA] px-3 py-2 transition-colors hover:bg-[#F5F5F5]"
    >
      {/* {slug}-{code} 신형식(최대 slug40+1+6자) — 줄바꿈 없이 말줄임(truncate). */}
      <span className="min-w-0 truncate text-sm text-[#525252]">{shortUrl}</span>
      {copied ? (
        <Check className="h-4 w-4 shrink-0 text-[#10B981]" strokeWidth={2.5} />
      ) : (
        <Copy className="h-4 w-4 shrink-0 text-[#A3A3A3]" />
      )}
    </button>
  );
}

export default ShortLinkDisplay;
