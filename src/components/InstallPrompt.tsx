import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (installed) return null;
  if (!deferredPrompt && !isIos()) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      setDeferredPrompt(null);
      return;
    }
    setShowIosHint((prev) => !prev);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleInstall}
        className="w-full md:w-auto px-5 py-2.5 border border-white/40 text-white rounded-full font-bold text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
      >
        <Download className="h-4 w-4" />
        Add to Home Screen
      </button>
      {showIosHint && (
        <p className="text-white/70 text-xs flex items-center gap-1.5 max-w-xs text-center">
          Tap <Share className="h-3.5 w-3.5 inline" /> Share, then "Add to Home Screen".
        </p>
      )}
    </div>
  );
};
