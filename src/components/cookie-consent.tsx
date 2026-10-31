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
      <div className="bg-white/95 border border-[#e2e8f0] rounded-2xl p-5 shadow-2xl backdrop-blur-xl text-[#0f172a] space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5] border border-[#c7d2fe] shrink-0">
              <Cookie size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#0f172a]">
                Cookie & Privacy Preferences
              </h3>
              <p className="text-[11px] text-[#64748b] font-mono">
                Session & Interview Data Protection
              </p>
            </div>
          </div>
          <button
            onClick={handleAcceptEssential}
            className="text-[#64748b] hover:text-[#0f172a] p-1 rounded-lg hover:bg-[#f1f5f9] transition-colors cursor-pointer"
            title="Dismiss & Accept Essential"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        {!showSettings ? (
          <p className="text-xs text-[#475569] leading-relaxed">
            We use cookies to safely store your technical interview progress, generate candidate reports, and ensure session persistence across browser refreshes and logins.
          </p>
        ) : (
          <div className="space-y-2.5 border-t border-b border-[#e2e8f0] py-3 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-3">
              <div>
                <div className="font-semibold text-[#0f172a]">Essential Cookies</div>
                <div className="text-[11px] text-[#64748b]">
                  Required for interview state & security
                </div>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                Always Active
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-3">
              <div>
                <div className="font-semibold text-[#0f172a]">Session Persistence</div>
                <div className="text-[11px] text-[#64748b]">
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
                className="h-4 w-4 rounded border-[#cbd5e1] text-[#4f46e5] focus:ring-[#6366f1] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-3">
              <div>
                <div className="font-semibold text-[#0f172a]">Performance Analytics</div>
                <div className="text-[11px] text-[#64748b]">
                  Helps improve AI speech & response latency
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) =>
                  setPreferences((p) => ({ ...p, analytics: e.target.checked }))
                }
                className="h-4 w-4 rounded border-[#cbd5e1] text-[#4f46e5] focus:ring-[#6366f1] cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            onClick={() => setShowSettings((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold text-[#64748b] hover:text-[#0f172a] bg-[#f8fafc] border border-[#e2e8f0] hover:bg-[#f1f5f9] transition-all cursor-pointer"
          >
            <Settings size={13} />
            <span>{showSettings ? "Back" : "Preferences"}</span>
          </button>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto justify-end">
            {!showSettings && (
              <button
                onClick={handleAcceptEssential}
                className="px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold text-[#334155] hover:text-[#0f172a] bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] transition-all cursor-pointer"
              >
                Essential Only
              </button>
            )}
            <button
              onClick={showSettings ? () => saveConsent(preferences) : handleAcceptAll}
              className="flex items-center gap-1.5 px-4 py-2 sm:py-1.5 rounded-xl text-xs font-semibold text-white bg-[#1e293b] hover:bg-[#0f172a] transition-all shadow-xs cursor-pointer"
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
