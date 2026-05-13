"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback — select the input
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="px-4 py-2.5 border border-[#E2E8ED] hover:border-[#00D4AA] text-[#4A6070] hover:text-[#00D4AA] rounded-xl transition-all duration-200"
      aria-label="Copy link"
    >
      {copied ? (
        <Check className="w-4 h-4 text-[#10B981]" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
}
