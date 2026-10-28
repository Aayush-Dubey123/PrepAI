"use client";

import { useEffect, useState } from "react";
import { Cookie, X, Check, Settings } from "lucide-react";

export function CookieConsent() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true,
    sessionTracking: true,
    analytics: true,
  });

  useEffect(() => {
    const consent =
      localStorage.getItem("prepai_cookie_consent") ||
      localStorage.getItem("intervia_cookie_consent");
    if (!consent) {
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (acceptedPrefs: typeof preferences) => {
    const payload = {
      accepted: true,
      timestamp: new Date().toISOString(),
      preferences: acceptedPrefs,
    };

    localStorage.setItem("prepai_cookie_consent", JSON.stringify(payload));
    document.cookie = `prepai_cookie_consent=true; path=/; max-age=${
      60 * 60 * 24 * 365
    }; SameSite=Lax`;

    setIsOpen(false);
    setShowSettings(false);
  };

  const handleAcceptAll = () => {
    const all = { essential: true, sessionTracking: true, analytics: true };
    setPreferences(all);
    saveConsent(all);
  };

  const handleAcceptEssential = () => {
    const essentialOnly = {
      essential: true,
      sessionTracking: false,
      analytics: false,
    };
    setPreferences(essentialOnly);
    saveConsent(essentialOnly);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-md w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#141417]/95 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-xl text-neutral-100 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
              <Cookie size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Cookie & Privacy Preferences
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">
                Session & Interview Data Protection
              </p>
            </div>
          </div>
          <button
            onClick={handleAcceptEssential}
            className="text-neutral-500 hover:text-neutral-300 p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            title="Dismiss & Accept Essential"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        {!showSettings ? (
          <p className="text-xs text-neutral-300 leading-relaxed">
            We use cookies to safely store your technical interview progress, generate candidate reports, and ensure session persistence across browser refreshes and logins.
          </p>
        ) : (
          <div className="space-y-3 border-t border-b border-white/[0.08] py-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Essential Cookies</div>
                <div className="text-[11px] text-neutral-400">
                  Required for interview state & security
                </div>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Always Active
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Session Persistence</div>
                <div className="text-[11px] text-neutral-400">
                  Restores ongoing interview reports across sessions
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.sessionTracking}
                onChange={(e) =>
                  setPreferences((p) => ({
                    ...p,
                    sessionTracking: e.target.checked,
                  }))
                }
                className="rounded border-white/20 bg-neutral-900 text-purple-600 focus:ring-purple-500/40"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Performance Analytics</div>
                <div className="text-[11px] text-neutral-400">
                  Helps improve AI speech & response latency
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) =>
                  setPreferences((p) => ({ ...p, analytics: e.target.checked }))
                }
                className="rounded border-white/20 bg-neutral-900 text-purple-600 focus:ring-purple-500/40"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={() => setShowSettings((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
          >
            <Settings size={13} />
            <span>{showSettings ? "Back" : "Preferences"}</span>
          </button>

          <div className="flex items-center gap-2">
            {!showSettings && (
              <button
                onClick={handleAcceptEssential}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
              >
                Essential Only
              </button>
            )}
            <button
              onClick={showSettings ? () => saveConsent(preferences) : handleAcceptAll}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] cursor-pointer"
            >
              <Check size={14} />
              <span>{showSettings ? "Save Preferences" : "Accept All"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
