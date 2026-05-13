"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Share, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "splatafrika_install_dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if already dismissed recently
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_DURATION_MS) {
      return;
    }

    // Check if already installed (standalone mode)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      return;
    }

    // Detect platform
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isAndroid = /Android/.test(ua);

    if (isIOS) {
      // iOS Safari — show instructions after delay
      setPlatform("ios");
      const timer = setTimeout(() => setShow(true), 30000);
      return () => clearTimeout(timer);
    }

    if (isAndroid) {
      // Android Chrome — listen for beforeinstallprompt
      setPlatform("android");
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        const timer = setTimeout(() => setShow(true), 30000);
        return () => clearTimeout(timer);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (platform === "android" && deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  }, [platform, deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-md mx-auto bg-[#0F2040]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex items-start gap-3">
          {/* App icon */}
          <div className="w-12 h-12 rounded-xl bg-[#00D4AA]/20 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-[#00D4AA]">S</span>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">
              Add SplatAfrika to Home Screen
            </h3>

            {platform === "ios" ? (
              <p className="text-xs text-[#8FA3B1] mt-1 leading-relaxed">
                Tap{" "}
                <Share className="w-3 h-3 inline-block text-[#00D4AA]" />{" "}
                Share, then scroll down and tap{" "}
                <span className="text-white font-medium">
                  &quot;Add to Home Screen&quot;
                </span>
              </p>
            ) : (
              <p className="text-xs text-[#8FA3B1] mt-1">
                Get quick access to capture and view tours
              </p>
            )}

            {platform === "android" && (
              <button
                onClick={handleInstall}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-[#00D4AA] hover:bg-[#33DDBB] text-[#003D30] font-semibold text-xs rounded-lg transition-all duration-200 active:scale-[0.97]"
              >
                <Plus className="w-3 h-3" />
                Install App
              </button>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="p-1.5 text-[#8FA3B1] hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
